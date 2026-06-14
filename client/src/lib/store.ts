import { create } from 'zustand';
import { api } from './api';
import type { Page, Entity, View, ContextToggles, CalendarConfig, AiProvider } from './types';

interface StoreState {
  // boot / ai
  ready: boolean;
  model: string;
  hasKey: boolean;
  provider: string;
  aiProviders: AiProvider[];

  // ui
  theme: string;
  view: View;
  focus: boolean;
  chatOpen: boolean;
  searchOpen: boolean;
  typewriter: boolean;

  // data
  pages: Page[];
  entities: Entity[];
  settings: Record<string, string>;
  calendar: CalendarConfig | null;
  expanded: Record<string, boolean>;

  // navigation
  chapterId: string | null; // container being edited
  pageId: string | null; // focused leaf page
  entityId: string | null; // codex selection

  // page clipboard (sidebar copy / cut / paste)
  pageClipboard: { id: string; mode: 'copy' | 'cut' } | null;

  // chat context toggles
  ctx: ContextToggles;

  // session word baseline (per scene + book)
  sessionStartWords: number;

  // actions
  bootstrap: () => Promise<void>;
  setView: (v: View) => void;
  toggleFocus: () => void;
  toggleChat: () => void;
  toggleTheme: () => void;
  setTheme: (t: string) => void;
  toggleTypewriter: () => void;
  openSearch: () => void;
  closeSearch: () => void;

  refreshPages: () => Promise<void>;
  refreshEntities: () => Promise<void>;
  refreshAi: () => Promise<void>;

  toggleExpand: (id: string) => void;
  setExpanded: (id: string, v: boolean) => void;

  selectPage: (pageId: string) => void;
  selectChapter: (chapterId: string) => void;
  selectSection: (section: 'manuscript' | 'lore') => void;
  selectEntity: (entityId: string) => void;

  createPage: (data: Partial<Page>) => Promise<Page>;
  duplicatePage: (id: string) => Promise<Page>;
  copyPage: (id: string) => void;
  cutPage: (id: string) => void;
  pastePage: (targetId: string) => Promise<void>;
  updatePageLocal: (id: string, patch: Partial<Page>) => void;
  savePage: (id: string, patch: Partial<Page>) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  setCtx: (patch: Partial<ContextToggles>) => void;
}

const THEME_KEY = 'scs-theme';

function applyTheme(t: string) {
  document.documentElement.setAttribute('data-theme', t);
}

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  model: 'claude-opus-4-8',
  hasKey: false,
  provider: 'anthropic',
  aiProviders: [],
  theme: localStorage.getItem(THEME_KEY) || 'light',
  view: 'editor',
  focus: false,
  chatOpen: true,
  searchOpen: false,
  typewriter: false,
  pages: [],
  entities: [],
  settings: {},
  calendar: null,
  expanded: {},
  chapterId: null,
  pageId: null,
  entityId: null,
  pageClipboard: null,
  ctx: { scene: true, chapter: false, codex: false, lore: true },
  sessionStartWords: 0,

  bootstrap: async () => {
    const initialTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(initialTheme);
    set({ theme: initialTheme });

    const [status, pages, entities, settingsRes] = await Promise.all([
      api.status().catch(() => ({ ok: false, model: 'claude-opus-4-8', hasKey: false })),
      api.pages.list().catch(() => [] as Page[]),
      api.entities.list().catch(() => [] as Entity[]),
      api.settings.get().catch(() => ({
        settings: {} as Record<string, string>,
        calendar: null,
        ai: { provider: 'anthropic' as const, label: 'Claude (Anthropic)', model: 'claude-opus-4-8', hasKey: false, providers: [] },
      })),
    ]);

    // theme from settings if localStorage absent
    const themeFromSettings = (settingsRes.settings as Record<string, string>).theme as string | undefined;
    const theme = localStorage.getItem(THEME_KEY) || themeFromSettings || 'light';
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);

    // default expansion: expand top-level containers + first chapter
    const expanded: Record<string, boolean> = {};
    for (const p of pages) {
      if (p.kind === 'book' || p.kind === 'part' || p.kind === 'folder') expanded[p.id] = true;
    }

    // pick an initial page: first manuscript leaf (falls back to any page)
    const manuscriptPages = pages.filter((p) => p.section !== 'lore');
    const firstLeaf = manuscriptPages.find((p) => p.kind === 'page') ?? manuscriptPages[0] ?? pages[0];
    let chapterId: string | null = null;
    let pageId: string | null = null;
    if (firstLeaf) {
      pageId = firstLeaf.id;
      chapterId = firstLeaf.parent_id ?? firstLeaf.id;
      if (firstLeaf.parent_id) expanded[firstLeaf.parent_id] = true;
    }

    set({
      ready: true,
      provider: settingsRes.ai.provider,
      model: settingsRes.ai.model,
      hasKey: settingsRes.ai.hasKey,
      aiProviders: settingsRes.ai.providers,
      pages,
      entities,
      settings: settingsRes.settings,
      calendar: settingsRes.calendar,
      theme,
      expanded,
      chapterId,
      pageId,
      entityId: entities[0]?.id ?? null,
    });

    const cur = pages.find((p) => p.id === pageId);
    set({ sessionStartWords: cur?.word_count ?? 0 });
  },

  setView: (v) => set({ view: v }),
  toggleFocus: () => set((s) => ({ focus: !s.focus })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
    api.settings.update({ theme: next }).catch(() => {});
    set({ theme: next });
  },
  setTheme: (t) => {
    applyTheme(t);
    localStorage.setItem(THEME_KEY, t);
    api.settings.update({ theme: t }).catch(() => {});
    set({ theme: t });
  },
  toggleTypewriter: () => set((s) => ({ typewriter: !s.typewriter })),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  refreshPages: async () => {
    const pages = await api.pages.list();
    set({ pages });
  },
  refreshEntities: async () => {
    const entities = await api.entities.list();
    set({ entities });
  },
  refreshAi: async () => {
    const res = await api.settings.get();
    set({
      provider: res.ai.provider,
      model: res.ai.model,
      hasKey: res.ai.hasKey,
      aiProviders: res.ai.providers,
      settings: res.settings,
    });
  },

  toggleExpand: (id) => set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setExpanded: (id, v) => set((s) => ({ expanded: { ...s.expanded, [id]: v } })),

  selectPage: (pageId) => {
    const page = get().pages.find((p) => p.id === pageId);
    if (!page) return;
    const chapterId = page.parent_id ?? page.id;
    set((s) => ({
      view: page.section === 'lore' ? 'lore' : 'editor',
      pageId,
      chapterId,
      sessionStartWords: page.word_count,
      expanded: page.parent_id ? { ...s.expanded, [page.parent_id]: true } : s.expanded,
    }));
  },
  selectChapter: (chapterId) => {
    const { pages, expanded } = get();
    const chapter = pages.find((p) => p.id === chapterId);
    const children = pages.filter((p) => p.parent_id === chapterId).sort((a, b) => a.position - b.position);
    const firstPage = children.find((c) => c.kind === 'page') ?? children[0];
    set({
      view: chapter?.section === 'lore' ? 'lore' : 'editor',
      chapterId,
      pageId: firstPage ? firstPage.id : null,
      expanded: { ...expanded, [chapterId]: true },
      sessionStartWords: firstPage?.word_count ?? 0,
    });
  },
  // Jump to a top-level section (manuscript | lore) from the nav, selecting its
  // first available page so the editor isn't left showing the other section.
  selectSection: (section) => {
    const { pages } = get();
    const view = section === 'lore' ? 'lore' : 'editor';
    const inSection = pages.filter((p) => p.section === section);
    const firstLeaf = inSection.find((p) => p.kind === 'page') ?? inSection[0];
    if (firstLeaf) get().selectPage(firstLeaf.id);
    else set({ view, chapterId: null, pageId: null });
  },
  selectEntity: (entityId) => set({ view: 'codex', entityId }),

  createPage: async (data) => {
    const page = await api.pages.create(data);
    set((s) => ({ pages: [...s.pages, page] }));
    return page;
  },
  duplicatePage: async (id) => {
    const copy = await api.pages.duplicate(id);
    await get().refreshPages();
    get().selectPage(copy.id);
    return copy;
  },
  copyPage: (id) => set({ pageClipboard: { id, mode: 'copy' } }),
  cutPage: (id) => set({ pageClipboard: { id, mode: 'cut' } }),
  pastePage: async (targetId) => {
    const { pageClipboard, pages } = get();
    if (!pageClipboard) return;
    const target = pages.find((p) => p.id === targetId);
    if (!target) return;
    // Paste inside the target if it's a container, otherwise beside it (same parent).
    const destParent = target.kind !== 'page' ? target.id : target.parent_id;
    // A large position value drops it at the end of the destination container.
    const endPos = Date.now();

    if (pageClipboard.mode === 'copy') {
      const copy = await api.pages.duplicate(pageClipboard.id);
      if ((copy.parent_id ?? null) !== (destParent ?? null)) {
        await api.pages.move(copy.id, destParent ?? null, endPos);
      }
      await get().refreshPages();
      if (destParent) get().setExpanded(destParent, true);
      get().selectPage(copy.id);
    } else {
      // Cut + paste = move. Guard against dropping a node into its own subtree.
      let a: string | null = destParent;
      while (a) {
        if (a === pageClipboard.id) return;
        a = pages.find((p) => p.id === a)?.parent_id ?? null;
      }
      await api.pages.move(pageClipboard.id, destParent ?? null, endPos);
      await get().refreshPages();
      if (destParent) get().setExpanded(destParent, true);
      get().selectPage(pageClipboard.id);
      set({ pageClipboard: null });
    }
  },
  updatePageLocal: (id, patch) =>
    set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  savePage: async (id, patch) => {
    const updated = await api.pages.update(id, patch);
    set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...updated } : p)) }));
  },
  deletePage: async (id) => {
    await api.pages.remove(id);
    await get().refreshPages();
    // if the deleted page was active, pick a new one
    const { pages, pageId } = get();
    if (pageId === id) {
      const next = pages.find((p) => p.kind === 'page');
      if (next) get().selectPage(next.id);
      else set({ pageId: null });
    }
  },
  setCtx: (patch) => set((s) => ({ ctx: { ...s.ctx, ...patch } })),
}));
