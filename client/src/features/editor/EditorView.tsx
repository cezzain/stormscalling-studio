import { useEffect } from 'react';
import { useStore } from '../../lib/store';
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

const STATUS_COLOR: Record<SceneStatus, string> = { draft: 'var(--s-draft)', revised: 'var(--s-revised)', done: 'var(--s-done)' };
const STATUS_LABEL: Record<SceneStatus, string> = { draft: 'Draft', revised: 'Revised', done: 'Done' };
const FONT_VAR: Record<string, string> = { Lora: 'var(--font-body)', 'IM Fell English': 'var(--font-display)', Inter: 'var(--font-ui)' };

export function EditorView() {
  const { pages, pageId, chapterId, focus, settings } = useStore();
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

  const addPage = async () => {
    if (!container) return;
    const np = await createPage({ parent_id: container.id, kind: 'page', title: 'Untitled page' });
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
          padding: '38px 28px 140px',
          ...( { '--ms-font': fontVar, '--ms-size': sizeVar } as React.CSSProperties),
        }}
      >
        <div style={{ width: '100%', maxWidth: 880 }}>
          {container ? (
            <>
              {/* chapter / page header */}
              <div style={{ margin: '0 4px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.4, color: 'var(--clay)', textTransform: 'uppercase' }}>{partLabel}</span>
                  {status && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: STATUS_COLOR[status], flex: '0 0 auto' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status] }} />
                      {STATUS_LABEL[status]}
                    </span>
                  )}
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 46, lineHeight: 1.08, margin: '10px 0 0', color: 'var(--ink)' }}>{container.title}</h1>
                <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
                  {cards.length} page{cards.length === 1 ? '' : 's'} · {totalWords.toLocaleString()} words
                </div>
              </div>

              {/* page cards */}
              {cards.map((pg, i) => (
                <div key={pg.id} style={{ marginBottom: 30 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 8px 11px' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: 'var(--ink-3)', flex: '0 0 auto' }}>Page {i + 1}</span>
                    <span style={{ height: 1, flex: 1, background: 'var(--line)' }} />
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{pg.title}</span>
                    <span style={{ height: 1, width: 18, background: 'var(--line)' }} />
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', flex: '0 0 auto' }}>{(pg.word_count || 0).toLocaleString()} words</span>
                  </div>
                  <div
                    className="glass-soft"
                    onClick={() => useStore.setState({ pageId: pg.id })}
                    style={{
                      background: 'var(--column)',
                      border: `1px solid ${pg.id === pageId ? 'var(--clay)' : 'var(--line)'}`,
                      borderRadius: 16,
                      boxShadow: 'var(--shadow)',
                      padding: '76px 88px',
                      minHeight: 440,
                    }}
                  >
                    <SceneEditor page={pg} focused={pg.id === pageId} />
                  </div>
                </div>
              ))}

              <div
                onClick={addPage}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, height: 66, border: '1.5px dashed var(--line-2)', borderRadius: 14, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500 }}
              >
                <Icon.Plus size={16} />
                Add a page to this chapter
              </div>

              <ContinuityPanel />
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {!focus && <StatusBar />}

      <SelectionToolbar />
      {diff && <DiffPanel />}
    </div>
  );
}

function EmptyState() {
  const createPage = useStore((s) => s.createPage);
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-3)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 32, color: 'var(--ink)', marginBottom: 10 }}>A blank page</h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, maxWidth: 460, margin: '0 auto 22px' }}>
        Nothing is selected yet. Create your first book, chapter, or page in the sidebar — or start one here.
      </p>
      <button
        onClick={async () => {
          const p = await createPage({ parent_id: null, kind: 'page', title: 'Untitled page' });
          useStore.getState().selectPage(p.id);
        }}
        style={{ height: 38, padding: '0 18px', border: '1px solid var(--forest)', background: 'var(--forest)', color: '#EFE7D6', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
      >
        New page
      </button>
    </div>
  );
}
