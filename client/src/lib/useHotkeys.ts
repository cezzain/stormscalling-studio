import { useEffect } from 'react';
import { useStore } from './store';

/** Global keyboard map (mockup + PRD cross-cutting requirements). */
export function useHotkeys() {
  useEffect(() => {
    // True when the user is typing in a text field / the manuscript editor, so
    // we never hijack Delete / Ctrl+C/X/V/D away from normal text editing.
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const s = useStore.getState();

      // ---- page tree shortcuts (only when not editing text, and a page is selected) ----
      if (!isTyping()) {
        const pid = s.pageId;
        if ((e.key === 'Delete' || e.key === 'Backspace') && pid && !mod) {
          e.preventDefault();
          const page = s.pages.find((p) => p.id === pid);
          if (page && confirm(`Delete "${page.title}" and everything inside it?`)) s.deletePage(pid);
          return;
        }
        if (mod && k === 'd' && pid) {
          e.preventDefault();
          s.duplicatePage(pid);
          return;
        }
        if (mod && k === 'c' && pid) {
          e.preventDefault();
          s.copyPage(pid);
          return;
        }
        if (mod && k === 'x' && pid) {
          e.preventDefault();
          s.cutPage(pid);
          return;
        }
        if (mod && k === 'v' && pid && s.pageClipboard) {
          e.preventDefault();
          s.pastePage(pid);
          return;
        }
      }

      if (mod && k === 'k') {
        e.preventDefault();
        s.searchOpen ? s.closeSearch() : s.openSearch();
      } else if (mod && k === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('scs:force-save'));
      } else if (mod && e.shiftKey && k === 'f') {
        e.preventDefault();
        s.toggleFocus();
      } else if (mod && e.shiftKey && k === 't') {
        e.preventDefault();
        s.setView('timeline');
      } else if (mod && e.shiftKey && k === 'm') {
        e.preventDefault();
        s.setView('map');
      } else if (mod && e.shiftKey && k === 'c') {
        e.preventDefault();
        s.setView('codex');
      } else if (e.key === 'Escape') {
        if (s.searchOpen) s.closeSearch();
        window.dispatchEvent(new CustomEvent('scs:escape'));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
