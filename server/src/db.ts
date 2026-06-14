import fs from 'node:fs';
import Database from 'better-sqlite3';
import { DATA_DIR, IMAGES_DIR, DB_PATH, DEFAULT_SYSTEM_PROMPT, DEFAULT_CALENDAR } from './config.js';

// Ensure local data directories exist before opening the database.
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

function openConnection(): Database.Database {
  const d = new Database(DB_PATH);
  d.pragma('journal_mode = WAL');
  d.pragma('synchronous = NORMAL');
  d.pragma('foreign_keys = ON');
  return d;
}

// `let` (not `const`) so a restore/import can swap the connection at runtime.
// ESM live bindings mean every module that imports `db` sees the new handle.
export let db = openConnection();

// ---------------------------------------------------------------------------
// Schema — idempotent. Covers every milestone's tables up front so no
// migrations are needed as features land.
// ---------------------------------------------------------------------------
const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT,
  kind        TEXT NOT NULL,                 -- book | part | chapter | page | folder
  title       TEXT NOT NULL DEFAULT 'Untitled',
  body        TEXT NOT NULL DEFAULT '',      -- TipTap HTML (leaf nodes)
  status      TEXT,                          -- draft | revised | done (scenes)
  section     TEXT NOT NULL DEFAULT 'manuscript', -- manuscript | lore (which tree the page lives in)
  pinned      INTEGER NOT NULL DEFAULT 0,    -- Lore Bible pin
  collapsed   INTEGER NOT NULL DEFAULT 0,
  word_count  INTEGER NOT NULL DEFAULT 0,
  position    REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id, position);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,                 -- character | nation | location | faction | concept
  name        TEXT NOT NULL,
  aliases     TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
  cover_image TEXT,                          -- /uploads/<file> path
  body        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type, name);

CREATE TABLE IF NOT EXISTS mentions (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (page_id)   REFERENCES pages(id)    ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mentions_entity ON mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_mentions_page ON mentions(page_id);

CREATE TABLE IF NOT EXISTS chat_threads (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT 'New thread',
  system_prompt TEXT,
  readonly      INTEGER NOT NULL DEFAULT 0,  -- 1 for imported claude.ai conversations
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  role       TEXT NOT NULL,                  -- user | assistant
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON chat_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS continuity_flags (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL,
  quote      TEXT NOT NULL,
  issue      TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  dismissed  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_flags_page ON continuity_flags(page_id);

CREATE TABLE IF NOT EXISTS timeline_events (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  in_world_date TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT 'var(--clay)',
  entity_ids    TEXT NOT NULL DEFAULT '[]', -- JSON array of entity ids
  scene_id      TEXT,                        -- optional link to a page
  sort_order    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_config (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  format       TEXT NOT NULL,
  seasons      TEXT NOT NULL,                -- JSON array
  current_year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS maps (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  image_path TEXT,                           -- /uploads/<file>
  position   REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS map_pins (
  id        TEXT PRIMARY KEY,
  map_id    TEXT NOT NULL,
  x         REAL NOT NULL,                   -- percentage 0..100
  y         REAL NOT NULL,                   -- percentage 0..100
  label     TEXT NOT NULL DEFAULT '',
  entity_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pins_map ON map_pins(map_id);

CREATE TABLE IF NOT EXISTS versions (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL,
  label      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  kind       TEXT NOT NULL DEFAULT 'auto',   -- auto | manual | safety
  created_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_versions_page ON versions(page_id, created_at);
`;

// ---------------------------------------------------------------------------
// Lightweight migrations — for databases created before a column existed.
// CREATE TABLE IF NOT EXISTS won't add new columns to an existing table, so
// add them here, guarded by a PRAGMA check so re-runs are no-ops.
// ---------------------------------------------------------------------------
function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}
function migrate() {
  if (!hasColumn('pages', 'section')) {
    db.exec("ALTER TABLE pages ADD COLUMN section TEXT NOT NULL DEFAULT 'manuscript'");
  }
}

// ---------------------------------------------------------------------------
// First-launch seed — minimal, no fake worldbuilding data.
// One "Getting started" page (per the empty-state requirement) + defaults.
// ---------------------------------------------------------------------------
const now = () => new Date().toISOString();

function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}
function setSetting(key: string, value: string) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

function seed() {
  if (getSetting('seeded') === '1') return;

  const t = now();
  // Default settings
  if (getSetting('system_prompt') === undefined) setSetting('system_prompt', DEFAULT_SYSTEM_PROMPT);
  if (getSetting('manuscript_font') === undefined) setSetting('manuscript_font', 'Lora');
  if (getSetting('manuscript_size') === undefined) setSetting('manuscript_size', '19');
  if (getSetting('theme') === undefined) setSetting('theme', 'light');

  // Default calendar
  const calExists = db.prepare('SELECT 1 FROM calendar_config WHERE id = 1').get();
  if (!calExists) {
    db.prepare(
      'INSERT INTO calendar_config (id, format, seasons, current_year) VALUES (1, ?, ?, ?)',
    ).run(DEFAULT_CALENDAR.format, JSON.stringify(DEFAULT_CALENDAR.seasons), DEFAULT_CALENDAR.currentYear);
  }

  // A single welcome page so the app is navigable but contains no fake lore.
  const pageCount = (db.prepare('SELECT COUNT(*) AS n FROM pages').get() as { n: number }).n;
  if (pageCount === 0) {
    const id = crypto.randomUUID();
    const body = `<h1>Getting started</h1>
<p>Welcome to <strong>Storm's Calling Studio</strong> — your private, local-first writing desk. Everything lives on this machine, in <code>./data/</code>. Nothing is uploaded anywhere except the requests you choose to send to your AI co-writer.</p>
<p>A few things worth knowing:</p>
<ul>
<li><strong>Write here.</strong> This is a full rich-text editor. Type <code>/</code> for the block menu, select text to bring up the AI writing tools, and your work autosaves as you go.</li>
<li><strong>@-mentions.</strong> Type <code>@</code> to link a character, place, faction, or concept from your Codex. Hover a mention to preview it; click to open its page.</li>
<li><strong>Pin a Lore Bible.</strong> Mark any page as your Lore Bible and it becomes a one-click context toggle for the AI co-writer, so your canon travels with every question.</li>
<li><strong>Check continuity.</strong> Ask the co-writer to scan a scene against your codex and Lore Bible for contradictions — age drift, name changes, broken timelines.</li>
<li><strong>Import a conversation.</strong> Paste a chat from claude.ai into a read-only thread to keep your planning beside your draft.</li>
</ul>
<p>When you're ready, make a Book in the sidebar and begin. The storm is already turning toward the shore.</p>`;
    const wc = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    db.prepare(
      `INSERT INTO pages (id, parent_id, kind, title, body, status, pinned, word_count, position, created_at, updated_at)
       VALUES (?, NULL, 'page', 'Getting started', ?, NULL, 0, ?, 0, ?, ?)`,
    ).run(id, body, wc, t, t);
  }

  setSetting('seeded', '1');
}

// Apply schema + migrations + seed to the current connection. Idempotent, so
// it's safe to run on first boot and again after a restore swaps the file.
function prepare() {
  db.exec(SCHEMA);
  migrate();
  seed();
}
prepare();

/** Close the live connection (e.g. before overwriting the db file on restore). */
export function closeDatabase() {
  try {
    db.close();
  } catch {
    /* already closed */
  }
}

/** Re-open the db file into a fresh connection and re-apply schema/seed. */
export function reopenDatabase() {
  closeDatabase();
  db = openConnection();
  prepare();
}

export { getSetting, setSetting };
