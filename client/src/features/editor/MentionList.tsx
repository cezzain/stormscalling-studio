import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store';
import type { Entity } from '../../lib/types';

export interface MentionListRef {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

interface Props {
  items: Entity[];
  query: string;
  command: (attrs: { id: string; label: string }) => void;
}

const TYPE_BADGE: Record<string, string> = {
  character: 'Character',
  nation: 'Nation',
  location: 'Location',
  faction: 'Faction',
  concept: 'Concept',
};

export const MentionList = forwardRef<MentionListRef, Props>(({ items, query, command }, ref) => {
  const [sel, setSel] = useState(0);
  const refreshEntities = useStore((s) => s.refreshEntities);
  const showCreate = query.trim().length > 0 && !items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
  const total = items.length + (showCreate ? 1 : 0);

  useEffect(() => setSel(0), [items, query]);

  const pick = async (index: number) => {
    if (showCreate && index === items.length) {
      const name = query.trim();
      const created = await api.entities.create({ type: 'character', name });
      await refreshEntities();
      command({ id: created.id, label: created.name });
    } else {
      const e = items[index];
      if (e) command({ id: e.id, label: e.name });
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setSel((s) => (s + 1) % Math.max(total, 1));
        return true;
      }
      if (e.key === 'ArrowUp') {
        setSel((s) => (s - 1 + total) % Math.max(total, 1));
        return true;
      }
      if (e.key === 'Enter') {
        pick(sel);
        return true;
      }
      return false;
    },
  }));

  if (total === 0) {
    return (
      <div className="glass" style={menuStyle}>
        <div style={{ padding: '8px 12px', fontSize: 12.5, color: 'var(--ink-3)' }}>No matches</div>
      </div>
    );
  }

  return (
    <div className="glass" style={menuStyle}>
      {items.map((e, i) => (
        <div
          key={e.id}
          onMouseEnter={() => setSel(i)}
          onMouseDown={(ev) => {
            ev.preventDefault();
            pick(i);
          }}
          style={row(i === sel)}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
          <span style={{ fontSize: 10, color: 'var(--clay)' }}>{TYPE_BADGE[e.type]}</span>
        </div>
      ))}
      {showCreate && (
        <div
          onMouseEnter={() => setSel(items.length)}
          onMouseDown={(ev) => {
            ev.preventDefault();
            pick(items.length);
          }}
          style={{ ...row(sel === items.length), color: 'var(--clay)', fontWeight: 500 }}
        >
          + Create “{query.trim()}”
        </div>
      )}
    </div>
  );
});
MentionList.displayName = 'MentionList';

const menuStyle: React.CSSProperties = {
  width: 240,
  background: 'var(--surface-2)',
  border: '1px solid var(--line-2)',
  borderRadius: 12,
  padding: 6,
  boxShadow: 'var(--shadow)',
  animation: 'fadeup .15s ease both',
  fontFamily: 'var(--font-ui)',
};
const row = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 32,
  padding: '0 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--ink)',
  background: active ? 'var(--clay-soft)' : 'transparent',
});
