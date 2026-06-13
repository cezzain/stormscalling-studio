import { Router } from 'express';
import { db } from '../db.js';
import { now, newId } from '../util.js';

export const versionsRouter = Router();

interface PageRow {
  id: string;
  title: string;
  body: string;
  word_count: number;
}

// ---- list snapshots for a page (newest first) ----
versionsRouter.get('/:pageId', (req, res) => {
  const rows = db
    .prepare('SELECT id, label, title, word_count, kind, created_at FROM versions WHERE page_id = ? ORDER BY created_at DESC')
    .all(req.params.pageId);
  res.json(rows);
});

// ---- get one snapshot (full body) ----
versionsRouter.get('/one/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

// ---- create a snapshot (auto | manual | safety) ----
versionsRouter.post('/:pageId', (req, res) => {
  const page = db.prepare('SELECT id, title, body, word_count FROM pages WHERE id = ?').get(req.params.pageId) as
    | PageRow
    | undefined;
  if (!page) return res.status(404).json({ error: 'not_found' });
  const { label = '', kind = 'auto' } = req.body ?? {};
  const id = newId();
  db.prepare(
    'INSERT INTO versions (id, page_id, label, body, title, word_count, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, page.id, label, page.body, page.title, page.word_count, kind, now());
  res.json({ id });
});

// ---- restore a snapshot (takes a safety snapshot of current state first) ----
versionsRouter.post('/restore/:id', (req, res) => {
  const ver = db.prepare('SELECT * FROM versions WHERE id = ?').get(req.params.id) as
    | { id: string; page_id: string; body: string; title: string; word_count: number }
    | undefined;
  if (!ver) return res.status(404).json({ error: 'not_found' });
  const page = db.prepare('SELECT id, title, body, word_count FROM pages WHERE id = ?').get(ver.page_id) as
    | PageRow
    | undefined;
  if (!page) return res.status(404).json({ error: 'page_gone' });

  // Safety snapshot of the current state before overwriting.
  db.prepare(
    'INSERT INTO versions (id, page_id, label, body, title, word_count, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(newId(), page.id, 'Before restore', page.body, page.title, page.word_count, 'safety', now());

  db.prepare('UPDATE pages SET body = ?, title = ?, word_count = ?, updated_at = ? WHERE id = ?').run(
    ver.body,
    ver.title,
    ver.word_count,
    now(),
    page.id,
  );
  res.json({ ok: true });
});
