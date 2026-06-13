import { Router } from 'express';
import { db } from '../db.js';
import { now, newId, htmlToText, parseJsonArray } from '../util.js';

export const entitiesRouter = Router();

interface EntityRow {
  id: string;
  type: string;
  name: string;
  aliases: string;
  cover_image: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

const hydrate = (r: EntityRow) => ({ ...r, aliases: parseJsonArray<string>(r.aliases) });

// ---- list all (client groups by type) ----
entitiesRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM entities ORDER BY type, name').all() as EntityRow[];
  res.json(rows.map(hydrate));
});

// ---- search for the @-mention dropdown + quick-create resolution ----
entitiesRouter.get('/search', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM entities').all() as EntityRow[];
  const scored = rows
    .map(hydrate)
    .map((e) => {
      const hay = [e.name, ...e.aliases].map((s) => s.toLowerCase());
      let score = -1;
      for (const h of hay) {
        if (!q) score = Math.max(score, 0);
        else if (h === q) score = Math.max(score, 3);
        else if (h.startsWith(q)) score = Math.max(score, 2);
        else if (h.includes(q)) score = Math.max(score, 1);
      }
      return { e, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, 8)
    .map((x) => x.e);
  res.json(scored);
});

// ---- single entity + backlinks (computed on read) ----
entitiesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id) as EntityRow | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });

  const backlinkRows = db
    .prepare(
      `SELECT p.id, p.title, p.body, p.parent_id
       FROM mentions m JOIN pages p ON p.id = m.page_id
       WHERE m.entity_id = ?`,
    )
    .all(req.params.id) as Array<{ id: string; title: string; body: string; parent_id: string | null }>;

  const backlinks = backlinkRows.map((b) => {
    const text = htmlToText(b.body);
    // crude snippet: first ~160 chars of the page text
    const snippet = text.length > 170 ? text.slice(0, 170) : text;
    // build a location breadcrumb from ancestors
    let loc = '';
    let pid = b.parent_id;
    const crumbs: string[] = [];
    let guard = 0;
    while (pid && guard++ < 8) {
      const p = db.prepare('SELECT title, parent_id FROM pages WHERE id = ?').get(pid) as
        | { title: string; parent_id: string | null }
        | undefined;
      if (!p) break;
      crumbs.unshift(p.title);
      pid = p.parent_id;
    }
    loc = crumbs.join(' · ');
    return { pageId: b.id, title: b.title, loc, snippet };
  });

  res.json({ ...hydrate(row), backlinks });
});

// ---- create ----
entitiesRouter.post('/', (req, res) => {
  const { type = 'character', name = 'Untitled', aliases = [], cover_image = null, body = '' } = req.body ?? {};
  const id = newId();
  const t = now();
  db.prepare(
    `INSERT INTO entities (id, type, name, aliases, cover_image, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, type, name, JSON.stringify(aliases), cover_image, body, t, t);
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as EntityRow;
  res.json(hydrate(row));
});

// ---- update ----
entitiesRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id) as EntityRow | undefined;
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const fields: Record<string, unknown> = {};
  for (const k of ['type', 'name', 'cover_image', 'body'] as const) {
    if (k in (req.body ?? {})) fields[k] = req.body[k];
  }
  if ('aliases' in (req.body ?? {})) fields.aliases = JSON.stringify(req.body.aliases ?? []);
  fields.updated_at = now();
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE entities SET ${sets} WHERE id = @id`).run({ ...fields, id: req.params.id });
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id) as EntityRow;
  res.json(hydrate(row));
});

// ---- delete ----
entitiesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM entities WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
