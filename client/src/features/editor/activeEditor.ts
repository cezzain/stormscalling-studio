import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

interface ActiveEditorState {
  editor: Editor | null;
  pageId: string | null;
  tick: number;
  setActive: (editor: Editor | null, pageId: string | null) => void;
  bump: () => void;
}

// Tracks which scene editor the top toolbar should act on, and a tick that
// forces the toolbar to re-read mark/selection state.
export const useActiveEditor = create<ActiveEditorState>((set) => ({
  editor: null,
  pageId: null,
  tick: 0,
  setActive: (editor, pageId) => set({ editor, pageId, tick: 0 }),
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));
