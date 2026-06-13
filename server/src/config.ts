import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Resolve the project root from this file's location so paths are stable
// regardless of the working directory `npm run dev` is launched from.
// .../server/src/config.ts -> project root is two levels up from src.
const __filename = fileURLToPath(import.meta.url);
const SRC_DIR = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(SRC_DIR, '..', '..');

// Load .env from the project root (single source of truth for the key).
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

// ---- Filesystem layout (all local, all under ./data) ----
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const DB_PATH = path.join(DATA_DIR, 'storms-calling.db');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');

// ---- Network ----
// Use a dedicated SERVER_PORT (not the generic PORT) so the backend never
// collides with a frontend dev/preview server that consumes PORT itself.
export const PORT = Number(process.env.SERVER_PORT ?? 5174);
export const HOST = process.env.HOST ?? '0.0.0.0';
// The Vite frontend port — only used for the startup banner so the printed
// URLs match. Keep in sync with client/vite.config.ts (default 3000).
export const CLIENT_PORT = Number(process.env.CLIENT_PORT ?? 3000);

// ---- AI providers (Claude / ChatGPT / Gemini) ----
export type ProviderId = 'anthropic' | 'openai' | 'google';

// Current latest Opus-class model (confirmed via the claude-api reference).
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-4-8';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
// Backwards-compatible Anthropic key check (the original single-provider helper).
export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

// Which provider to use when none is chosen in Settings.
export const DEFAULT_PROVIDER: ProviderId = (['anthropic', 'openai', 'google'].includes(
  process.env.AI_PROVIDER as string,
)
  ? (process.env.AI_PROVIDER as ProviderId)
  : 'anthropic');

// Default model per provider (each overridable from Settings or .env).
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: process.env.CLAUDE_MODEL ?? 'claude-opus-4-8',
  openai: process.env.OPENAI_MODEL ?? 'gpt-4o',
  google: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
};

// Default co-writer system prompt (editable in Settings; persisted to DB).
export const DEFAULT_SYSTEM_PROMPT = `You are the co-writer for a private fantasy-fiction studio called Storm's Calling.
You help the author draft, revise, and reason about their manuscript and world.
You are a thoughtful, plain-spoken editor: specific, concrete, and honest. Favour the physical and the sensory over the abstract. Never flatter.
You never rewrite the author's text unless explicitly asked. When you suggest prose, keep their voice — match diction, rhythm, and tense.
When given scene, chapter, codex, or Lore Bible context, treat it as canon and stay consistent with it.`;

// ---- Inline AI writing-tool instructions (M4) ----
// Each takes the user's selected passage as the working text. Kept here so they
// can be tuned in one place. Outputs are returned verbatim into the diff panel;
// the author never has text changed without an explicit Accept.
export const INLINE_PROMPTS = {
  tighten:
    "Tighten the following passage. Cut filler, redundancy, and throat-clearing; prefer strong nouns and verbs; keep every concrete image and the author's voice, diction, and tense. Do not add new information or change the meaning. Return only the revised prose, no preamble, no quotation marks.",
  sensory:
    "Revise the following passage to be more sensory and grounded in the body. Add precise concrete detail across sight, sound, smell, touch, and temperature where it earns its place; cut abstraction and stated emotion in favour of physical evidence. Keep the author's voice, length within ~30%, and meaning. Return only the revised prose, no preamble, no quotation marks.",
  continue:
    "Continue the following passage with roughly 150 words that follow naturally from it. Match the author's voice, diction, tense, and rhythm exactly; advance the scene with restraint and concrete detail; do not summarize or wrap up. Return only the continuation prose (do not repeat the original), no preamble, no quotation marks.",
  custom:
    "Apply the author's instruction to the following passage. Preserve their voice, tense, and meaning unless the instruction says otherwise. Return only the revised prose, no preamble, no quotation marks.",
} as const;

// Continuity checker (M4) — must return a strict JSON array.
export const CONTINUITY_PROMPT = `You are a continuity editor for a fantasy manuscript. Read the SCENE below together with the provided CONTEXT (codex entries, Lore Bible, nearby scenes). Find concrete continuity problems: contradictions of established facts (ages, names, places, timelines), name drift, physical impossibilities, and inconsistencies with the codex or Lore Bible.

Respond with ONLY a JSON array (no prose, no markdown fences). Each element:
{ "quote": "<short exact quote from the scene that triggers the flag>", "issue": "<2-5 word label, e.g. 'Age conflict'>", "suggestion": "<one sentence on how to reconcile>" }

If there are no continuity issues, respond with exactly: []`;

// Default in-world calendar (Settings → World), echoing the mockup.
export const DEFAULT_CALENDAR = {
  format: 'Year [N] · [Season]',
  seasons: ['Ashfall', 'Low Tide', 'Saltfall', 'Highstorm'],
  currentYear: 312,
};
