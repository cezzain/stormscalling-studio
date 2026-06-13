import { Router } from 'express';
import { db } from '../db.js';
import { now, newId, parseJsonArray } from '../util.js';

export const timelineRouter = Router();

interface EventRow {
  id: string;
  title: string;
  in_world_date: string;
  description: string;
  color: string;
  entity_ids: string;
  scene_id: string | null;
  sort_order: number;
}

const hydrate = (r: EventRow) => ({ ...r, entity_ids: parseJsonArray<string>(r.entity_ids) });

timelineRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM timeline_events ORDER BY sort_order, created_at').all() as EventRow[];
  res.json(rows.map(hydrate));
});

timelineRouter.post('/', (req, res) => {
  const {
    title = 'New event',
    in_world_date = '',
    description = '',
    color = 'var(--clay)',
    entity_ids = [],
    scene_id = null,
    sort_order,
  } = req.body ?? {};
  const id = newId();
  const t = now();
  const order =
    sort_order ??
    ((db.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM timeline_events').get() as { m: number }).m + 1);
  db.prepare(
    `INSERT INTO timeline_events (id, title, in_world_date, description, color, entity_ids, scene_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, title, in_world_date, description, color, JSON.stringify(entity_ids), scene_id, order, t, t);
  const row = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(id) as EventRow;
  res.json(hydrate(row));
});

timelineRouter.patch('/:id', (req, res) => {
  const fields: Record<string, unknown> = {};
  for (const k of ['title', 'in_world_date', 'description', 'color', 'scene_id', 'sort_order'] as const) {
    if (k in (req.body ?? {})) fields[k] = req.body[k];
  }
  if ('entity_ids' in (req.body ?? {})) fields.entity_ids = JSON.stringify(req.body.entity_ids ?? []);
  fields.updated_at = now();
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE timeline_events SET ${sets} WHERE id = @id`).run({ ...fields, id: req.params.id });
  const row = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.id) as EventRow;
  res.json(hydrate(row));
});

timelineRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM timeline_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
