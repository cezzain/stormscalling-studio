import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Router } from 'express';
import { AUTH_USERNAME, AUTH_PASSWORD, SESSION_SECRET, IS_PROD } from './config.js';

// ---------------------------------------------------------------------------
// Single-user authentication.
//
// The whole point: when AUTH_USERNAME + AUTH_PASSWORD are configured (i.e. on a
// deployment), every API route and every uploaded image sits behind a login.
// Locally, with those env vars unset, auth is OFF and the studio behaves exactly
// as before — no login wall, fully local-first.
//
// The session is a stateless, HMAC-signed, http-only cookie (no DB, no store),
// so it survives restarts and works on ephemeral hosts. No third-party deps.
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'scs_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Auth is enforced only when both credentials are provided. */
export function authEnabled(): boolean {
  return AUTH_USERNAME.length > 0 && AUTH_PASSWORD.length > 0;
}

/** Signing key: explicit SESSION_SECRET, else derived from the credentials. */
function signingKey(): Buffer {
  const material = SESSION_SECRET || `${AUTH_USERNAME}:${AUTH_PASSWORD}`;
  return crypto.createHash('sha256').update(material).digest();
}

/** Constant-time string compare that never short-circuits on length. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  // Compare a fixed-size HMAC of each so timing is independent of length too.
  const key = signingKey();
  const ha = crypto.createHmac('sha256', key).update(ab).digest();
  const hb = crypto.createHmac('sha256', key).update(bb).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a signed token: base64url(payload).base64url(hmac). */
function makeToken(username: string): string {
  const payload = JSON.stringify({ u: username, iat: Date.now() });
  const p = b64url(Buffer.from(payload, 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', signingKey()).update(p).digest());
  return `${p}.${sig}`;
}

/** Verify a token's signature, age, and that it matches the current user. */
function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const p = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(crypto.createHmac('sha256', signingKey()).update(p).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const json = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (json.u !== AUTH_USERNAME) return false; // username changed → old sessions invalid
    if (typeof json.iat !== 'number' || Date.now() - json.iat > SESSION_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

/** Minimal Cookie-header parser (avoids a cookie-parser dependency). */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD, // requires HTTPS in production; hosts terminate TLS for us
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/' });
}

/** True if the request carries a valid session (or auth is disabled). */
export function isAuthed(req: Request): boolean {
  if (!authEnabled()) return true;
  return verifyToken(readCookie(req, COOKIE_NAME));
}

/** Express middleware: 401s any unauthenticated request when auth is on. */
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'unauthorized' });
};

// ---- brute-force throttle: per-IP failed-attempt backoff ------------------
// Entries carry an expiry so the Map stays bounded even under an IP-spoofing
// flood (no unbounded growth / OOM); a hard size cap is the final backstop.
const attempts = new Map<string, { count: number; until: number; exp: number }>();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;   // lockout window after too many failures
const ATTEMPT_TTL_MS = LOCK_MS;   // forget an IP after this much inactivity
const MAX_TRACKED_IPS = 10_000;   // backstop against memory exhaustion
const FAIL_DELAY_MS = 400;        // slow every failed guess (anti-brute-force)

/** Behind Fly the true client IP is in `Fly-Client-IP` (the edge overwrites it,
 *  so it can't be forged); elsewhere fall back to Express's req.ip. */
function clientIp(req: Request): string {
  const fly = req.headers['fly-client-ip'];
  if (typeof fly === 'string' && fly) return fly;
  return (req.ip || req.socket.remoteAddress || 'unknown').toString();
}

/** Drop expired entries; if still over the cap, clear all (degrade throttling
 *  rather than leak memory — the strong password is the real line of defence). */
function sweepAttempts(now: number) {
  for (const [ip, rec] of attempts) {
    if (rec.exp <= now && rec.until <= now) attempts.delete(ip);
  }
  if (attempts.size > MAX_TRACKED_IPS) attempts.clear();
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---- routes ---------------------------------------------------------------
export const authRouter = Router();

// Public: lets the client decide whether to show the login screen.
authRouter.get('/status', (req, res) => {
  res.json({ authRequired: authEnabled(), authed: isAuthed(req) });
});

authRouter.post('/login', async (req, res) => {
  if (!authEnabled()) return res.json({ ok: true }); // no-op when auth is off
  const now = Date.now();
  const ip = clientIp(req);
  sweepAttempts(now);

  const rec = attempts.get(ip);
  if (rec && rec.until > now) {
    const mins = Math.ceil((rec.until - now) / 60000);
    return res.status(429).json({ error: `Too many attempts. Try again in ${mins} min.` });
  }

  const username = String(req.body?.username ?? '');
  const password = String(req.body?.password ?? '');
  // Evaluate BOTH comparisons (no &&-short-circuit) so response timing can't
  // reveal whether it was the username or the password that was wrong.
  const userOk = safeEqual(username, AUTH_USERNAME);
  const passOk = safeEqual(password, AUTH_PASSWORD);

  if (!(userOk && passOk)) {
    const count = (rec?.count ?? 0) + 1;
    attempts.set(ip, {
      count,
      until: count >= MAX_ATTEMPTS ? now + LOCK_MS : 0,
      exp: now + ATTEMPT_TTL_MS,
    });
    await delay(FAIL_DELAY_MS); // throttle online guessing
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  attempts.delete(ip);
  setSessionCookie(res, makeToken(AUTH_USERNAME));
  res.json({ ok: true });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
