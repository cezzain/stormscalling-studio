import { Router } from 'express';
import { db } from '../db.js';
import { now, newId, wordCount, extractEntityIds, htmlToText } from '../util.js';

export const pagesRouter = Router();

interface PageRow {
  id: string;
  parent_id: string | null;
  kind: string;
  title: string;
  body: string;
  status: string | null;
  section: string;
  pinned: number;
  collapsed: number;
  word_count: number;
  position: number;
  created_at: string;
  updated_at: string;
}

function rebuildMentions(pageId: string, body: string) {
  db.prepare('DELETE FROM mentions WHERE page_id = ?').run(pageId);
  const ids = extractEntityIds(body);
  const valid = db.prepare('SELECT id FROM entities WHERE id = ?');
  const insert = db.prepare(
    'INSERT INTO mentions (id, page_id, entity_id, created_at) VALUES (?, ?, ?, ?)',
  );
  const t = now();
  for (const eid of ids) {
    if (valid.get(eid)) insert.run(newId(), pageId, eid, t);
  }
}

// ---- list whole tree (flat array; client builds the hierarchy) ----
pagesRouter.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM pages ORDER BY position ASC, created_at ASC')
    .all() as PageRow[];
  res.json(rows.map((r) => ({ ...r, pinned: !!r.pinned, collapsed: !!r.collapsed })));
});

// ---- single page ----
pagesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ ...row, pinned: !!row.pinned, collapsed: !!row.collapsed });
});

// ---- create ----
pagesRouter.post('/', (req, res) => {
  const { parent_id = null, kind = 'page', title = 'Untitled', status = null, body = '' } = req.body ?? {};
  const id = newId();
  const t = now();
  // A child always belongs to its parent's section; a root uses the requested
  // section (manuscript | lore), defaulting to manuscript.
  let section = req.body?.section === 'lore' ? 'lore' : 'manuscript';
  if (parent_id) {
    const parent = db.prepare('SELECT section FROM pages WHERE id = ?').get(parent_id) as
      | { section: string }
      | undefined;
    if (parent) section = parent.section;
  }
  // place at end of siblings
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), 0) AS m FROM pages WHERE parent_id IS ?')
    .get(parent_id) as { m: number };
  db.prepare(
    `INSERT INTO pages (id, parent_id, kind, title, body, status, section, pinned, collapsed, word_count, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
  ).run(id, parent_id, kind, title, body, status, section, wordCount(body), maxPos.m + 1, t, t);
  if (body) rebuildMentions(id, body);
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow;
  res.json({ ...row, pinned: !!row.pinned, collapsed: !!row.collapsed });
});

// ---- update (title/body/status/pinned/collapsed/kind) ----
pagesRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow | undefined;
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const fields: Record<string, unknown> = {};
  for (const k of ['title', 'body', 'status', 'kind'] as const) {
    if (k in (req.body ?? {})) fields[k] = req.body[k];
  }
  if ('pinned' in (req.body ?? {})) fields.pinned = req.body.pinned ? 1 : 0;
  if ('collapsed' in (req.body ?? {})) fields.collapsed = req.body.collapsed ? 1 : 0;
  if ('body' in fields) fields.word_count = wordCount(String(fields.body));
  fields.updated_at = now();

  const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE pages SET ${sets} WHERE id = @id`).run({ ...fields, id: req.params.id });

  if ('body' in fields) rebuildMentions(req.params.id, String(fields.body));

  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow;
  res.json({ ...row, pinned: !!row.pinned, collapsed: !!row.collapsed });
});

// ---- duplicate (deep-copies the page and all its descendants) ----
pagesRouter.post('/:id/duplicate', (req, res) => {
  const src = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow | undefined;
  if (!src) return res.status(404).json({ error: 'not_found' });
  const t = now();
  const childrenStmt = db.prepare('SELECT * FROM pages WHERE parent_id = ? ORDER BY position');
  const insert = db.prepare(
    `INSERT INTO pages (id, parent_id, kind, title, body, status, section, pinned, collapsed, word_count, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
  );
  let newRootId = '';
  const copyNode = (node: PageRow, parentId: string | null, position: number, isRoot: boolean) => {
    const id = newId();
    if (isRoot) newRootId = id;
    const title = isRoot ? `${node.title} (copy)` : node.title;
    insert.run(id, parentId, node.kind, title, node.body, node.status, node.section, node.pinned, node.word_count, position, t, t);
    if (node.body) rebuildMentions(id, node.body);
    const kids = childrenStmt.all(node.id) as PageRow[];
    kids.forEach((k, i) => copyNode(k, id, i, false));
  };
  // place the copy right after the source among its siblings
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), 0) AS m FROM pages WHERE parent_id IS ?')
    .get(src.parent_id) as { m: number };
  db.transaction(() => copyNode(src, src.parent_id, maxPos.m + 1, true))();
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(newRootId) as PageRow;
  res.json({ ...row, pinned: !!row.pinned, collapsed: !!row.collapsed });
});

// ---- move / reorder (set parent + position) ----
pagesRouter.post('/:id/move', (req, res) => {
  const { parent_id = null, position } = req.body ?? {};
  const t = now();
  db.prepare('UPDATE pages SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?').run(
    parent_id,
    position ?? 0,
    t,
    req.params.id,
  );
  res.json({ ok: true });
});

// ---- bulk reorder: [{id, parent_id, position}] ----
pagesRouter.post('/reorder', (req, res) => {
  const items: Array<{ id: string; parent_id: string | null; position: number }> = req.body?.items ?? [];
  const t = now();
  const upd = db.prepare('UPDATE pages SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?');
  const tx = db.transaction((rows: typeof items) => {
    for (const r of rows) upd.run(r.parent_id ?? null, r.position, t, r.id);
  });
  tx(items);
  res.json({ ok: true });
});

// ---- delete (cascades to children, mentions, flags, versions) ----
pagesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- pinned Lore Bible pages (for chat context) ----
pagesRouter.get('/meta/pinned', (_req, res) => {
  const rows = db.prepare('SELECT * FROM pages WHERE pinned = 1').all() as PageRow[];
  res.json(rows.map((r) => ({ ...r, pinned: true, text: htmlToText(r.body) })));
});
