import { Router } from 'express';
import { db, getSetting } from '../db.js';
import { complete, streamComplete, activeHasKey, activeProvider } from '../providers/index.js';
import { INLINE_PROMPTS, CONTINUITY_PROMPT, DEFAULT_SYSTEM_PROMPT } from '../config.js';
import { now, newId, htmlToText, estimateTokens, parseJsonArray } from '../util.js';

export const aiRouter = Router();

// ---------------------------------------------------------------------------
// Context assembly — shared by chat + continuity
// ---------------------------------------------------------------------------
interface CtxOpts {
  scenePageId?: string | null;
  scene?: boolean;
  chapter?: boolean;
  codex?: boolean;
  codexIds?: string[];
  lore?: boolean;
}

function pageText(id: string): { title: string; text: string; parent_id: string | null } | null {
  const p = db.prepare('SELECT title, body, parent_id FROM pages WHERE id = ?').get(id) as
    | { title: string; body: string; parent_id: string | null }
    | undefined;
  if (!p) return null;
  return { title: p.title, text: htmlToText(p.body), parent_id: p.parent_id };
}

function buildContext(opts: CtxOpts): { text: string; parts: Record<string, boolean> } {
  const blocks: string[] = [];
  const parts: Record<string, boolean> = {};

  const scene = opts.scenePageId ? pageText(opts.scenePageId) : null;

  if (opts.scene && scene) {
    blocks.push(`# Current scene — "${scene.title}"\n${scene.text}`);
    parts.scene = true;
  }

  if (opts.chapter && scene?.parent_id) {
    const siblings = db
      .prepare("SELECT title, body FROM pages WHERE parent_id = ? AND kind IN ('page','chapter') ORDER BY position")
      .all(scene.parent_id) as Array<{ title: string; body: string }>;
    if (siblings.length) {
      const chapterText = siblings
        .map((s) => `## ${s.title}\n${htmlToText(s.body)}`)
        .join('\n\n');
      blocks.push(`# Current chapter\n${chapterText}`);
      parts.chapter = true;
    }
  }

  if (opts.codex) {
    let entityIds = opts.codexIds ?? [];
    if (!entityIds.length && opts.scenePageId) {
      entityIds = (
        db.prepare('SELECT entity_id FROM mentions WHERE page_id = ?').all(opts.scenePageId) as Array<{
          entity_id: string;
        }>
      ).map((r) => r.entity_id);
    }
    const entities = entityIds
      .map((id) => db.prepare('SELECT type, name, aliases, body FROM entities WHERE id = ?').get(id))
      .filter(Boolean) as Array<{ type: string; name: string; aliases: string; body: string }>;
    if (entities.length) {
      const codexText = entities
        .map((e) => {
          const aliases = parseJsonArray<string>(e.aliases);
          const aka = aliases.length ? ` (aka ${aliases.join(', ')})` : '';
          return `## ${e.name} — ${e.type}${aka}\n${htmlToText(e.body)}`;
        })
        .join('\n\n');
      blocks.push(`# Codex (active entries)\n${codexText}`);
      parts.codex = true;
    }
  }

  if (opts.lore) {
    const pinned = db.prepare('SELECT title, body FROM pages WHERE pinned = 1').all() as Array<{
      title: string;
      body: string;
    }>;
    if (pinned.length) {
      const loreText = pinned.map((p) => `## ${p.title}\n${htmlToText(p.body)}`).join('\n\n');
      blocks.push(`# Lore Bible (canon — treat as authoritative)\n${loreText}`);
      parts.lore = true;
    }
  }

  return { text: blocks.join('\n\n---\n\n'), parts };
}

function baseSystemPrompt(): string {
  return getSetting('system_prompt') ?? DEFAULT_SYSTEM_PROMPT;
}

// ---- live token estimate for the context chips ----
aiRouter.post('/context-estimate', (req, res) => {
  const { text } = buildContext(req.body ?? {});
  res.json({ tokens: estimateTokens(text), hasContext: text.length > 0 });
});

// ---------------------------------------------------------------------------
// Streaming chat (SSE)
// ---------------------------------------------------------------------------
aiRouter.post('/chat', async (req, res) => {
  const { threadId, message, context = {}, scenePageId = null, codexIds = [] } = req.body ?? {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (!activeHasKey()) {
    send('error', {
      code: 'missing_api_key',
      message: `No API key is configured for the selected AI provider (${activeProvider()}). Add the matching key to your .env file and restart, or switch providers in Settings. The editor and all other features keep working without it.`,
    });
    return res.end();
  }

  // Resolve / create thread
  let tid = threadId as string | undefined;
  if (!tid) {
    tid = newId();
    db.prepare(
      'INSERT INTO chat_threads (id, title, readonly, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
    ).run(tid, (message ?? 'New thread').slice(0, 40), now(), now());
    send('thread', { id: tid });
  }

  // Persist user message
  const userMsg = String(message ?? '').trim();
  if (userMsg) {
    db.prepare('INSERT INTO chat_messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      newId(),
      tid,
      'user',
      userMsg,
      now(),
    );
  }

  // Build conversation history (exclude any empty placeholders)
  const history = db
    .prepare("SELECT role, content FROM chat_messages WHERE thread_id = ? AND content != '' ORDER BY created_at")
    .all(tid) as Array<{ role: 'user' | 'assistant'; content: string }>;

  const ctx = buildContext({ scenePageId, scene: context.scene, chapter: context.chapter, codex: context.codex, codexIds, lore: context.lore });
  const system =
    baseSystemPrompt() + (ctx.text ? `\n\n========\nThe author has shared this context. Treat it as canon:\n\n${ctx.text}` : '');

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const full = await streamComplete(
      { system, messages: history, maxTokens: 8192 },
      (delta) => send('delta', { text: delta }),
      controller.signal,
    );
    db.prepare('INSERT INTO chat_messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      newId(),
      tid,
      'assistant',
      full,
      now(),
    );
    db.prepare('UPDATE chat_threads SET updated_at = ? WHERE id = ?').run(now(), tid);
    send('done', { threadId: tid });
  } catch (err: any) {
    if (err?.name !== 'AbortError') send('error', { message: err?.message ?? 'AI request failed.' });
  }
  res.end();
});

// ---------------------------------------------------------------------------
// Inline writing tools (M4) — returns a single suggestion (non-streaming)
// ---------------------------------------------------------------------------
aiRouter.post('/inline', async (req, res) => {
  const { tool, text, instruction = '', scenePageId = null } = req.body ?? {};
  if (!activeHasKey()) return res.status(503).json({ error: 'missing_api_key' });
  const base = (INLINE_PROMPTS as Record<string, string>)[tool];
  if (!base) return res.status(400).json({ error: 'unknown_tool' });

  // Light context: the surrounding scene helps "Continue" and continuity-aware edits.
  const ctx = scenePageId ? buildContext({ scenePageId, scene: true }).text : '';
  const system = baseSystemPrompt() + (ctx ? `\n\nScene context for reference (do not output it):\n${ctx}` : '');

  const userContent =
    tool === 'custom'
      ? `${base}\n\nINSTRUCTION: ${instruction}\n\nPASSAGE:\n${text}`
      : `${base}\n\nPASSAGE:\n${text}`;

  try {
    const suggestion = await complete({ system, messages: [{ role: 'user', content: userContent }], maxTokens: 2048 });
    res.json({ suggestion });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'AI request failed.' });
  }
});

// ---------------------------------------------------------------------------
// Continuity checker (M4)
// ---------------------------------------------------------------------------
aiRouter.post('/continuity', async (req, res) => {
  const { pageId } = req.body ?? {};
  if (!activeHasKey()) return res.status(503).json({ error: 'missing_api_key' });
  const scene = pageId ? pageText(pageId) : null;
  if (!scene) return res.status(404).json({ error: 'not_found' });

  const ctx = buildContext({ scenePageId: pageId, codex: true, lore: true });
  const user = `SCENE — "${scene.title}":\n${scene.text}\n\nCONTEXT:\n${ctx.text || '(no codex or lore context provided)'}`;

  try {
    const raw = await complete({ system: CONTINUITY_PROMPT, messages: [{ role: 'user', content: user }], maxTokens: 2048 });
    let flags: Array<{ quote: string; issue: string; suggestion: string }> = [];
    const match = raw.match(/\[[\s\S]*\]/);
    try {
      flags = JSON.parse(match ? match[0] : raw);
    } catch {
      flags = [];
    }

    // Replace stored flags for this scene
    db.prepare('DELETE FROM continuity_flags WHERE page_id = ?').run(pageId);
    const ins = db.prepare(
      'INSERT INTO continuity_flags (id, page_id, quote, issue, suggestion, dismissed, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    );
    const out = flags
      .filter((f) => f && f.quote && f.issue)
      .map((f) => {
        const id = newId();
        ins.run(id, pageId, String(f.quote), String(f.issue), String(f.suggestion ?? ''), now());
        return { id, ...f, dismissed: false };
      });
    res.json({ flags: out });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'AI request failed.' });
  }
});

aiRouter.get('/continuity/:pageId', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM continuity_flags WHERE page_id = ? AND dismissed = 0 ORDER BY created_at')
    .all(req.params.pageId) as Array<{ id: string; quote: string; issue: string; suggestion: string }>;
  res.json({ flags: rows.map((r) => ({ ...r, dismissed: false })) });
});

aiRouter.post('/continuity/:flagId/dismiss', (req, res) => {
  db.prepare('UPDATE continuity_flags SET dismissed = 1 WHERE id = ?').run(req.params.flagId);
  res.json({ ok: true });
});
