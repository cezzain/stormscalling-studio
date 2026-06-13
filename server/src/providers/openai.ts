import OpenAI from 'openai';
import type { ChatMessage, CompleteOpts } from './anthropic.js';

export const label = 'ChatGPT (OpenAI)';
export const envVar = 'OPENAI_API_KEY';
export const suggestedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'];

let client: OpenAI | null = null;
function c(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function hasKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function toMessages(system: string | undefined, messages: ChatMessage[]) {
  const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (system) out.push({ role: 'system', content: system });
  for (const m of messages) out.push({ role: m.role, content: m.content });
  return out;
}

export async function complete(opts: CompleteOpts): Promise<string> {
  const res = await c().chat.completions.create({
    model: opts.model,
    messages: toMessages(opts.system, opts.messages),
    max_completion_tokens: opts.maxTokens ?? 4096,
  } as any);
  return (res.choices[0]?.message?.content ?? '').trim();
}

export async function streamComplete(
  opts: CompleteOpts,
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const stream = await c().chat.completions.create(
    {
      model: opts.model,
      messages: toMessages(opts.system, opts.messages),
      max_completion_tokens: opts.maxTokens ?? 8192,
      stream: true,
    } as any,
    { signal },
  );
  let full = '';
  for await (const chunk of stream as any) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) {
      full += delta;
      onText(delta);
    }
  }
  return full;
}
