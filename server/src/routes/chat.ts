import { Router } from 'express';
import { db } from '../db.js';
import { now, newId } from '../util.js';

export const chatRouter = Router();

// ---- list threads (newest first) ----
chatRouter.get('/threads', (_req, res) => {
  const rows = db.prepare('SELECT * FROM chat_threads ORDER BY updated_at DESC').all() as Array<{
    id: string;
    title: string;
    readonly: number;
    system_prompt: string | null;
  }>;
  res.json(rows.map((r) => ({ ...r, readonly: !!r.readonly })));
});

// ---- create empty thread ----
chatRouter.post('/threads', (req, res) => {
  const id = newId();
  const t = now();
  db.prepare(
    'INSERT INTO chat_threads (id, title, readonly, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
  ).run(id, req.body?.title ?? 'New thread', t, t);
  const row = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(id);
  res.json(row);
});

// ---- thread messages ----
chatRouter.get('/threads/:id/messages', (req, res) => {
  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.id) as
    | { id: string; title: string; readonly: number; system_prompt: string | null }
    | undefined;
  if (!thread) return res.status(404).json({ error: 'not_found' });
  const messages = db
    .prepare('SELECT id, role, content, created_at FROM chat_messages WHERE thread_id = ? ORDER BY created_at')
    .all(req.params.id);
  res.json({ thread: { ...thread, readonly: !!thread.readonly }, messages });
});

// ---- rename / set system prompt ----
chatRouter.patch('/threads/:id', (req, res) => {
  const fields: Record<string, unknown> = {};
  if ('title' in (req.body ?? {})) fields.title = req.body.title;
  if ('system_prompt' in (req.body ?? {})) fields.system_prompt = req.body.system_prompt;
  fields.updated_at = now();
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE chat_threads SET ${sets} WHERE id = @id`).run({ ...fields, id: req.params.id });
  res.json({ ok: true });
});

// ---- delete ----
chatRouter.delete('/threads/:id', (req, res) => {
  db.prepare('DELETE FROM chat_threads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- import a claude.ai conversation (paste -> read-only thread) ----
chatRouter.post('/import', (req, res) => {
  const text: string = String(req.body?.text ?? '').trim();
  const title: string = req.body?.title ?? 'Imported conversation';
  if (!text) return res.status(400).json({ error: 'empty' });

  const messages = parsePastedConversation(text);
  const id = newId();
  const t = now();
  db.prepare(
    'INSERT INTO chat_threads (id, title, readonly, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
  ).run(id, title, t, t);
  const ins = db.prepare(
    'INSERT INTO chat_messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const tx = db.transaction((rows: typeof messages) => {
    for (const m of rows) ins.run(newId(), id, m.role, m.content, now());
  });
  tx(messages);
  res.json({ id, count: messages.length });
});

/**
 * Best-effort parse of a pasted claude.ai conversation into alternating turns.
 * Handles explicit role markers ("You said:", "Claude said:", "Human:", "Assistant:")
 * and falls back to blank-line-separated blocks alternating user→assistant.
 */
function parsePastedConversation(text: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  const markerRe = /^(you|human|me|claude|assistant)\s*(said)?\s*:?\s*$/i;
  const lines = text.split(/\r?\n/);
  const hasMarkers = lines.some((l) => markerRe.test(l.trim()));

  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (hasMarkers) {
    let role: 'user' | 'assistant' = 'user';
    let buf: string[] = [];
    const flush = () => {
      const content = buf.join('\n').trim();
      if (content) out.push({ role, content });
      buf = [];
    };
    for (const line of lines) {
      const m = line.trim().match(markerRe);
      if (m) {
        flush();
        const who = m[1].toLowerCase();
        role = who === 'claude' || who === 'assistant' ? 'assistant' : 'user';
      } else {
        buf.push(line);
      }
    }
    flush();
  } else {
    const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    blocks.forEach((b, i) => out.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: b }));
  }

  return out.length ? out : [{ role: 'assistant', content: text }];
}
