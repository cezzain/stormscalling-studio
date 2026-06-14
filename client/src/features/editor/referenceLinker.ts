import type { Editor } from '@tiptap/core';
import type { Entity } from '../../lib/types';

// Turns text into codex references in two ways:
//   1. Underline a name  → link it (creating a Character if it's new).
//   2. Type a known name → auto-underline/link it (existing entries only).
// Only deliberate underlining ever creates a new entity, so typing never
// fills the codex with junk.

interface LinkerOpts {
  getEntities: () => Entity[];
  createCharacter: (name: string) => Promise<Entity>;
}

// A run of underlined text in the document.
interface Run {
  from: number;
  to: number;
  text: string;
}

// Guard against re-entrancy while an async character-create is in flight.
let busy = false;

function buildNameMap(entities: Entity[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entities) {
    if (e.name) map.set(e.name.trim().toLowerCase(), e.id);
    for (const a of e.aliases ?? []) if (a) map.set(a.trim().toLowerCase(), e.id);
  }
  return map;
}

// A reasonable "this is a name" heuristic so underlining a whole sentence
// doesn't spawn a character. Existing entries are linked regardless of this.
function isNameLike(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 50) return false;
  if (!/^[A-ZÀ-Þ]/.test(t)) return false; // starts with a capital
  if (!/^[A-Za-zÀ-ÿ '\-]+$/.test(t)) return false; // letters, spaces, apostrophe, hyphen
  if (t.split(/\s+/).length > 4) return false; // not a sentence
  return true;
}

function collectUnderlinedRuns(editor: Editor): Run[] {
  const underline = editor.state.schema.marks.underline;
  if (!underline) return [];
  const runs: Array<{ from: number; to: number }> = [];
  let cur: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    const marked = node.isText && underline.isInSet(node.marks);
    if (marked) {
      if (cur && cur.to === pos) cur.to = pos + node.nodeSize;
      else {
        if (cur) runs.push(cur);
        cur = { from: pos, to: pos + node.nodeSize };
      }
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
    return true;
  });
  if (cur) runs.push(cur);
  return runs.map((r) => ({ ...r, text: editor.state.doc.textBetween(r.from, r.to, '', '') }));
}

function rangeHasMention(editor: Editor, from: number, to: number): boolean {
  let found = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'mention') found = true;
  });
  return found;
}

function insertReference(editor: Editor, from: number, to: number, id: string, label: string, keepCaret: boolean) {
  const caret = editor.state.selection.from;
  editor.chain().insertContentAt({ from, to }, { type: 'mention', attrs: { id, label } }).run();
  if (keepCaret) {
    // The text (to-from) became a single 1-wide node; shift the caret to match.
    const delta = 1 - (to - from);
    const next = Math.max(1, caret + delta);
    try {
      editor.commands.setTextSelection(next);
    } catch {
      /* ignore */
    }
  }
}

// Underline → reference. Handles one run per pass; the resulting edit re-fires
// onUpdate so any remaining underlined names are picked up next time.
async function convertUnderlined(editor: Editor, map: Map<string, string>, opts: LinkerOpts): Promise<boolean> {
  for (const run of collectUnderlinedRuns(editor)) {
    if (rangeHasMention(editor, run.from, run.to)) continue;
    const key = run.text.trim().toLowerCase();
    if (!key) continue;
    let id = map.get(key);
    if (!id) {
      if (!isNameLike(run.text)) continue; // leave non-name underlines as plain emphasis
      const ent = await opts.createCharacter(run.text.trim());
      id = ent.id;
    }
    insertReference(editor, run.from, run.to, id, run.text.trim(), false);
    return true;
  }
  return false;
}

// Type a known name → auto-link it (existing entries only). Fires only just
// after a word boundary so it never grabs a word mid-typing.
function convertCaretWord(editor: Editor, map: Map<string, string>) {
  const sel = editor.state.selection;
  if (!sel.empty) return;
  const $from = sel.$from;
  const blockStart = $from.start();
  const before = $from.parent.textBetween(0, $from.parentOffset, '\n', ' ');
  if (!/[\s.,;:!?'")\]]$/.test(before)) return; // a word just ended
  const trimmed = before.replace(/[\s.,;:!?'")\]]+$/, '');
  if (!trimmed) return;
  const words = trimmed.split(/\s+/);
  for (let n = Math.min(4, words.length); n >= 1; n--) {
    const phrase = words.slice(words.length - n).join(' ');
    const id = map.get(phrase.toLowerCase());
    if (!id) continue;
    const from = blockStart + (trimmed.length - phrase.length);
    const to = blockStart + trimmed.length;
    // Confirm the positions really map to that text (inline atoms can offset it).
    const actual = editor.state.doc.textBetween(from, to, '', '');
    if (actual.toLowerCase() !== phrase.toLowerCase()) return;
    if (rangeHasMention(editor, from, to)) return;
    insertReference(editor, from, to, id, actual, true);
    return;
  }
}

export async function runReferenceLinker(editor: Editor | null, opts: LinkerOpts) {
  if (!editor || editor.isDestroyed || busy) return;
  busy = true;
  try {
    const map = buildNameMap(opts.getEntities());
    // Underlined names take priority (they can create); fall back to caret auto-link.
    const handled = await convertUnderlined(editor, map, opts);
    if (!handled) convertCaretWord(editor, map);
  } catch {
    /* never let linking break typing */
  } finally {
    busy = false;
  }
}
