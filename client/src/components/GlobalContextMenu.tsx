import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import type { View } from '../lib/types';

interface MenuState {
  x: number;
  y: number;
  selText: string;
  editable: boolean;
}

interface Item {
  label: string;
  hint?: string;
  danger?: boolean;
  run: () => void;
}

/**
 * A universal right-click menu. Fires anywhere the click wasn't claimed by a
 * more specific menu (those call stopPropagation, so this document-level
 * listener is skipped for them). Offers contextual edit actions plus global
 * create / navigate / app actions — the app's "native" context menu everywhere.
 */
export function GlobalContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const store = useStore();

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const editable = !!target.closest?.('[contenteditable="true"], input, textarea');
      const selText = window.getSelection?.()?.toString() ?? '';
      setMenu({ x: e.clientX, y: e.clientY, selText, editable });
    };
    const close = () => setMenu(null);
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, []);

  if (!menu) return null;

  const close = () => setMenu(null);
  const go = (v: View) => () => {
    store.setView(v);
    close();
  };

  const editGroup: Item[] = [];
  if (menu.selText) {
    editGroup.push({
      label: 'Copy',
      run: () => {
        try {
          document.execCommand('copy');
        } catch {
          navigator.clipboard?.writeText(menu.selText).catch(() => {});
        }
        close();
      },
    });
  }
  if (menu.editable) {
    if (menu.selText) {
      editGroup.push({ label: 'Cut', run: () => { try { document.execCommand('cut'); } catch { /* ignore */ } close(); } });
    }
    editGroup.push({
      label: 'Paste',
      run: async () => {
        try {
          const text = await navigator.clipboard?.readText();
          if (text) document.execCommand('insertText', false, text);
        } catch {
          /* clipboard read blocked — ignore */
        }
        close();
      },
    });
  }

  const createGroup: Item[] = [
    {
      label: 'New page',
      run: async () => {
        const p = await store.createPage({ parent_id: null, kind: 'page', title: 'Untitled page' });
        store.selectPage(p.id);
        close();
      },
    },
    {
      label: 'New codex entry',
      run: async () => {
        const e = await api.entities.create({ type: 'character', name: 'New entry' });
        await store.refreshEntities();
        store.selectEntity(e.id);
        close();
      },
    },
    {
      label: 'New timeline event',
      run: async () => {
        await api.timeline.create({ title: 'New event' }).catch(() => {});
        store.setView('timeline');
        close();
      },
    },
  ];

  const navGroup: Item[] = [
    { label: 'Manuscript', hint: '⌘⇧', run: go('editor') },
    { label: 'Codex', hint: '⌘⇧C', run: go('codex') },
    { label: 'Timeline', hint: '⌘⇧T', run: go('timeline') },
    { label: 'Map', hint: '⌘⇧M', run: go('map') },
    { label: 'Settings', run: go('settings') },
  ];

  const appGroup: Item[] = [
    { label: 'Search…', hint: '⌘K', run: () => { store.openSearch(); close(); } },
    { label: store.theme === 'dark' ? 'Light theme' : 'Dark theme', run: () => { store.toggleTheme(); close(); } },
    { label: store.focus ? 'Exit focus mode' : 'Focus mode', hint: '⌘⇧F', run: () => { store.toggleFocus(); close(); } },
  ];

  const groups = [editGroup, createGroup, navGroup, appGroup].filter((g) => g.length);

  return (
    <div
      className="glass"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      style={{
        position: 'fixed',
        left: Math.min(menu.x, window.innerWidth - 210),
        top: Math.min(menu.y, window.innerHeight - 380),
        zIndex: 110,
        width: 200,
        border: '1px solid var(--line-2)',
        borderRadius: 12,
        padding: 6,
        fontFamily: 'var(--font-ui)',
        animation: 'fadeup .12s ease both',
      }}
    >
      {groups.map((g, gi) => (
        <div key={gi}>
          {gi > 0 && <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />}
          {g.map((it) => (
            <div
              key={it.label}
              onClick={it.run}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '7px 12px',
                fontSize: 12.5,
                color: it.danger ? 'var(--danger)' : 'var(--ink)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                borderRadius: 7,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--clay-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {it.label}
              {it.hint && <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{it.hint}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
