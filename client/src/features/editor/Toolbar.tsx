import { useState } from 'react';
import { useActiveEditor } from './activeEditor';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';

const FONTS = [
  { label: 'Lora', value: 'var(--font-body)' },
  { label: 'IM Fell English', value: 'var(--font-display)' },
  { label: 'Inter', value: 'var(--font-ui)' },
];
const SIZES = ['16', '17', '18', '19', '20', '22'];
const TEXT_COLORS = ['var(--ink)', 'var(--clay)', 'var(--forest-2)', 'var(--danger)', 'var(--sage)'];
const HL_COLORS = ['var(--tan)', 'var(--clay-soft)', 'var(--sage)', 'var(--s-revised)'];

export function Toolbar({ onContinuity }: { onContinuity: () => void }) {
  const editor = useActiveEditor((s) => s.editor);
  useActiveEditor((s) => s.tick); // re-render on selection change
  const settings = useStore((s) => s.settings);
  const setSettingsLocal = useStore.setState;
  const [colorOpen, setColorOpen] = useState(false);
  const [hlOpen, setHlOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  const font = settings.manuscript_font || 'Lora';
  const size = settings.manuscript_size || '19';

  const persist = (patch: Record<string, string>) => {
    setSettingsLocal((s) => ({ settings: { ...s.settings, ...patch } }));
    api.settings.update(patch).catch(() => {});
  };

  // Floating pill buttons — App-Store-tab-bar style. The active state gets a
  // bright glassy capsule with a clay glow so it reads like a selected tab.
  const tbBtn = (active: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
    minWidth: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    padding: '0 4px',
    border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
    background: active
      ? 'linear-gradient(160deg, color-mix(in srgb, var(--clay) 30%, transparent), color-mix(in srgb, var(--clay) 14%, transparent))'
      : 'transparent',
    boxShadow: active
      ? 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px color-mix(in srgb, var(--clay) 34%, transparent)'
      : 'none',
    borderRadius: 999,
    cursor: 'pointer',
    color: active ? 'var(--clay)' : 'var(--ink-2)',
    transition: 'background 0.18s var(--spring, ease), box-shadow 0.18s ease, color 0.15s ease',
    ...extra,
  });
  const divider = { paddingRight: 7, marginRight: 4, borderRight: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 2 } as React.CSSProperties;

  const is = (name: string, attrs?: Record<string, unknown>) => (editor ? editor.isActive(name, attrs) : false);

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 16px 8px',
        position: 'relative',
        zIndex: 5,
      }}
    >
    <div
      className="glass"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '6px 10px',
        borderRadius: 999,
        flexWrap: 'wrap',
        position: 'relative',
        maxWidth: '100%',
      }}
    >
      {/* marks */}
      <div style={divider}>
        <button onClick={() => editor?.chain().focus().toggleBold().run()} style={tbBtn(is('bold'), { fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: 15 })}>B</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} style={tbBtn(is('italic'), { fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 15 })}>I</button>
        <button onClick={() => editor?.chain().focus().toggleUnderline().run()} style={tbBtn(is('underline'), { fontFamily: 'Georgia,serif', textDecoration: 'underline', fontSize: 14 })}>U</button>
        <button onClick={() => editor?.chain().focus().toggleStrike().run()} style={tbBtn(is('strike'), { fontFamily: 'Georgia,serif', textDecoration: 'line-through', fontSize: 14 })}>S</button>
      </div>

      {/* headings */}
      <div style={divider}>
        {[1, 2, 3].map((l) => (
          <button
            key={l}
            onClick={() => editor?.chain().focus().toggleHeading({ level: l as 1 | 2 | 3 }).run()}
            style={tbBtn(is('heading', { level: l }), { fontFamily: 'var(--font-display)', fontSize: 16 - l, width: 'auto', padding: '0 9px' })}
          >
            H{l}
          </button>
        ))}
      </div>

      {/* lists */}
      <div style={divider}>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} style={tbBtn(is('bulletList'))}><Icon.ListBullet size={16} /></button>
        <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} style={tbBtn(is('orderedList'))}><Icon.ListOrdered size={16} /></button>
        <button onClick={() => editor?.chain().focus().toggleBlockquote().run()} style={tbBtn(is('blockquote'), { fontFamily: 'Georgia,serif', fontSize: 18 })}>”</button>
      </div>

      {/* colour + highlight swatches */}
      <div style={{ ...divider, gap: 5 }}>
        <div style={{ position: 'relative' }}>
          <span title="Text colour" onClick={() => { setColorOpen((o) => !o); setHlOpen(false); }} style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--ink)', border: '2px solid var(--surface-2)', boxShadow: '0 0 0 1px var(--line-2)', cursor: 'pointer', display: 'block' }} />
          {colorOpen && (
            <Palette colors={TEXT_COLORS} onPick={(c) => { editor?.chain().focus().setColor(c).run(); setColorOpen(false); }} onClear={() => { editor?.chain().focus().unsetColor().run(); setColorOpen(false); }} />
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <span title="Highlight" onClick={() => { setHlOpen((o) => !o); setColorOpen(false); }} style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--tan)', border: '2px solid var(--surface-2)', boxShadow: '0 0 0 1px var(--line-2)', cursor: 'pointer', display: 'block' }} />
          {hlOpen && (
            <Palette colors={HL_COLORS} onPick={(c) => { editor?.chain().focus().toggleHighlight({ color: c }).run(); setHlOpen(false); }} onClear={() => { editor?.chain().focus().unsetHighlight().run(); setHlOpen(false); }} />
          )}
        </div>
      </div>

      {/* font (manuscript column) */}
      <div style={{ position: 'relative' }}>
        <button className="glass-btn" onClick={() => { setFontOpen((o) => !o); setSizeOpen(false); }} style={pillBtn('var(--font-body)')}>
          {font}
          <Icon.Chevron size={11} />
        </button>
        {fontOpen && (
          <Dropdown>
            {FONTS.map((f) => (
              <div key={f.label} onClick={() => { persist({ manuscript_font: f.label }); setFontOpen(false); }} style={ddItem}>{f.label}</div>
            ))}
          </Dropdown>
        )}
      </div>

      {/* size */}
      <div style={{ position: 'relative' }}>
        <button className="glass-btn" onClick={() => { setSizeOpen((o) => !o); setFontOpen(false); }} style={pillBtn()}>
          {size}
          <Icon.Chevron size={11} />
        </button>
        {sizeOpen && (
          <Dropdown>
            {SIZES.map((sz) => (
              <div key={sz} onClick={() => { persist({ manuscript_size: sz }); setSizeOpen(false); }} style={ddItem}>{sz}px</div>
            ))}
          </Dropdown>
        )}
      </div>

      <div style={divider} />

      <button
        className="glass-btn"
        onClick={onContinuity}
        style={{ ...pillBtn('var(--font-ui)'), color: 'var(--clay)', fontWeight: 500, fontSize: 12 }}
      >
        <Icon.Check size={14} />
        Check continuity
      </button>
    </div>
    </div>
  );
}

// A compact glassy capsule for the font / size / continuity controls.
const pillBtn = (font = 'var(--font-ui)'): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 12px',
  border: '1px solid rgba(255,255,255,0.4)',
  background: 'color-mix(in srgb, var(--canvas) 55%, transparent)',
  borderRadius: 999,
  cursor: 'pointer',
  color: 'var(--ink-2)',
  fontFamily: font,
  fontSize: 12.5,
});

function Palette({ colors, onPick, onClear }: { colors: string[]; onPick: (c: string) => void; onClear: () => void }) {
  return (
    <div className="glass" style={{ position: 'absolute', top: 30, left: 0, zIndex: 70, display: 'flex', gap: 6, padding: 8, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 10, boxShadow: 'var(--shadow)' }}>
      {colors.map((c) => (
        <span key={c} onClick={() => onPick(c)} style={{ width: 20, height: 20, borderRadius: 5, background: c, cursor: 'pointer', boxShadow: '0 0 0 1px var(--line-2)' }} />
      ))}
      <span onClick={onClear} title="Clear" style={{ width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)', boxShadow: '0 0 0 1px var(--line-2)' }}>×</span>
    </div>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass" style={{ position: 'absolute', top: 34, left: 0, zIndex: 70, minWidth: 140, padding: 6, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 10, boxShadow: 'var(--shadow)' }}>
      {children}
    </div>
  );
}
const ddItem: React.CSSProperties = { padding: '7px 10px', fontSize: 12.5, borderRadius: 7, cursor: 'pointer', color: 'var(--ink)' };
