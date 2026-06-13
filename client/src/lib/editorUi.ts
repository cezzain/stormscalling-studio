import { create } from 'zustand';
import type { DiffState, ContinuityFlag } from './types';

interface SelectionInfo {
  x: number;
  y: number;
  text: string;
}
interface HoverInfo {
  entityId: string;
  x: number;
  y: number;
}

interface EditorUiState {
  saving: 'saved' | 'saving' | 'idle';
  selection: SelectionInfo | null;
  diff: DiffState | null;
  diffLoading: boolean;
  hover: HoverInfo | null;
  continuityOpen: boolean;
  continuityLoading: boolean;
  continuityFlags: ContinuityFlag[];

  setSaving: (s: 'saved' | 'saving' | 'idle') => void;
  setSelection: (s: SelectionInfo | null) => void;
  setDiff: (d: DiffState | null) => void;
  setDiffLoading: (b: boolean) => void;
  setHover: (h: HoverInfo | null) => void;
  setContinuity: (patch: Partial<Pick<EditorUiState, 'continuityOpen' | 'continuityLoading' | 'continuityFlags'>>) => void;
}

export const useEditorUi = create<EditorUiState>((set) => ({
  saving: 'saved',
  selection: null,
  diff: null,
  diffLoading: false,
  hover: null,
  continuityOpen: false,
  continuityLoading: false,
  continuityFlags: [],

  setSaving: (saving) => set({ saving }),
  setSelection: (selection) => set({ selection }),
  setDiff: (diff) => set({ diff }),
  setDiffLoading: (diffLoading) => set({ diffLoading }),
  setHover: (hover) => set({ hover }),
  setContinuity: (patch) => set(patch),
}));
