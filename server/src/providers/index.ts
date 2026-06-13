import { getSetting } from '../db.js';
import { DEFAULT_PROVIDER, DEFAULT_MODELS, type ProviderId } from '../config.js';
import type { ChatMessage } from './anthropic.js';
import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as google from './google.js';

export type { ChatMessage };

const REGISTRY = { anthropic, openai, google } as const;
const PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'google'];

/** The provider currently selected in Settings (falls back to the env/default). */
export function activeProvider(): ProviderId {
  const s = getSetting('ai_provider') as ProviderId | undefined;
  return s && REGISTRY[s] ? s : DEFAULT_PROVIDER;
}

/** The model chosen for a provider (Settings override → env/default). */
export function modelFor(pid: ProviderId): string {
  return getSetting(`model_${pid}`) || DEFAULT_MODELS[pid];
}

export function activeHasKey(pid: ProviderId = activeProvider()): boolean {
  return REGISTRY[pid].hasKey();
}

interface CompleteArgs {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export async function complete(args: CompleteArgs): Promise<string> {
  const pid = activeProvider();
  return REGISTRY[pid].complete({ ...args, model: modelFor(pid) });
}

export async function streamComplete(
  args: CompleteArgs,
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const pid = activeProvider();
  return REGISTRY[pid].streamComplete({ ...args, model: modelFor(pid) }, onText, signal);
}

/** Full AI status for Settings + the status endpoint. */
export function aiStatus() {
  const pid = activeProvider();
  return {
    provider: pid,
    label: REGISTRY[pid].label,
    model: modelFor(pid),
    hasKey: REGISTRY[pid].hasKey(),
    providers: PROVIDER_IDS.map((id) => ({
      id,
      label: REGISTRY[id].label,
      envVar: REGISTRY[id].envVar,
      hasKey: REGISTRY[id].hasKey(),
      model: modelFor(id),
      defaultModel: DEFAULT_MODELS[id],
      suggestedModels: REGISTRY[id].suggestedModels,
    })),
  };
}
