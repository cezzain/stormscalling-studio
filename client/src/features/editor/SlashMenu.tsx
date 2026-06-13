import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface SlashItem {
  glyph: string;
  label: string;
  run: () => void;
}

export interface SlashMenuRef {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

export const SlashMenu = forwardRef<SlashMenuRef, { items: SlashItem[] }>(({ items }, ref) => {
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setSel((s) => (s + 1) % Math.max(items.length, 1));
        return true;
      }
      if (e.key === 'ArrowUp') {
        setSel((s) => (s - 1 + items.length) % Math.max(items.length, 1));
        return true;
      }
      if (e.key === 'Enter') {
        items[sel]?.run();
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      className="glass"
      style={{
        width: 230,
        background: 'var(--surface-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 13,
        padding: 7,
        boxShadow: 'var(--shadow)',
        animation: 'fadeup .15s ease both',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1, color: 'var(--ink-3)', padding: '5px 10px 7px', fontWeight: 600 }}>BASIC BLOCKS</div>
      {items.map((it, i) => (
        <div
          key={it.label}
          onMouseEnter={() => setSel(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            it.run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            height: 34,
            padding: '0 10px',
            borderRadius: 8,
            cursor: 'pointer',
            color: 'var(--ink)',
            fontSize: 13,
            background: i === sel ? 'var(--clay-soft)' : 'transparent',
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--line)',
              borderRadius: 7,
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              color: 'var(--ink-2)',
            }}
          >
            {it.glyph}
          </span>
          {it.label}
        </div>
      ))}
    </div>
  );
});
SlashMenu.displayName = 'SlashMenu';
