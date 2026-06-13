import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { aiStatus } from '../providers/index.js';
import { parseJsonArray } from '../util.js';

export const settingsRouter = Router();

// ---- all settings + derived AI status + calendar ----
settingsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;

  const cal = db.prepare('SELECT * FROM calendar_config WHERE id = 1').get() as
    | { format: string; seasons: string; current_year: number }
    | undefined;

  res.json({
    settings,
    calendar: cal
      ? { format: cal.format, seasons: parseJsonArray<string>(cal.seasons), currentYear: cal.current_year }
      : null,
    ai: aiStatus(),
  });
});

// ---- update one or more settings ----
settingsRouter.patch('/', (req, res) => {
  const updates: Record<string, string> = req.body?.settings ?? {};
  for (const [k, v] of Object.entries(updates)) setSetting(k, String(v));
  res.json({ ok: true });
});

// ---- update calendar ----
settingsRouter.patch('/calendar', (req, res) => {
  const { format, seasons, currentYear } = req.body ?? {};
  const existing = db.prepare('SELECT * FROM calendar_config WHERE id = 1').get() as
    | { format: string; seasons: string; current_year: number }
    | undefined;
  const next = {
    format: format ?? existing?.format ?? 'Year [N] · [Season]',
    seasons: JSON.stringify(seasons ?? parseJsonArray(existing?.seasons) ?? []),
    current_year: currentYear ?? existing?.current_year ?? 312,
  };
  db.prepare(
    `INSERT INTO calendar_config (id, format, seasons, current_year) VALUES (1, @format, @seasons, @current_year)
     ON CONFLICT(id) DO UPDATE SET format = @format, seasons = @seasons, current_year = @current_year`,
  ).run(next);
  res.json({ ok: true });
});

export { getSetting };
