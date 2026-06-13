import { useEffect } from 'react';
import { useStore } from './lib/store';
import { AppShell } from './components/AppShell';
import { useHotkeys } from './lib/useHotkeys';

export default function App() {
  const ready = useStore((s) => s.ready);
  const bootstrap = useStore((s) => s.bootstrap);
  useHotkeys();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!ready) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--canvas)',
          color: 'var(--ink-3)',
          fontFamily: 'var(--font-display)',
          fontSize: 22,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              background: 'var(--forest)',
              display: 'grid',
              placeItems: 'center',
              color: '#EFE7D6',
              fontSize: 26,
              boxShadow: 'var(--shadow)',
            }}
          >
            S
          </div>
          Storm's Calling Studio…
        </div>
      </div>
    );
  }

  return <AppShell />;
}
