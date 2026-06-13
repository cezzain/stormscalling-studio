// Small server-side helpers shared across routes.

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

/** Strip HTML tags to plain text (good enough for word counts + search snippets). */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|br)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(html: string): number {
  const t = htmlToText(html);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/**
 * Extract referenced entity ids from a page body. The editor renders mentions
 * as <span data-entity="<id>"> (mockup convention) and TipTap's mention node as
 * <span data-type="mention" data-id="<id>">. Capture both.
 */
export function extractEntityIds(html: string): string[] {
  const ids = new Set<string>();
  const re1 = /data-entity="([^"]+)"/g;
  const re2 = /data-type="mention"[^>]*data-id="([^"]+)"/g;
  const re3 = /data-id="([^"]+)"[^>]*data-type="mention"/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html))) ids.add(m[1]);
  while ((m = re2.exec(html))) ids.add(m[1]);
  while ((m = re3.exec(html))) ids.add(m[1]);
  return [...ids];
}

/** Rough token estimate (~4 chars/token) for the context-size readout. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function parseJsonArray<T = unknown>(s: string | null | undefined): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
