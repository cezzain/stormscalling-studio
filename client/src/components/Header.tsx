import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useEditorUi } from '../lib/editorUi';
import { Icon } from '../lib/icons';
import { THEMES } from '../lib/themes';

export function Header() {
  const { view, theme, chapterId, pageId, pages, focus, chatOpen } = useStore();
  const setTheme = useStore((s) => s.setTheme);
  const toggleFocus = useStore((s) => s.toggleFocus);
  const toggleChat = useStore((s) => s.toggleChat);
  const openSearch = useStore((s) => s.openSearch);
  const saving = useEditorUi((s) => s.saving);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  const book = pages.find((p) => p.kind === 'book')?.title ?? "Storm's Calling";
  const chapter = pages.find((p) => p.id === chapterId);
  const page = pages.find((p) => p.id === pageId);

  const btn: React.CSSProperties = {
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid var(--line)',
    background: 'var(--canvas)',
    color: 'var(--ink-2)',
    borderRadius: 9,
    cursor: 'pointer',
  };

  return (
    <header
      className="glass"
      style={{
        height: 54,
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        position: 'relative',
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 210, flexShrink: 0 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: 'var(--forest)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#EFE7D6',
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            boxShadow: 'var(--shadow-s)',
          }}
        >
          S
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>Storm's Calling</span>
          <span style={{ fontSize: 9.5, letterSpacing: 2.5, color: 'var(--ink-3)', fontWeight: 600 }}>S T U D I O</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-3)', overflow: 'hidden' }}>
        <span>{book}</span>
        <span style={{ opacity: 0.5 }}>›</span>
        <span>{chapter?.title ?? '—'}</span>
        <span style={{ opacity: 0.5 }}>›</span>
        <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{page?.title ?? ''}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: 'var(--ink-3)' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: saving === 'saving' ? 'var(--s-revised)' : 'var(--clay)',
              display: 'inline-block',
              animation: saving === 'saving' ? 'blink .8s ease-in-out infinite' : 'blink 2.4s ease-in-out infinite',
            }}
          />
          {saving === 'saving' ? 'saving…' : 'saved'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={openSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 32,
            padding: '0 11px',
            border: '1px solid var(--line)',
            background: 'var(--canvas)',
            color: 'var(--ink-3)',
            borderRadius: 9,
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <Icon.Search size={14} />
          Search
          <span style={{ border: '1px solid var(--line-2)', borderRadius: 5, padding: '1px 5px', fontSize: 10, color: 'var(--ink-3)' }}>⌘K</span>
        </button>
        <button onClick={toggleFocus} title="Focus mode (⌘⇧F)" style={{ ...btn, color: focus ? 'var(--clay)' : 'var(--ink-2)' }}>
          <Icon.Focus size={16} />
        </button>
        <div ref={themeRef} style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setThemeOpen((o) => !o); }}
            title={`Theme — ${activeTheme.label}`}
            style={{ ...btn, gap: 5, display: 'flex' }}
          >
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: activeTheme.swatch, boxShadow: '0 0 0 1px var(--line-2)' }} />
            <Icon.Chevron size={10} />
          </button>
          {themeOpen && (
            <div
              className="glass"
              style={{ position: 'absolute', top: 38, right: 0, zIndex: 80, width: 184, padding: 6, border: '1px solid var(--line-2)', borderRadius: 11, fontFamily: 'var(--font-ui)' }}
            >
              <div style={{ padding: '4px 10px 6px', fontSize: 10, letterSpacing: 1, color: 'var(--ink-3)', fontWeight: 600 }}>COLOUR SCHEME</div>
              {THEMES.map((t) => (
                <div
                  key={t.id}
                  onClick={() => { setTheme(t.id); setThemeOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    color: 'var(--ink)',
                    background: t.id === theme ? 'var(--clay-soft)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (t.id !== theme) e.currentTarget.style.background = 'var(--clay-soft)'; }}
                  onMouseLeave={(e) => { if (t.id !== theme) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: t.swatch, boxShadow: '0 0 0 1px var(--line-2)', flex: '0 0 auto' }} />
                  <span style={{ flex: 1 }}>{t.label}</span>
                  {t.dark && <Icon.Moon size={12} style={{ color: 'var(--ink-3)' }} />}
                  {t.id === theme && <span style={{ color: 'var(--clay)', fontSize: 13 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={toggleChat}
          title="Co-writer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 32,
            padding: '0 12px',
            border: '1px solid var(--clay)',
            background: chatOpen ? 'var(--clay)' : 'transparent',
            color: chatOpen ? '#fff' : 'var(--clay)',
            borderRadius: 9,
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Icon.Chat size={14} />
          Co-writer
        </button>
      </div>
    </header>
  );
}
