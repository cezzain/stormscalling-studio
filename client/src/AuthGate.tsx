import { useCallback, useEffect, useState } from 'react';
import App from './App';
import { LoginScreen } from './features/auth/LoginScreen';
import { SessionContext } from './lib/session';
import { api } from './lib/api';

type Phase = 'checking' | 'login' | 'authed';

/**
 * Top-level auth gate. Asks the server whether a login wall is active:
 *  - no wall (local dev / no credentials) → render the app immediately
 *  - wall + signed in                     → render the app
 *  - wall + signed out                    → render the login screen
 * Also catches mid-session expiry (a 401 anywhere) and drops back to login.
 */
export function AuthGate() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [authRequired, setAuthRequired] = useState(false);

  const check = useCallback(async () => {
    try {
      const s = await api.auth.status();
      setAuthRequired(s.authRequired);
      setPhase(s.authRequired && !s.authed ? 'login' : 'authed');
    } catch {
      // If the status probe itself fails, don't trap the user — let the app load.
      setAuthRequired(false);
      setPhase('authed');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const onUnauth = () => setPhase((p) => (authRequired ? 'login' : p));
    window.addEventListener('scs:unauthorized', onUnauth);
    return () => window.removeEventListener('scs:unauthorized', onUnauth);
  }, [authRequired]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* ignore — we drop to login regardless */
    }
    setPhase('login');
  }, []);

  if (phase === 'checking') {
    return (
      <div
        style={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--canvas)',
          color: 'var(--ink-3)',
          fontFamily: 'var(--font-display)',
          fontSize: 20,
        }}
      >
        Storm's Calling Studio…
      </div>
    );
  }

  if (phase === 'login') {
    return <LoginScreen onSuccess={() => setPhase('authed')} />;
  }

  return (
    <SessionContext.Provider value={{ authRequired, logout }}>
      <App />
    </SessionContext.Provider>
  );
}
