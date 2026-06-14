import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import { api } from '../../lib/api';
import { MentionList, type MentionListRef } from './MentionList';
import type { Entity } from '../../lib/types';

export const mentionExtension = Mention.configure({
  HTMLAttributes: { class: 'mention' },
  // References read as the plain underlined name, not "@name". Override both
  // renderText (copy / serialization) and renderHTML (the default prepends @).
  renderText: ({ node }) => node.attrs.label ?? node.attrs.id,
  renderHTML: ({ options, node }) => [
    'span',
    mergeAttributes(
      { class: 'mention', 'data-type': 'mention', 'data-id': node.attrs.id, 'data-label': node.attrs.label },
      options.HTMLAttributes,
    ),
    `${node.attrs.label ?? node.attrs.id}`,
  ],
  suggestion: {
    char: '@',
    items: async ({ query }): Promise<Entity[]> => {
      try {
        return await api.entities.search(query);
      } catch {
        return [];
      }
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let el: HTMLDivElement | null = null;

      const position = (rect: DOMRect | null) => {
        if (!el || !rect) return;
        el.style.left = `${Math.max(12, rect.left)}px`;
        el.style.top = `${rect.bottom + 6}px`;
      };

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props: { items: props.items, query: props.query, command: props.command },
            editor: props.editor,
          });
          el = document.createElement('div');
          el.style.position = 'fixed';
          el.style.zIndex = '60';
          el.appendChild(component.element);
          document.body.appendChild(el);
          position(props.clientRect?.());
        },
        onUpdate: (props: any) => {
          component?.updateProps({ items: props.items, query: props.query, command: props.command });
          position(props.clientRect?.());
        },
        onKeyDown: (props: any) => {
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
  },
});
