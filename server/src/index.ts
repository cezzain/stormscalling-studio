import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PORT, HOST, CLIENT_PORT, IMAGES_DIR, PROJECT_ROOT, SESSION_SECRET } from './config.js';
import './db.js'; // open DB + run schema + seed on boot
import { aiStatus } from './providers/index.js';
import { authRouter, requireAuth, authEnabled } from './auth.js';

import { pagesRouter } from './routes/pages.js';
import { entitiesRouter } from './routes/entities.js';
import { settingsRouter } from './routes/settings.js';
import { uploadsRouter } from './routes/uploads.js';
import { chatRouter } from './routes/chat.js';
import { aiRouter } from './routes/ai.js';
import { timelineRouter } from './routes/timeline.js';
import { mapsRouter } from './routes/maps.js';
import { searchRouter } from './routes/search.js';
import { versionsRouter } from './routes/versions.js';
import { exportRouter } from './routes/export.js';

// Resilience: never let a stray error take the whole API process down — log it
// and keep serving. The editor and data layer stay available no matter what.
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

const app = express();
// Behind a host's TLS proxy (Fly/Render/Railway/etc.) so req.ip is the real
// client and `secure` cookies are honoured.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '12mb' }));

// Auth: login / logout / status are public so the login screen can load.
app.use('/api/auth', authRouter);
// Everything else under /api requires a valid session (no-op when auth is off).
app.use('/api', requireAuth);

// Serve uploaded images at /uploads/<file> — also behind the login wall so
// manuscript/codex/map images aren't readable without a session.
app.use('/uploads', requireAuth, express.static(IMAGES_DIR, { maxAge: '1y', immutable: true }));

// Health / status
app.get('/api/status', (_req, res) => {
  const ai = aiStatus();
  res.json({ ok: true, provider: ai.provider, model: ai.model, hasKey: ai.hasKey });
});

// Feature routers
app.use('/api/pages', pagesRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/upload', uploadsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/ai', aiRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/maps', mapsRouter);
app.use('/api/search', searchRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/export', exportRouter);

// Serve the built client in production (single-port deployment).
const clientDist = path.join(PROJECT_ROOT, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message ?? 'internal_error' });
});

function lanUrls(port: number): string[] {
  const urls: string[] = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${port}`);
    }
  }
  return urls;
}

app.listen(PORT, HOST, () => {
  const banner = '═'.repeat(56);
  console.log('\n' + banner);
  console.log("  Storm's Calling Studio — backend running");
  console.log(banner);
  console.log(`  API (local):   http://localhost:${PORT}/api`);
  for (const u of lanUrls(PORT)) console.log(`  API (LAN):     ${u}/api`);
  const ai = aiStatus();
  console.log(`  AI provider:   ${ai.label}`);
  console.log(`  Model:         ${ai.model}`);
  console.log(`  API key:       ${ai.hasKey ? 'detected ✓' : `MISSING for ${ai.provider} — co-writer disabled (editor still works)`}`);
  console.log(`  Login:         ${authEnabled() ? 'ENABLED — username + password required ✓' : 'open (no login) — set AUTH_USERNAME + AUTH_PASSWORD to lock it down'}`);
  if (authEnabled() && !SESSION_SECRET) {
    console.log('  ⚠ SESSION_SECRET not set — the cookie signing key is derived from your password.');
    console.log('    For best security set SESSION_SECRET (e.g. `openssl rand -hex 32`).');
  }
  console.log('');
  console.log('  Frontend dev server (run together via `npm run dev`):');
  console.log(`    Local:   http://localhost:${CLIENT_PORT}`);
  for (const u of lanUrls(CLIENT_PORT)) console.log(`    LAN:     ${u}   ← open on iPad / iPhone (same WiFi)`);
  console.log(banner + '\n');
});
