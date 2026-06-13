import { useEffect } from 'react';
import { useStore } from './store';

/** Global keyboard map (mockup + PRD cross-cutting requirements). */
export function useHotkeys() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const s = useStore.getState();

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
