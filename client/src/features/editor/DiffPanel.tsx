import { useEffect, useState } from 'react';
import { useEditorUi } from '../../lib/editorUi';
import { useStore } from '../../lib/store';
import { inlineTarget } from './inlineTarget';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function toParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function DiffPanel() {
  const diff = useEditorUi((s) => s.diff);
  const loading = useEditorUi((s) => s.diffLoading);
  const setDiff = useEditorUi((s) => s.setDiff);
  const setDiffLoading = useEditorUi((s) => s.setDiffLoading);
  const pageId = useStore((s) => s.pageId);
  const [edited, setEdited] = useState('');

  useEffect(() => {
    setEdited(diff?.suggestion ?? '');
  }, [diff?.suggestion]);

  if (!diff) return null;

  const close = () => setDiff(null);

  const accept = () => {
    const ed = inlineTarget.editor;
    if (ed && edited.trim()) {
      const html = toParagraphs(edited);
      if (diff.tool === 'continue') {
        ed.chain().focus().insertContentAt(inlineTarget.to, ' ' + html).run();
      } else {
        ed.chain().focus().insertContentAt({ from: inlineTarget.from, to: inlineTarget.to }, html).run();
      }
    }
    close();
  };

  const retry = async () => {
    if (!diff.tool) return;
    setDiffLoading(true);
    try {
      const { suggestion } = await api.ai.inline({ tool: diff.tool, text: diff.original, instruction: diff.instruction, scenePageId: pageId });
      setDiff({ ...diff, suggestion });
    } catch (err: any) {
      setDiff({ ...diff, suggestion: `Request failed: ${err?.message ?? 'unknown error'}` });
    } finally {
      setDiffLoading(false);
    }
  };

  return (
    <div
      className="glass-2"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        zIndex: 50,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--line-2)',
        boxShadow: '-16px 0 40px rgba(0,0,0,.12)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'panelin .25s ease both',
      }}
    >
      <div style={{ flex: '0 0 auto', padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--clay)', boxShadow: '0 0 0 4px var(--clay-soft)' }} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{diff.title}</span>
        <div style={{ flex: 1 }} />
        <span onClick={close} style={{ cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1 }}>×</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 1, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>ORIGINAL</div>
        <div style={{ background: 'var(--canvas)', border: '1px solid var(--line)', borderRadius: 10, padding: '13px 15px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-3)', marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          {diff.original}
        </div>
        <div style={{ fontSize: 10.5, letterSpacing: 1, color: 'var(--clay)', fontWeight: 600, marginBottom: 8 }}>SUGGESTION</div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 4px', color: 'var(--clay)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out infinite' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out .15s infinite' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out .3s infinite' }} />
          </div>
        ) : (
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            style={{
              width: '100%',
              minHeight: 200,
              resize: 'vertical',
              outline: 'none',
              background: 'var(--surface-2)',
              border: '1px solid var(--clay)',
              borderRadius: 10,
              padding: '13px 15px',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--ink)',
            }}
          />
        )}
      </div>

      <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
        <button onClick={accept} disabled={loading} style={{ flex: 1, height: 38, border: '1px solid var(--forest)', background: 'var(--forest)', color: '#EFE7D6', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1 }}>Accept</button>
        <button onClick={close} style={{ height: 38, padding: '0 16px', border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-2)', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13 }}>Reject</button>
        <button onClick={retry} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-2)', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
          <Icon.Retry size={13} /> Retry
        </button>
      </div>
    </div>
  );
}
