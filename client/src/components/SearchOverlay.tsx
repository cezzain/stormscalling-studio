import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Icon } from '../lib/icons';
import type { SearchGroup, SearchResult } from '../lib/types';

export function SearchOverlay() {
  const open = useStore((s) => s.searchOpen);
  const close = useStore((s) => s.closeSearch);
  const selectPage = useStore((s) => s.selectPage);
  const selectEntity = useStore((s) => s.selectEntity);
  const setView = useStore((s) => s.setView);

  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setGroups([]);
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setGroups([]);
      return;
    }
    const h = setTimeout(() => {
      api.search(q).then((r) => { setGroups(r.groups); setSel(0); }).catch(() => setGroups([]));
    }, 140);
    return () => clearTimeout(h);
  }, [q]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const activate = (item: SearchResult) => {
    if (item.type === 'page') selectPage(item.id);
    else if (item.type === 'entity') selectEntity(item.id);
    else if (item.type === 'timeline') setView('timeline');
    else if (item.type === 'thread') { useStore.setState({ chatOpen: true }); }
    close();
  };

  if (!open) return null;

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,22,16,.42)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', paddingTop: '12vh', animation: 'overlayin .15s ease both' }}>
      <div className="glass-2" onClick={(e) => e.stopPropagation()} style={{ width: 600, maxWidth: '92vw', height: 'fit-content', maxHeight: '70vh', background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 16, boxShadow: '0 30px 80px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 11, padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <Icon.Search size={18} style={{ color: 'var(--ink-3)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); if (flat[sel]) activate(flat[sel]); }
            }}
            placeholder="Search manuscript, codex, threads, timeline…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--ink)' }}
          />
          <span style={{ border: '1px solid var(--line-2)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5, color: 'var(--ink-3)' }}>Esc</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {q.trim() && flat.length === 0 && <div style={{ padding: '18px 12px', fontSize: 13, color: 'var(--ink-3)' }}>No matches.</div>}
          {groups.map((g) => {
            let runningIndex = flat.findIndex((it) => g.items[0] && it === g.items[0]);
            return (
              <div key={g.label} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.2, color: 'var(--ink-3)', fontWeight: 600, padding: '8px 10px 5px' }}>{g.label}</div>
                {g.items.map((r) => {
                  const idx = runningIndex++;
                  const active = idx === sel;
                  return (
                    <div key={r.id} onMouseEnter={() => setSel(idx)} onClick={() => activate(r)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, cursor: 'pointer', background: active ? 'var(--clay-soft)' : 'transparent' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.dot, flex: '0 0 auto' }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.snippet}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
