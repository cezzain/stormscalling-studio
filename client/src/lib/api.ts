import type {
  Page, Entity, ChatThread, ChatMessage, ContinuityFlag, TimelineEvent,
  WorldMap, CalendarConfig, VersionMeta, ContextToggles, SearchGroup, AiStatus,
} from './types';

const BASE = '/api';

async function j<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', // carry the session cookie
    ...opts,
  });
  // Session expired or missing while auth is on — let the app fall back to the
  // login screen instead of surfacing a raw error everywhere.
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('scs:unauthorized'));
    throw new Error('401 unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  status: () => j<{ ok: boolean; provider: string; model: string; hasKey: boolean }>('/status'),

  // ---- auth (single-user login) ----
  auth: {
    // Public — tells the client whether a login wall is active and if we're in.
    status: () => j<{ authRequired: boolean; authed: boolean }>('/auth/status'),
    // Dedicated fetch so we can surface the server's exact error/lockout message.
    login: async (username: string, password: string): Promise<{ ok: boolean }> => {
      const res = await fetch(BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || 'Sign in failed. Please try again.');
      return data;
    },
    logout: () => j<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  },

  // ---- pages ----
  pages: {
    list: () => j<Page[]>('/pages'),
    get: (id: string) => j<Page>(`/pages/${id}`),
    create: (data: Partial<Page>) => j<Page>('/pages', { method: 'POST', body: JSON.stringify(data) }),
    duplicate: (id: string) => j<Page>(`/pages/${id}/duplicate`, { method: 'POST' }),
    update: (id: string, data: Partial<Page>) => j<Page>(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    move: (id: string, parent_id: string | null, position: number) =>
      j(`/pages/${id}/move`, { method: 'POST', body: JSON.stringify({ parent_id, position }) }),
    reorder: (items: Array<{ id: string; parent_id: string | null; position: number }>) =>
      j('/pages/reorder', { method: 'POST', body: JSON.stringify({ items }) }),
    remove: (id: string) => j(`/pages/${id}`, { method: 'DELETE' }),
    pinned: () => j<Array<Page & { text: string }>>('/pages/meta/pinned'),
  },

  // ---- entities ----
  entities: {
    list: () => j<Entity[]>('/entities'),
    search: (q: string) => j<Entity[]>(`/entities/search?q=${encodeURIComponent(q)}`),
    get: (id: string) => j<Entity>(`/entities/${id}`),
    create: (data: Partial<Entity>) => j<Entity>('/entities', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Entity>) => j<Entity>(`/entities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => j(`/entities/${id}`, { method: 'DELETE' }),
  },

  // ---- settings ----
  settings: {
    get: () => j<{ settings: Record<string, string>; calendar: CalendarConfig | null; ai: AiStatus }>('/settings'),
    update: (settings: Record<string, string>) => j('/settings', { method: 'PATCH', body: JSON.stringify({ settings }) }),
    updateCalendar: (cal: Partial<CalendarConfig>) => j('/settings/calendar', { method: 'PATCH', body: JSON.stringify(cal) }),
  },

  // ---- upload ----
  upload: async (file: File): Promise<{ url: string; filename: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(BASE + '/upload', { method: 'POST', body: form, credentials: 'same-origin' });
    if (!res.ok) throw new Error('upload failed');
    return res.json();
  },

  // ---- import / restore (a .db file or a backup .zip) ----
  importBackup: async (file: File): Promise<{ ok: true }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(BASE + '/import', { method: 'POST', body: form, credentials: 'same-origin' });
    if (!res.ok) {
      let detail = 'import failed';
      try {
        const body = await res.json();
        detail = body.detail || body.error || detail;
      } catch {
        /* non-JSON error */
      }
      throw new Error(detail);
    }
    return res.json();
  },

  // ---- chat ----
  chat: {
    threads: () => j<ChatThread[]>('/chat/threads'),
    create: (title?: string) => j<ChatThread>('/chat/threads', { method: 'POST', body: JSON.stringify({ title }) }),
    messages: (id: string) => j<{ thread: ChatThread; messages: ChatMessage[] }>(`/chat/threads/${id}/messages`),
    rename: (id: string, title: string) => j(`/chat/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
    setSystemPrompt: (id: string, system_prompt: string) =>
      j(`/chat/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ system_prompt }) }),
    remove: (id: string) => j(`/chat/threads/${id}`, { method: 'DELETE' }),
    import: (text: string, title?: string) => j<{ id: string; count: number }>('/chat/import', { method: 'POST', body: JSON.stringify({ text, title }) }),
  },

  // ---- ai ----
  ai: {
    contextEstimate: (body: { scenePageId?: string | null; scene?: boolean; chapter?: boolean; codex?: boolean; lore?: boolean; codexIds?: string[] }) =>
      j<{ tokens: number; hasContext: boolean }>('/ai/context-estimate', { method: 'POST', body: JSON.stringify(body) }),
    inline: (body: { tool: string; text: string; instruction?: string; scenePageId?: string | null }) =>
      j<{ suggestion: string }>('/ai/inline', { method: 'POST', body: JSON.stringify(body) }),
    continuityRun: (pageId: string) => j<{ flags: ContinuityFlag[] }>('/ai/continuity', { method: 'POST', body: JSON.stringify({ pageId }) }),
    continuityGet: (pageId: string) => j<{ flags: ContinuityFlag[] }>(`/ai/continuity/${pageId}`),
    continuityDismiss: (flagId: string) => j(`/ai/continuity/${flagId}/dismiss`, { method: 'POST' }),
  },

  // ---- timeline ----
  timeline: {
    list: () => j<TimelineEvent[]>('/timeline'),
    create: (data: Partial<TimelineEvent>) => j<TimelineEvent>('/timeline', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<TimelineEvent>) => j<TimelineEvent>(`/timeline/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => j(`/timeline/${id}`, { method: 'DELETE' }),
  },

  // ---- maps ----
  maps: {
    list: () => j<WorldMap[]>('/maps'),
    create: (data: { name?: string; image_path?: string | null }) => j<WorldMap>('/maps', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; image_path?: string | null }) => j<WorldMap>(`/maps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => j(`/maps/${id}`, { method: 'DELETE' }),
    addPin: (mapId: string, pin: { x: number; y: number; label?: string; entity_id?: string | null }) =>
      j(`/maps/${mapId}/pins`, { method: 'POST', body: JSON.stringify(pin) }),
    updatePin: (pinId: string, data: { x?: number; y?: number; label?: string; entity_id?: string | null }) =>
      j(`/maps/pins/${pinId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removePin: (pinId: string) => j(`/maps/pins/${pinId}`, { method: 'DELETE' }),
  },

  // ---- search ----
  search: (q: string) => j<{ groups: SearchGroup[] }>(`/search?q=${encodeURIComponent(q)}`),

  // ---- versions ----
  versions: {
    list: (pageId: string) => j<VersionMeta[]>(`/versions/${pageId}`),
    get: (id: string) => j<{ id: string; body: string; title: string }>(`/versions/one/${id}`),
    snapshot: (pageId: string, label = '', kind: 'auto' | 'manual' | 'safety' = 'auto') =>
      j<{ id: string }>(`/versions/${pageId}`, { method: 'POST', body: JSON.stringify({ label, kind }) }),
    restore: (versionId: string) => j(`/versions/restore/${versionId}`, { method: 'POST' }),
  },

  // ---- export (returns download URLs) ----
  exportUrls: {
    page: (id: string, format: 'md' | 'docx') => `${BASE}/export/page/${id}?format=${format}`,
    codex: () => `${BASE}/export/codex`,
    backup: () => `${BASE}/export/backup`,
  },
};

/**
 * Stream a co-writer reply over SSE. Calls onDelta for each text chunk.
 * Resolves with {threadId}. Rejects/aborts via the returned controller.
 */
export function streamChat(
  body: {
    threadId?: string;
    message: string;
    context: ContextToggles;
    scenePageId?: string | null;
    codexIds?: string[];
  },
  handlers: {
    onThread?: (id: string) => void;
    onDelta: (text: string) => void;
    onError: (msg: string, code?: string) => void;
    onDone: (threadId?: string) => void;
  },
): AbortController {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch(BASE + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('scs:unauthorized'));
        throw new Error('401 unauthorized');
      }
      if (!res.body) throw new Error('no stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split('\n\n');
        buf = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          const parsed = JSON.parse(data);
          if (event === 'thread') handlers.onThread?.(parsed.id);
          else if (event === 'delta') handlers.onDelta(parsed.text);
          else if (event === 'error') handlers.onError(parsed.message, parsed.code);
          else if (event === 'done') handlers.onDone(parsed.threadId);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') handlers.onError(err?.message ?? 'Stream failed.');
    }
  })();
  return controller;
}
