import { useEditorUi } from '../../lib/editorUi';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';

export function ContinuityPanel() {
  const { continuityOpen, continuityLoading, continuityFlags } = useEditorUi();
  const setContinuity = useEditorUi((s) => s.setContinuity);

  if (!continuityOpen) return null;

  const dismiss = async (id: string) => {
    setContinuity({ continuityFlags: continuityFlags.filter((f) => f.id !== id) });
    api.ai.continuityDismiss(id).catch(() => {});
  };

  return (
    <div style={{ marginTop: 26, animation: 'fadeup .35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <Icon.Check size={15} style={{ color: 'var(--clay)' }} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {continuityLoading
            ? 'Continuity · scanning…'
            : `Continuity · ${continuityFlags.length} flag${continuityFlags.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {continuityLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px', color: 'var(--clay)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out infinite' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out .15s infinite' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out .3s infinite' }} />
        </div>
      ) : continuityFlags.length === 0 ? (
        <div className="glass" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderLeft: '3px solid var(--s-done)', borderRadius: 11, padding: '14px 16px', boxShadow: 'var(--shadow-s)', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)' }}>
          No continuity issues found ✓
        </div>
      ) : (
        continuityFlags.map((f) => (
          <div key={f.id} className="glass" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderLeft: '3px solid var(--s-revised)', borderRadius: 11, padding: '14px 16px', marginBottom: 10, boxShadow: 'var(--shadow-s)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>“{f.quote}”</p>
              <span onClick={() => dismiss(f.id)} style={{ flex: '0 0 auto', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</span>
            </div>
            <p style={{ margin: '9px 0 0', fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
              <b style={{ color: 'var(--danger)', fontWeight: 600 }}>{f.issue}</b>
            </p>
            <p style={{ margin: '5px 0 0', fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{f.suggestion}</p>
          </div>
        ))
      )}
    </div>
  );
}
