import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { IMAGES_DIR } from '../config.js';
import { newId } from '../util.js';

export const uploadsRouter = Router();

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED[file.mimetype] ?? path.extname(file.originalname).replace('.', '') ?? 'bin';
    cb(null, `${newId()}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, Boolean(ALLOWED[file.mimetype])),
});

// POST /api/upload  (field name: "file") -> { url, path }
uploadsRouter.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  // Served by express.static at /uploads (see index.ts).
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});
