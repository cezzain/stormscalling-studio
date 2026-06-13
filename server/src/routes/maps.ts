import { Router } from 'express';
import { db } from '../db.js';
import { now, newId } from '../util.js';

export const mapsRouter = Router();

// ---- list maps (with pins) ----
mapsRouter.get('/', (_req, res) => {
  const maps = db.prepare('SELECT * FROM maps ORDER BY position, created_at').all() as Array<{
    id: string;
    name: string;
    image_path: string | null;
    position: number;
  }>;
  const pinStmt = db.prepare('SELECT * FROM map_pins WHERE map_id = ? ORDER BY created_at');
  res.json(maps.map((m) => ({ ...m, pins: pinStmt.all(m.id) })));
});

// ---- create map ----
mapsRouter.post('/', (req, res) => {
  const { name = 'New map', image_path = null } = req.body ?? {};
  const id = newId();
  const order = (db.prepare('SELECT COALESCE(MAX(position),0) AS m FROM maps').get() as { m: number }).m + 1;
  db.prepare('INSERT INTO maps (id, name, image_path, position, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name,
    image_path,
    order,
    now(),
  );
  res.json(db.prepare('SELECT * FROM maps WHERE id = ?').get(id));
});

// ---- update map (rename / set image) ----
mapsRouter.patch('/:id', (req, res) => {
  const fields: Record<string, unknown> = {};
  for (const k of ['name', 'image_path', 'position'] as const) {
    if (k in (req.body ?? {})) fields[k] = req.body[k];
  }
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
  if (sets) db.prepare(`UPDATE maps SET ${sets} WHERE id = @id`).run({ ...fields, id: req.params.id });
  res.json(db.prepare('SELECT * FROM maps WHERE id = ?').get(req.params.id));
});

mapsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM maps WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- pins ----
mapsRouter.post('/:mapId/pins', (req, res) => {
  const { x, y, label = '', entity_id = null } = req.body ?? {};
  const id = newId();
  db.prepare('INSERT INTO map_pins (id, map_id, x, y, label, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id,
    req.params.mapId,
    x,
    y,
    label,
    entity_id,
    now(),
  );
  res.json(db.prepare('SELECT * FROM map_pins WHERE id = ?').get(id));
});

mapsRouter.patch('/pins/:pinId', (req, res) => {
  const fields: Record<string, unknown> = {};
  for (const k of ['x', 'y', 'label', 'entity_id'] as const) {
    if (k in (req.body ?? {})) fields[k] = req.body[k];
  }
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
  if (sets) db.prepare(`UPDATE map_pins SET ${sets} WHERE id = @id`).run({ ...fields, id: req.params.pinId });
  res.json(db.prepare('SELECT * FROM map_pins WHERE id = ?').get(req.params.pinId));
});

mapsRouter.delete('/pins/:pinId', (req, res) => {
  db.prepare('DELETE FROM map_pins WHERE id = ?').run(req.params.pinId);
  res.json({ ok: true });
});
