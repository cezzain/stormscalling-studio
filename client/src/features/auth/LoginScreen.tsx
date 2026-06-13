import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

/**
 * Liquid-glass sign-in screen. Reuses the studio's design tokens (--glass,
 * aurora, IM Fell English) so it feels like part of the app, not bolted on.
 * Shown only when the deployment has a login wall configured.
 */
export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const userRef = useRef<HTMLInputElement | null>(null);

  // Match the user's chosen colour scheme (persisted by the store on this device).
  useEffect(() => {
    const t = localStorage.getItem('scs-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    userRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.auth.login(username, password);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Please try again.');
      setShake((n) => n + 1);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    padding: '0 14px',
    borderRadius: 12,
    border: '1px solid var(--line-2)',
    background: 'var(--surface-2)',
    color: 'var(--ink)',
    fontFamily: 'var(--font-ui)',
    fontSize: 15,
    outline: 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: 'var(--font-ui)',
        color: 'var(--ink)',
        background: 'var(--canvas)',
      }}
    >
      {/* component-scoped niceties: focus ring, shake, hover */}
      <style>{`
        .scs-login input:focus { border-color: var(--clay) !important; box-shadow: 0 0 0 3px var(--clay-soft); }
        .scs-login .submit:hover:not(:disabled) { background: var(--forest-2); }
        @keyframes scs-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(2px)} }
      `}</style>

      <form
        onSubmit={submit}
        className="scs-login glass"
        key={shake}
        style={{
          width: 'min(400px, 100%)',
          padding: 38,
          borderRadius: 22,
          border: '1px solid var(--glass-line)',
          animation: error ? 'scs-shake .4s ease' : 'fadeup .5s ease both',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--forest)',
              display: 'grid',
              placeItems: 'center',
              color: '#EFE7D6',
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              boxShadow: 'var(--shadow)',
            }}
          >
            S
          </div>
          <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 27, color: 'var(--ink)' }}>Storm's Calling</div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>S T U D I O</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
            Your private writing studio — sign in to continue
          </div>
        </div>

        {/* username */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, color: 'var(--ink-3)' }}>USERNAME</span>
          <input
            ref={userRef}
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            disabled={busy}
          />
        </label>

        {/* password */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, color: 'var(--ink-3)' }}>PASSWORD</span>
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: 64 }}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              tabIndex={-1}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                color: 'var(--ink-3)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 8px',
              }}
            >
              {show ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </label>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', marginTop: -4 }}>{error}</div>
        )}

        <button
          type="submit"
          className="submit"
          disabled={busy || !username || !password}
          style={{
            height: 46,
            marginTop: 4,
            borderRadius: 12,
            border: 'none',
            background: 'var(--forest)',
            color: '#EFE7D6',
            fontFamily: 'var(--font-ui)',
            fontSize: 15,
            fontWeight: 600,
            cursor: busy || !username || !password ? 'default' : 'pointer',
            opacity: busy || !username || !password ? 0.6 : 1,
            transition: 'background .15s ease',
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 2 }}>
          Private deployment · only you can sign in
        </div>
      </form>
    </div>
  );
}
