import Anthropic from '@anthropic-ai/sdk';

export const label = 'Claude (Anthropic)';
export const envVar = 'ANTHROPIC_API_KEY';
export const suggestedModels = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'];

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface CompleteOpts {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  model: string;
}

let client: Anthropic | null = null;
function c(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function complete(opts: CompleteOpts): Promise<string> {
  const res = await c().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    thinking: { type: 'adaptive' },
    system: opts.system,
    messages: opts.messages,
  } as any);
  let text = '';
  for (const block of res.content) if (block.type === 'text') text += block.text;
  return text.trim();
}

export async function streamComplete(
  opts: CompleteOpts,
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const stream = c().messages.stream(
    {
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8192,
      thinking: { type: 'adaptive' },
      system: opts.system,
      messages: opts.messages,
    } as any,
    { signal },
  );
  let full = '';
  stream.on('text', (delta: string) => {
    full += delta;
    onText(delta);
  });
  await stream.finalMessage();
  return full;
}
