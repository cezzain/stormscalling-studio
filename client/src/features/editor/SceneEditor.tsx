import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import FileHandler from '@tiptap/extension-file-handler';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extensions';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import type { Editor, Range } from '@tiptap/core';

import { api } from '../../lib/api';
import { useStore } from '../../lib/store';
import { useEditorUi } from '../../lib/editorUi';
import { useActiveEditor } from './activeEditor';
import { SlashCommand } from './SlashCommand';
import { mentionExtension } from './mentionConfig';
import type { Page } from '../../lib/types';

const SAVE_DELAY = 800;

export function SceneEditor({ page, focused }: { page: Page; focused: boolean }) {
  const updatePageLocal = useStore((s) => s.updatePageLocal);
  const typewriter = useStore((s) => s.typewriter);
  const setSaving = useEditorUi((s) => s.setSaving);
  const setSelection = useEditorUi((s) => s.setSelection);
  const setHover = useEditorUi((s) => s.setHover);
  const setActive = useActiveEditor((s) => s.setActive);
  const bump = useActiveEditor((s) => s.bump);
  const selectEntity = useStore((s) => s.selectEntity);

  const saveTimer = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pendingRange = useRef<Range | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const uploadAndInsert = async (file: File, at?: number) => {
    try {
      const { url } = await api.upload(file);
      if (!editor) return;
      if (at != null) editor.chain().insertContentAt(at, { type: 'image', attrs: { src: url } }).focus().run();
      else editor.chain().focus().setImage({ src: url }).run();
    } catch {
      /* ignore upload failure */
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: false }),
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        onDrop: (_e, files, pos) => files.forEach((f) => uploadAndInsert(f, pos)),
        onPaste: (_e, files) => files.forEach((f) => uploadAndInsert(f)),
      }),
      Placeholder.configure({ placeholder: 'Begin writing…' }),
      mentionExtension,
      SlashCommand.configure({
        onImage: (_e: Editor, range: Range) => {
          pendingRange.current = range;
          fileInput.current?.click();
        },
      }),
    ],
    content: page.body || '<p></p>',
    onUpdate: ({ editor }) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      setSaving('saving');
      saveTimer.current = window.setTimeout(() => save(editor), SAVE_DELAY);
    },
    onFocus: ({ editor }) => setActive(editor, page.id),
    onSelectionUpdate: ({ editor }) => {
      if (focused || useActiveEditor.getState().pageId === page.id) bump();
      handleSelection(editor);
      if (typewriter) scrollCaretToCenter(editor);
    },
    // Refresh the toolbar's active state on every change — so keyboard
    // shortcuts (Ctrl+B/I/U, headings, etc.) light up the matching button
    // even when the cursor doesn't move.
    onTransaction: ({ editor }) => {
      if (useActiveEditor.getState().editor === editor) bump();
    },
  });

  const save = async (ed: Editor) => {
    const html = ed.getHTML();
    try {
      const updated = await api.pages.update(page.id, { body: html });
      updatePageLocal(page.id, { body: html, word_count: updated.word_count });
      setSaving('saved');
    } catch {
      setSaving('idle');
    }
  };

  // ---- selection -> AI toolbar position ----
  const handleSelection = (ed: Editor) => {
    const { from, to } = ed.state.selection;
    const text = ed.state.doc.textBetween(from, to, ' ').trim();
    if (text.length > 2) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.isCollapsed) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setSelection({ x: r.left + r.width / 2, y: r.top - 8, text });
        return;
      }
    }
    setSelection(null);
  };

  // ---- force save (Cmd+S) + cleanup ----
  useEffect(() => {
    const force = () => {
      if (editor) save(editor);
    };
    window.addEventListener('scs:force-save', force);
    return () => {
      window.removeEventListener('scs:force-save', force);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        if (editor) save(editor);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ---- keep external body changes (e.g. version restore) in sync ----
  useEffect(() => {
    if (editor && page.body !== editor.getHTML()) {
      editor.commands.setContent(page.body || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.body]);

  // ---- mention hover + click delegation ----
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const findMention = (t: EventTarget | null): HTMLElement | null => {
      const el = (t as HTMLElement)?.closest?.('[data-id][data-type="mention"], [data-entity], .mention');
      return (el as HTMLElement) ?? null;
    };
    const idOf = (el: HTMLElement) => el.getAttribute('data-id') || el.getAttribute('data-entity');

    const over = (e: MouseEvent) => {
      const el = findMention(e.target);
      if (!el) return;
      const id = idOf(el);
      if (!id) return;
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      const r = el.getBoundingClientRect();
      setHover({ entityId: id, x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 8 });
    };
    const out = (e: MouseEvent) => {
      if (!findMention(e.target)) return;
      hoverTimer.current = window.setTimeout(() => setHover(null), 200);
    };
    const click = (e: MouseEvent) => {
      const el = findMention(e.target);
      if (!el) return;
      const id = idOf(el);
      if (!id) return;
      e.preventDefault();
      setHover(null);
      selectEntity(id);
    };
    dom.addEventListener('mouseover', over);
    dom.addEventListener('mouseout', out);
    dom.addEventListener('click', click);
    return () => {
      dom.removeEventListener('mouseover', over);
      dom.removeEventListener('mouseout', out);
      dom.removeEventListener('click', click);
    };
  }, [editor, setHover, selectEntity]);

  // register as active when this is the focused card
  useEffect(() => {
    if (editor && focused) setActive(editor, page.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, focused]);

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && editor) {
            const at = pendingRange.current?.from;
            if (pendingRange.current) editor.chain().focus().deleteRange(pendingRange.current).run();
            uploadAndInsert(f, at);
            pendingRange.current = null;
          }
          e.target.value = '';
        }}
      />
      <div className="manuscript">
        <EditorContent editor={editor} />
      </div>
    </>
  );
}

function scrollCaretToCenter(editor: Editor) {
  try {
    const { head } = editor.state.selection;
    const coords = editor.view.coordsAtPos(head);
    const scroller = (editor.view.dom as HTMLElement).closest('[data-editor-scroll]') as HTMLElement | null;
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    const target = box.top + box.height / 2;
    scroller.scrollBy({ top: coords.top - target, behavior: 'smooth' });
  } catch {
    /* ignore */
  }
}
