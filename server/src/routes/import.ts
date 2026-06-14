import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { DB_PATH, IMAGES_DIR } from '../config.js';
import { closeDatabase, reopenDatabase } from '../db.js';

export const importRouter = Router();

// Restores can be large (db + every image), so allow a generous limit and keep
// the upload in memory — we write it to disk ourselves.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });

const SQLITE_MAGIC = 'SQLite format 3\0';

function looksLikeSqlite(buf: Buffer): boolean {
  return buf.length >= 16 && buf.subarray(0, 16).toString('latin1') === SQLITE_MAGIC;
}
function looksLikeZip(buf: Buffer): boolean {
  // ZIP local file header / empty-archive / spanned markers all start with "PK".
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

// Remove the WAL/SHM sidecars so a restored db file isn't shadowed by stale
// journal data from the previous database.
function clearSidecars() {
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
}

function writeRawDb(buf: Buffer) {
  closeDatabase();
  clearSidecars();
  fs.writeFileSync(DB_PATH, buf);
}

// A backup zip (made by /api/export/backup) holds `storms-calling.db`, optional
// `-wal`/`-shm`, and an `images/` folder. Restore whichever of those it carries.
function restoreFromZip(buf: Buffer) {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();

  const dbEntry = entries.find((e) => !e.isDirectory && path.basename(e.entryName) === 'storms-calling.db');
  if (!dbEntry) throw new Error('zip_missing_db');

  closeDatabase();
  clearSidecars();
  fs.writeFileSync(DB_PATH, dbEntry.getData());

  // Optional WAL/SHM captured in the backup for a consistent snapshot.
  for (const ext of ['-wal', '-shm']) {
    const sidecar = entries.find((e) => !e.isDirectory && path.basename(e.entryName) === `storms-calling.db${ext}`);
    if (sidecar) fs.writeFileSync(DB_PATH + ext, sidecar.getData());
  }

  // Replace the images folder wholesale with the backup's images (if any).
  const imageEntries = entries.filter((e) => !e.isDirectory && /(^|\/)images\//.test(e.entryName));
  if (imageEntries.length) {
    fs.rmSync(IMAGES_DIR, { recursive: true, force: true });
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    for (const e of imageEntries) {
      const name = e.entryName.replace(/^.*?images\//, '');
      if (!name) continue;
      const dest = path.join(IMAGES_DIR, name);
      // Guard against path traversal in crafted archives.
      if (!dest.startsWith(IMAGES_DIR)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, e.getData());
    }
  }
}

// POST /api/import  (field name: "file") — accepts a .db file or a backup .zip.
importRouter.post('/', upload.single('file'), (req, res) => {
  const buf = req.file?.buffer;
  if (!buf || !buf.length) return res.status(400).json({ error: 'no_file' });

  try {
    if (looksLikeSqlite(buf)) {
      writeRawDb(buf);
    } else if (looksLikeZip(buf)) {
      restoreFromZip(buf);
    } else {
      return res.status(400).json({ error: 'unsupported_file', detail: 'Upload a .db file or a backup .zip.' });
    }
    reopenDatabase();
    return res.json({ ok: true });
  } catch (err: any) {
    // Whatever happened, make sure we have a working connection again.
    try {
      reopenDatabase();
    } catch {
      /* leave it; next request/restart will recover */
    }
    const code = err?.message === 'zip_missing_db' ? 'zip_missing_db' : 'import_failed';
    return res.status(400).json({ error: code, detail: String(err?.message ?? err) });
  }
});
