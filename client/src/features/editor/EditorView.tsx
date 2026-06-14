import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import { loadAppearance } from '../../lib/appearance';
import { useEditorUi } from '../../lib/editorUi';
import { useActiveEditor } from './activeEditor';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';
import { SceneEditor } from './SceneEditor';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { SelectionToolbar } from './SelectionToolbar';
import { DiffPanel } from './DiffPanel';
import { ContinuityPanel } from './ContinuityPanel';
import type { SceneStatus } from '../../lib/types';

// Physical page geometry (US-Letter at 96dpi) — must match the page-card style
// below. The printable area is the sheet height minus its top/bottom margins;
// once the text passes it, a fresh page is spawned.
const PAGE_HEIGHT = 1056;
const PAGE_PAD_TOP = 96;
const PAGE_PAD_BOTTOM = 112;
const CONTENT_MAX = PAGE_HEIGHT - PAGE_PAD_TOP - PAGE_PAD_BOTTOM; // 848px

const STATUS_COLOR: Record<SceneStatus, string> = { draft: 'var(--s-draft)', revised: 'var(--s-revised)', done: 'var(--s-done)' };
const STATUS_LABEL: Record<SceneStatus, string> = { draft: 'Draft', revised: 'Revised', done: 'Done' };
const FONT_VAR: Record<string, string> = { Lora: 'var(--font-body)', 'IM Fell English': 'var(--font-display)', Inter: 'var(--font-ui)' };

export function EditorView() {
  const { pages, pageId, chapterId, focus, settings, view } = useStore();
  const createPage = useStore((s) => s.createPage);
  const hasKey = useStore((s) => s.hasKey);
  const diff = useEditorUi((s) => s.diff);
  const setContinuity = useEditorUi((s) => s.setContinuity);
  const activePageId = useActiveEditor((s) => s.pageId);

  const container = pages.find((p) => p.id === chapterId) ?? pages.find((p) => p.id === pageId);
  const childPages = container
    ? pages.filter((p) => p.parent_id === container.id && p.kind === 'page').sort((a, b) => a.position - b.position)
    : [];
  const cards = childPages.length ? childPages : container && container.kind === 'page' ? [container] : [];
  const totalWords = cards.reduce((a, p) => a + (p.word_count || 0), 0);

  // header part label = parent container title (part/book/folder), uppercased
  const parent = container ? pages.find((p) => p.id === container.parent_id) : undefined;
  const partLabel = parent ? parent.title : container?.kind === 'page' ? 'Standalone page' : '';
  const status = (container?.status ?? null) as SceneStatus | null;

  // Auto-pagination, Microsoft-Word style: a new sheet appears the moment the
  // current page physically fills up. We measure the rendered height of the
  // last page's text (which accounts for font size, headings, images, line
  // spacing — everything Word cares about) rather than counting words.
  const autoPaging = useRef(false);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const lastCardRef = useRef<HTMLDivElement | null>(null);
  const lastCard = cards[cards.length - 1];
  useEffect(() => {
    // Only flow within a real multi-page container (a chapter/part/folder that
    // already holds page cards) — never turn a standalone page into children.
    if (!container || childPages.length === 0) return;
    if (loadAppearance().autoPageWords <= 0) return; // 0 = feature off
    const card = lastCardRef.current;
    if (!card) return;
    const check = () => {
      if (autoPaging.current) return;
      const pm = card.querySelector('.ProseMirror') as HTMLElement | null;
      if (!pm) return;
      // printable area = page height minus its top + bottom margins
      if (pm.scrollHeight <= CONTENT_MAX) return;
      autoPaging.current = true;
      createPage({ parent_id: container.id, kind: 'page', title: 'Untitled page' })
        .then((np) => {
          setAutoFocusId(np.id);
          useStore.setState({ pageId: np.id });
        })
        .finally(() => {
          autoPaging.current = false;
        });
    };
    const ro = new ResizeObserver(check);
    const pm = card.querySelector('.ProseMirror');
    if (pm) ro.observe(pm);
    check();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container?.id, childPages.length, lastCard?.id]);

  // keep store.pageId in sync with whichever card is focused
  useEffect(() => {
    if (activePageId && activePageId !== pageId && cards.some((c) => c.id === activePageId)) {
      useStore.setState({ pageId: activePageId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId]);

  // load persisted continuity flags when the focused page changes; keep panel closed
  useEffect(() => {
    setContinuity({ continuityOpen: false, continuityLoading: false, continuityFlags: [] });
    if (pageId) {
      api.ai
        .continuityGet(pageId)
        .then((r) => setContinuity({ continuityFlags: r.flags }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const runContinuity = async () => {
    if (!pageId) return;
    setContinuity({ continuityOpen: true });
    if (!hasKey) {
      setContinuity({
        continuityLoading: false,
        continuityFlags: [{ id: 'nokey', quote: 'Co-writer unavailable', issue: 'No API key', suggestion: 'Add ANTHROPIC_API_KEY to your .env and restart to run continuity checks.' }],
      });
      return;
    }
    setContinuity({ continuityLoading: true });
    try {
      const r = await api.ai.continuityRun(pageId);
      setContinuity({ continuityLoading: false, continuityFlags: r.flags });
    } catch (err: any) {
      setContinuity({ continuityLoading: false, continuityFlags: [{ id: 'err', quote: 'Check failed', issue: 'Error', suggestion: err?.message ?? 'unknown error' }] });
    }
  };

  // New pages stay in whatever section we're viewing — a page added from the
  // Lore tab lands under the LORE dropdown, not in the manuscript.
  const section = view === 'lore' ? 'lore' : 'manuscript';
  const addPage = async () => {
    if (!container) return;
    const np = await createPage({ parent_id: container.id, kind: 'page', title: 'Untitled page', section: container.section ?? section });
    useStore.setState({ pageId: np.id });
  };

  const fontVar = FONT_VAR[settings.manuscript_font || 'Lora'] ?? 'var(--font-body)';
  const sizeVar = `${settings.manuscript_size || '19'}px`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {!focus && <Toolbar onContinuity={runContinuity} />}

      <div
        data-editor-scroll
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '52px 40px 160px',
          background: 'var(--editor-desk)',
          ...( { '--ms-font': fontVar, '--ms-size': sizeVar } as React.CSSProperties),
        }}
      >
        <div style={{ width: '100%', maxWidth: 'var(--ms-width, 880px)' }}>
          {container ? (
            <>
              {/* chapter / page header — sits on the "desk" above the first page */}
              <div style={{ margin: '0 4px 32px', padding: '0 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.4, color: 'var(--clay)', textTransform: 'uppercase', opacity: 0.85 }}>{partLabel}</span>
                  {status && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: STATUS_COLOR[status], flex: '0 0 auto' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status] }} />
                      {STATUS_LABEL[status]}
                    </span>
                  )}
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 44, lineHeight: 1.08, margin: '10px 0 0', color: 'var(--ink)', opacity: 0.88 }}>{container.title}</h1>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
                  {cards.length} page{cards.length === 1 ? '' : 's'} · {totalWords.toLocaleString()} words
                </div>
              </div>

              {/* page cards — each looks like a physical sheet of paper */}
              {cards.map((pg, i) => (
                <div key={pg.id} style={{ marginBottom: 48 }}>
                  <div
                    ref={i === cards.length - 1 ? lastCardRef : undefined}
                    onClick={() => useStore.setState({ pageId: pg.id })}
                    style={{
                      background: 'var(--page-bg)',
                      border: 'none',
                      borderRadius: 2,
                      boxShadow: pg.id === pageId ? 'var(--page-shadow-active)' : 'var(--page-shadow)',
                      padding: '96px 96px 112px',
                      minHeight: PAGE_HEIGHT,
                      position: 'relative',
                      outline: pg.id === pageId ? '2px solid rgba(168,105,60,0.30)' : 'none',
                      outlineOffset: 2,
                      transition: 'box-shadow 0.2s ease, outline 0.2s ease',
                    }}
                  >
                    <SceneEditor page={pg} focused={pg.id === pageId} autoFocus={pg.id === autoFocusId} />
                    {/* page footer */}
                    <div style={{ position: 'absolute', bottom: 36, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, pointerEvents: 'none' }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: 0.3 }}>{pg.title}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)', opacity: 0.6 }}>·</span>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--ink-3)' }}>{i + 1}</span>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addPage}
                className="glass-btn"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', height: 56, borderRadius: 999, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, marginBottom: 24 }}
              >
                <Icon.Plus size={16} />
                Add a {section === 'lore' ? 'lore page' : 'page'}
              </button>

              <ContinuityPanel />
            </>
          ) : (
            <EmptyState section={section} />
          )}
        </div>
      </div>

      {!focus && <StatusBar />}

      <SelectionToolbar />
      {diff && <DiffPanel />}
    </div>
  );
}

function EmptyState({ section }: { section: 'manuscript' | 'lore' }) {
  const createPage = useStore((s) => s.createPage);
  const where = section === 'lore' ? 'lore page' : 'page';
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-3)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 32, color: 'var(--ink)', marginBottom: 10 }}>A blank page</h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, maxWidth: 460, margin: '0 auto 22px' }}>
        Nothing is selected yet. Create your first book, chapter, or {where} in the sidebar — or start one here.
      </p>
      <button
        onClick={async () => {
          const p = await createPage({ parent_id: null, kind: 'page', title: 'Untitled page', section });
          useStore.getState().selectPage(p.id);
        }}
        className="glass-btn glass-btn--accent"
        style={{ height: 38, padding: '0 18px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
      >
        New {where}
      </button>
    </div>
  );
}
