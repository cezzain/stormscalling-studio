import type { Editor } from '@tiptap/react';

// Where an accepted inline-AI suggestion should be written back.
export const inlineTarget: { editor: Editor | null; from: number; to: number } = {
  editor: null,
  from: 0,
  to: 0,
};
