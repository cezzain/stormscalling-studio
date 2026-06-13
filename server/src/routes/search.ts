import { Router } from 'express';
import { db } from '../db.js';
import { htmlToText, parseJsonArray } from '../util.js';

export const searchRouter = Router();

// GET /api/search?q=...  -> grouped results for the Cmd+K overlay
searchRouter.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  if (!q) return res.json({ groups: [] });

  const contains = (s: string) => s.toLowerCase().includes(q);
  const snippetAround = (text: string) => {
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return text.slice(0, 90);
    const start = Math.max(0, i - 40);
    return (start > 0 ? '…' : '') + text.slice(start, start + 110).trim() + '…';
  };

  // PAGES
  const pageRows = db.prepare("SELECT id, title, body, status, updated_at FROM pages WHERE kind IN ('page','chapter')").all() as Array<{
    id: string;
    title: string;
    body: string;
    status: string | null;
    updated_at: string;
  }>;
  const pages = pageRows
    .map((p) => ({ p, text: htmlToText(p.body) }))
    .filter(({ p, text }) => contains(p.title) || contains(text))
    .slice(0, 8)
    .map(({ p, text }) => ({
      type: 'page',
      id: p.id,
      title: p.title,
      snippet: snippetAround(text),
      dot:
        p.status === 'done' ? 'var(--s-done)' : p.status === 'revised' ? 'var(--s-revised)' : 'var(--s-draft)',
    }));

  // CODEX
  const entRows = db.prepare('SELECT id, type, name, aliases, body FROM entities').all() as Array<{
    id: string;
    type: string;
    name: string;
    aliases: string;
    body: string;
  }>;
  const codex = entRows
    .filter(
      (e) =>
        contains(e.name) ||
        parseJsonArray<string>(e.aliases).some(contains) ||
        contains(htmlToText(e.body)),
    )
    .slice(0, 8)
    .map((e) => ({
      type: 'entity',
      id: e.id,
      title: e.name,
      snippet: `${e.type.charAt(0).toUpperCase() + e.type.slice(1)}`,
      dot: 'var(--clay)',
    }));

  // TIMELINE
  const evRows = db.prepare('SELECT id, title, in_world_date, description FROM timeline_events').all() as Array<{
    id: string;
    title: string;
    in_world_date: string;
    description: string;
  }>;
  const timeline = evRows
    .filter((e) => contains(e.title) || contains(e.description))
    .slice(0, 6)
    .map((e) => ({ type: 'timeline', id: e.id, title: e.title, snippet: e.in_world_date, dot: 'var(--sage)' }));

  // THREADS
  const thRows = db.prepare('SELECT id, title FROM chat_threads').all() as Array<{ id: string; title: string }>;
  const threads = thRows
    .filter((t) => contains(t.title))
    .slice(0, 5)
    .map((t) => ({ type: 'thread', id: t.id, title: t.title, snippet: 'Co-writer thread', dot: 'var(--forest)' }));

  const groups = [
    { label: 'PAGES', items: pages },
    { label: 'CODEX', items: codex },
    { label: 'TIMELINE', items: timeline },
    { label: 'THREADS', items: threads },
  ].filter((g) => g.items.length);

  res.json({ groups });
});
