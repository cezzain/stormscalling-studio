import { useStore } from '../../lib/store';

export function StatusBar() {
  const { pages, pageId, sessionStartWords, settings } = useStore();
  const page = pages.find((p) => p.id === pageId);
  const sceneWords = page?.word_count ?? 0;
  const bookWords = pages.reduce((a, p) => a + (p.word_count || 0), 0);
  const session = Math.max(0, sceneWords - sessionStartWords);
  const font = settings.manuscript_font || 'Lora';
  const size = settings.manuscript_size || '19';

  return (
    <div
      className="glass"
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        height: 36,
        padding: '0 18px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        fontSize: 11.5,
        color: 'var(--ink-3)',
      }}
    >
      <span>
        <b style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{sceneWords.toLocaleString()}</b> · scene
      </span>
      <span>
        <b style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{bookWords.toLocaleString()}</b> · book
      </span>
      <span style={{ color: 'var(--clay)' }}>
        <b style={{ fontWeight: 600 }}>+{session.toLocaleString()}</b> this session
      </span>
      <span
        style={{ textDecoration: 'underline', cursor: 'pointer' }}
        onClick={() => useStore.setState({ sessionStartWords: sceneWords })}
      >
        reset
      </span>
      <div style={{ flex: 1 }} />
      <span>
        {font} · {size}px / 1.82
      </span>
    </div>
  );
}
