// Lightweight, dependency-free HTML -> Markdown for manuscript/codex export.
// Handles the subset TipTap produces: headings, paragraphs, bold/italic/strike,
// lists, blockquotes, horizontal rules, links, images, and mention spans.

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let s = html;

  // normalise self-closing breaks
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // images
  s = s.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '![$1]($2)');
  s = s.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');

  // mentions -> @name (text content of the span)
  s = s.replace(/<span[^>]*data-(?:entity|id)="[^"]*"[^>]*>@?([^<]*)<\/span>/gi, '@$1');

  // links
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // inline marks
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*');
  s = s.replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~');
  s = s.replace(/<del>([\s\S]*?)<\/del>/gi, '~~$1~~');
  s = s.replace(/<u>([\s\S]*?)<\/u>/gi, '$1');
  s = s.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

  // headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');

  // blockquote
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) =>
    '\n' +
    inner
      .replace(/<\/?p[^>]*>/gi, '')
      .trim()
      .split('\n')
      .map((l: string) => '> ' + l.trim())
      .join('\n') +
    '\n',
  );

  // lists
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) => '\n' + listItems(inner, '- ') + '\n');
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => '\n' + listItems(inner, '1. ') + '\n');

  // horizontal rule
  s = s.replace(/<hr[^>]*\/?>/gi, '\n---\n');

  // paragraphs / divs -> blank-line separated
  s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  s = s.replace(/<p[^>]*>/gi, '');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<\/?div[^>]*>/gi, '\n');

  // strip any remaining tags
  s = s.replace(/<[^>]+>/g, '');

  // decode common entities
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // collapse excess blank lines
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function listItems(inner: string, marker: string): string {
  const items = inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
  return items
    .map((li) =>
      marker +
      li
        .replace(/<\/?li[^>]*>/gi, '')
        .replace(/<\/?p[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim(),
    )
    .join('\n');
}
