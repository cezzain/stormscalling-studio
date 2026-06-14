import { useState } from 'react';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { THEMES } from '../../lib/themes';
import {
  type Appearance,
  APPEARANCE_DEFAULTS,
  APPEARANCE_RANGES,
  applyAppearance,
  loadAppearance,
  saveAppearance,
} from '../../lib/appearance';

const FONTS = ['Lora', 'IM Fell English', 'Inter'];

export function SettingsView() {
  const { settings, calendar, theme, typewriter } = useStore();
  const setTheme = useStore((s) => s.setTheme);
  const toggleTypewriter = useStore((s) => s.toggleTypewriter);
  const [appear, setAppearState] = useState<Appearance>(loadAppearance);
  const setAppear = (patch: Partial<Appearance>) => {
    setAppearState((prev) => {
      const next = { ...prev, ...patch };
      applyAppearance(next);
      saveAppearance(next);
      return next;
    });
  };
  const resetAppear = () => {
    applyAppearance(APPEARANCE_DEFAULTS);
    saveAppearance(APPEARANCE_DEFAULTS);
    setAppearState({ ...APPEARANCE_DEFAULTS });
  };

  const [seasons, setSeasons] = useState((calendar?.seasons ?? []).join(', '));
  const [calFormat, setCalFormat] = useState(calendar?.format ?? 'Year [N] · [Season]');
  const [year, setYear] = useState(String(calendar?.currentYear ?? 312));

  const persist = (patch: Record<string, string>) => {
    useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }));
    api.settings.update(patch).catch(() => {});
  };
  const saveCalendar = () => {
    const cal = { format: calFormat, seasons: seasons.split(',').map((s) => s.trim()).filter(Boolean), currentYear: Number(year) || 0 };
    useStore.setState({ calendar: cal });
    api.settings.updateCalendar(cal).catch(() => {});
  };

  const download = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.click();
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '40px 24px 80px' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 30, margin: '0 0 26px', color: 'var(--ink)' }}>Settings</h1>

        <Section title="Editor">
          <Row label="Manuscript font" hint="The face you write in">
            <select value={settings.manuscript_font ?? 'Lora'} onChange={(e) => persist({ manuscript_font: e.target.value })} style={selStyle('var(--font-body)')}>
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Row>
          <Row label="Font size" hint="Writing column">
            <select value={settings.manuscript_size ?? '19'} onChange={(e) => persist({ manuscript_size: e.target.value })} style={selStyle()}>
              {['16', '17', '18', '19', '20', '22'].map((s) => <option key={s} value={s}>{s} px</option>)}
            </select>
          </Row>
          <Row label="Colour scheme" hint="Also in the header swatch">
            <select value={theme} onChange={(e) => setTheme(e.target.value)} style={selStyle()}>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </Row>
          <Row label="Typewriter scrolling" hint="Keep the caret line centred while you write">
            <select value={typewriter ? 'on' : 'off'} onChange={(e) => { if ((e.target.value === 'on') !== typewriter) toggleTypewriter(); }} style={selStyle()}>
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
          </Row>
        </Section>

        <Section title="Appearance">
          <Slider
            label="Glass clarity" hint="Frosted ↔ crystal clear"
            value={appear.clarity} {...APPEARANCE_RANGES.clarity}
            display={`${appear.clarity}%`} onChange={(v) => setAppear({ clarity: v })}
          />
          <Slider
            label="Glass transparency" hint="See-through ↔ solid tint"
            value={100 - appear.tint} {...APPEARANCE_RANGES.tint}
            display={`${100 - appear.tint}%`} onChange={(v) => setAppear({ tint: 100 - v })}
          />
          <Slider
            label="Edge sheen" hint="Refractive rim & highlight (liquid glass)"
            value={appear.sheen} {...APPEARANCE_RANGES.sheen}
            display={`${appear.sheen}%`} onChange={(v) => setAppear({ sheen: v })}
          />
          <Slider
            label="Background glow" hint="Ambient aurora intensity"
            value={appear.glow} {...APPEARANCE_RANGES.glow}
            display={`${appear.glow}%`} onChange={(v) => setAppear({ glow: v })}
          />
          <Slider
            label="Aurora motion" hint="How fast the background drifts"
            value={appear.auroraSpeed} {...APPEARANCE_RANGES.auroraSpeed}
            display={`${appear.auroraSpeed}%`} onChange={(v) => setAppear({ auroraSpeed: v })}
          />
          <Slider
            label="Bounciness" hint="Spring in hovers & pops"
            value={appear.bounce} {...APPEARANCE_RANGES.bounce}
            display={`${appear.bounce}%`} onChange={(v) => setAppear({ bounce: v })}
          />
          <Slider
            label="Writing width" hint="Manuscript column width"
            value={appear.msWidth} {...APPEARANCE_RANGES.msWidth}
            display={`${appear.msWidth}px`} onChange={(v) => setAppear({ msWidth: v })}
          />
          <Slider
            label="Line spacing" hint="Manuscript leading"
            value={appear.msLine} {...APPEARANCE_RANGES.msLine}
            display={appear.msLine.toFixed(2)} onChange={(v) => setAppear({ msLine: v })}
          />
          <Row label="Auto pages (Word-style)" hint="Start a fresh sheet automatically when a page fills up">
            <select
              value={appear.autoPageWords > 0 ? 'on' : 'off'}
              onChange={(e) => setAppear({ autoPageWords: e.target.value === 'on' ? 400 : 0 })}
              style={selStyle()}
            >
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
          </Row>
          <Row label="Restore defaults" hint="Reset every appearance slider">
            <button onClick={resetAppear} className="glass-btn" style={btnStyle}>Reset</button>
          </Row>
        </Section>

        <Section title="World">
          <Row label="Calendar format" hint="Used across the timeline">
            <input value={calFormat} onChange={(e) => setCalFormat(e.target.value)} onBlur={saveCalendar} style={inStyle('ui-monospace,monospace')} />
          </Row>
          <Row label="Seasons" hint="Comma-separated">
            <input value={seasons} onChange={(e) => setSeasons(e.target.value)} onBlur={saveCalendar} style={inStyle()} />
          </Row>
          <Row label="Current year" hint="Reckoning">
            <input value={year} onChange={(e) => setYear(e.target.value)} onBlur={saveCalendar} style={inStyle()} />
          </Row>
        </Section>

        <Section title="Data">
          <Row label="Database" hint="Local file path">
            <Value mono>./data/storms-calling.db</Value>
          </Row>
          <Row label="Backup" hint="Export everything (db + images) as a zip">
            <button onClick={() => download(api.exportUrls.backup())} className="glass-btn" style={btnStyle}>Export →</button>
          </Row>
          <Row label="Codex" hint="Export all entries as a Markdown zip">
            <button onClick={() => download(api.exportUrls.codex())} className="glass-btn" style={btnStyle}>Export →</button>
          </Row>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{ marginBottom: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, padding: '20px 22px', boxShadow: 'var(--shadow-s)' }}>
      <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, letterSpacing: 0.4, color: 'var(--clay)', margin: '0 0 14px', textTransform: 'uppercase' }}>{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, hint, children, stacked }: { label: string; hint: string; children: React.ReactNode; stacked?: boolean }) {
  return (
    <div style={{ display: stacked ? 'block' : 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{hint}</div>
      </div>
      {stacked ? children : <div style={{ flex: '0 0 auto' }}>{children}</div>}
    </div>
  );
}
function Slider({
  label, hint, value, min, max, step, display, onChange,
}: {
  label: string; hint: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 230 }}>
        <input
          className="glass-range"
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, ...( { '--pct': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties) }}
        />
        <span style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 48, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }}>{display}</span>
      </div>
    </Row>
  );
}
function Value({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontFamily: mono ? 'ui-monospace,monospace' : 'var(--font-ui)', padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--canvas)', minWidth: 120, textAlign: 'right' }}>{children}</div>
  );
}
const selStyle = (font = 'var(--font-ui)'): React.CSSProperties => ({ fontSize: 12.5, color: 'var(--ink-2)', fontFamily: font, padding: '7px 14px', borderRadius: 999, minWidth: 140, outline: 'none', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.4)', background: 'color-mix(in srgb, var(--canvas) 55%, transparent)' });
const inStyle = (font = 'var(--font-ui)'): React.CSSProperties => ({ fontSize: 12.5, color: 'var(--ink-2)', fontFamily: font, padding: '7px 14px', borderRadius: 999, minWidth: 200, textAlign: 'right', outline: 'none', border: '1px solid rgba(255,255,255,0.4)', background: 'color-mix(in srgb, var(--canvas) 55%, transparent)' });
const btnStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--clay)', fontFamily: 'var(--font-ui)', fontWeight: 600, padding: '7px 16px', borderRadius: 999, cursor: 'pointer' };
