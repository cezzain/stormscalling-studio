import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { isDarkTheme } from '../lib/themes';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SearchOverlay } from './SearchOverlay';
import { GlobalContextMenu } from './GlobalContextMenu';
import { MentionHoverCard } from '../features/codex/MentionHoverCard';
import { EditorView } from '../features/editor/EditorView';
import { CodexView } from '../features/codex/CodexView';
import { TimelineView } from '../features/timeline/TimelineView';
import { MapView } from '../features/map/MapView';
import { SettingsView } from '../features/settings/SettingsView';
import { ChatPanel } from '../features/chat/ChatPanel';

export function AppShell() {
  const { view, focus, chatOpen, sidebarOpen, theme } = useStore();
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const [narrow, setNarrow] = useState(window.innerWidth < 1200);
  const [compact, setCompact] = useState(window.innerWidth < 1000);

  useEffect(() => {
    const onResize = () => {
      setNarrow(window.innerWidth < 1200);
      setCompact(window.innerWidth < 1000);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const canvasBg = focus ? (isDarkTheme(theme) ? 'rgba(10,13,10,0.6)' : 'rgba(222,212,194,0.5)') : 'transparent';
  const showChat = chatOpen && !focus;
  // The sidebar honours the toggle at every width. On compact (iPad-portrait-ish)
  // widths it floats over the canvas; on wider screens it sits inline.
  const showSidebar = !focus && sidebarOpen;

  return (
    <div
      data-theme={theme}
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        color: 'var(--ink)',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <Header />

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* compact: scrim behind the floating sidebar */}
        {compact && showSidebar && (
          <div onClick={toggleSidebar} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.34)', zIndex: 40 }} />
        )}
        {showSidebar &&
          (compact ? (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 41, display: 'flex', animation: 'panelin .25s ease' }}>
              <Sidebar />
            </div>
          ) : (
            <Sidebar />
          ))}

        <main style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: canvasBg, overflow: 'hidden' }}>
          {(view === 'editor' || view === 'lore') && <EditorView />}
          {view === 'codex' && <CodexView />}
          {view === 'timeline' && <TimelineView />}
          {view === 'map' && <MapView />}
          {view === 'settings' && <SettingsView />}
        </main>

        {showChat && <ChatPanel narrow={narrow} />}
      </div>

      <SearchOverlay />
      <MentionHoverCard />
      <GlobalContextMenu />
    </div>
  );
}
