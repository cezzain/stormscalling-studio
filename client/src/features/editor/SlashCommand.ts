import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import type { Editor, Range } from '@tiptap/core';
import { SlashMenu, type SlashMenuRef } from './SlashMenu';

interface SlashCommandItem {
  glyph: string;
  label: string;
  action: (editor: Editor, range: Range) => void;
}

export interface SlashOptions {
  onImage: (editor: Editor, range: Range) => void;
}

function buildItems(onImage: SlashOptions['onImage']): SlashCommandItem[] {
  return [
    { glyph: 'H', label: 'Heading 1', action: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run() },
    { glyph: 'H', label: 'Heading 2', action: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run() },
    { glyph: 'H', label: 'Heading 3', action: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run() },
    { glyph: '•', label: 'Bullet list', action: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
    { glyph: '1', label: 'Numbered list', action: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
    { glyph: '✓', label: 'Checklist', action: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
    { glyph: '"', label: 'Blockquote', action: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
    { glyph: '—', label: 'Divider', action: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
    { glyph: '▣', label: 'Image', action: (e, r) => onImage(e, r) },
  ];
}

export const SlashCommand = Extension.create<SlashOptions>({
  name: 'slashCommand',

  addOptions() {
    return { onImage: () => {} };
  },

  addProseMirrorPlugins() {
    const onImage = this.options.onImage;
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => props.action(editor as Editor, range),
        items: ({ query }) =>
          buildItems(onImage).filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let el: HTMLDivElement | null = null;

          const position = (rect: DOMRect | null) => {
            if (!el || !rect) return;
            el.style.left = `${Math.max(12, rect.left)}px`;
            el.style.top = `${rect.bottom + 6}px`;
          };

          return {
            onStart: (props) => {
              const items = props.items.map((it) => ({
                glyph: it.glyph,
                label: it.label,
                run: () => props.command(it),
              }));
              component = new ReactRenderer(SlashMenu, { props: { items }, editor: props.editor });
              el = document.createElement('div');
              el.style.position = 'fixed';
              el.style.zIndex = '60';
              el.appendChild(component.element);
              document.body.appendChild(el);
              position(props.clientRect?.() ?? null);
            },
            onUpdate: (props) => {
              const items = props.items.map((it) => ({
                glyph: it.glyph,
                label: it.label,
                run: () => props.command(it),
              }));
              component?.updateProps({ items });
              position(props.clientRect?.() ?? null);
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                el?.remove();
                el = null;
                return true;
              }
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              component?.destroy();
              el?.remove();
              el = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
