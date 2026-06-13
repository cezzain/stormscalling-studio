import { GoogleGenAI } from '@google/genai';
import type { ChatMessage, CompleteOpts } from './anthropic.js';

export const label = 'Gemini (Google)';
export const envVar = 'GEMINI_API_KEY';
export const suggestedModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro'];

function key(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

let ai: GoogleGenAI | null = null;
function c(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: key() });
  return ai;
}

export function hasKey(): boolean {
  return Boolean(key()?.trim());
}

// Gemini uses 'user' / 'model' roles and a separate systemInstruction.
function toContents(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

export async function complete(opts: CompleteOpts): Promise<string> {
  const res = await c().models.generateContent({
    model: opts.model,
    contents: toContents(opts.messages),
    config: { systemInstruction: opts.system, maxOutputTokens: opts.maxTokens ?? 4096 },
  } as any);
  return ((res as any).text ?? '').trim();
}

export async function streamComplete(
  opts: CompleteOpts,
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const stream = await c().models.generateContentStream({
    model: opts.model,
    contents: toContents(opts.messages),
    config: { systemInstruction: opts.system, maxOutputTokens: opts.maxTokens ?? 8192 },
  } as any);
  let full = '';
  for await (const chunk of stream as any) {
    if (signal?.aborted) break;
    const delta = chunk?.text;
    if (delta) {
      full += delta;
      onText(delta);
    }
  }
  return full;
}
