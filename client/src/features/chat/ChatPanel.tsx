import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import { api, streamChat } from '../../lib/api';
import { Icon } from '../../lib/icons';
import type { ChatThread, ChatMessage } from '../../lib/types';

const CTX_DEFS = [
  { id: 'scene', label: 'Current scene' },
  { id: 'chapter', label: 'Chapter' },
  { id: 'codex', label: 'Codex' },
  { id: 'lore', label: 'Lore Bible' },
] as const;

export function ChatPanel({ narrow }: { narrow: boolean }) {
  const { ctx, pageId, hasKey } = useStore();
  const setCtx = useStore((s) => s.setCtx);
  const toggleChat = useStore((s) => s.toggleChat);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [tokenEst, setTokenEst] = useState('0.0k');
  const [threadMenu, setThreadMenu] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const msgRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // load threads
  useEffect(() => {
    api.chat.threads().then((t) => {
      setThreads(t);
      if (t[0]) loadThread(t[0].id, t);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // token estimate
  useEffect(() => {
    const h = setTimeout(() => {
      api.ai.contextEstimate({ scenePageId: pageId, scene: ctx.scene, chapter: ctx.chapter, codex: ctx.codex, lore: ctx.lore })
        .then((r) => setTokenEst((r.tokens / 1000).toFixed(1) + 'k'))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [ctx, pageId]);

  // autoscroll
  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages, streaming]);

  const loadThread = async (id: string, list?: ChatThread[]) => {
    setThreadId(id);
    const { thread, messages } = await api.chat.messages(id);
    setThread(thread);
    setMessages(messages);
    setThreadMenu(false);
    if (list) setThreads(list);
  };

  const newThread = async () => {
    const t = await api.chat.create('Drafting');
    setThreads((ts) => [t, ...ts]);
    setThread(t);
    setThreadId(t.id);
    setMessages([]);
    setThreadMenu(false);
  };

  const send = () => {
    const text = input.trim();
    if (!text || streaming || thread?.readonly) return;
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);
    abortRef.current = streamChat(
      { threadId, message: text, context: ctx, scenePageId: pageId },
      {
        onThread: (id) => {
          setThreadId(id);
          api.chat.threads().then(setThreads).catch(() => {});
        },
        onDelta: (delta) => setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: (c[c.length - 1]?.content ?? '') + delta }; return c; }),
        onError: (msg) => { setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: msg }; return c; }); setStreaming(false); },
        onDone: () => setStreaming(false),
      },
    );
  };

  return (
    <aside
      className="glass"
      style={{
        width: 380,
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--line)',
        minHeight: 0,
        zIndex: 45,
        position: narrow ? 'absolute' : 'static',
        top: 0,
        right: 0,
        bottom: 0,
        boxShadow: narrow ? '-18px 0 50px rgba(0,0,0,.22)' : 'none',
      }}
    >
      {/* header */}
      <div style={{ flex: '0 0 auto', padding: '13px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 9, position: 'relative' }}>
        <button onClick={() => setThreadMenu((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 30, padding: '0 11px', border: '1px solid var(--line)', background: 'var(--canvas)', borderRadius: 8, cursor: 'pointer', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 500 }}>
          {thread?.title ?? 'New thread'}{thread?.readonly ? ' · imported' : ''}
          <Icon.Chevron size={11} />
        </button>
        {threadMenu && (
          <div className="glass" style={{ position: 'absolute', top: 46, left: 16, zIndex: 30, width: 240, maxHeight: 260, overflowY: 'auto', background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 6, boxShadow: 'var(--shadow)' }}>
            {threads.length === 0 && <div style={{ padding: 8, fontSize: 12.5, color: 'var(--ink-3)' }}>No threads yet.</div>}
            {threads.map((t) => (
              <div key={t.id} onClick={() => loadThread(t.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', background: t.id === threadId ? 'var(--clay-soft)' : 'transparent' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}{t.readonly ? ' · imported' : ''}</span>
                <span onClick={(e) => { e.stopPropagation(); api.chat.remove(t.id).then(() => api.chat.threads().then(setThreads)); }} style={{ color: 'var(--ink-3)', marginLeft: 8 }}>×</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <span title="New thread" onClick={newThread} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', color: 'var(--ink-2)', fontSize: 16 }}>+</span>
        <span onClick={toggleChat} style={{ cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1 }}>×</span>
      </div>

      {/* context chips */}
      <div style={{ flex: '0 0 auto', padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CTX_DEFS.map((c) => {
            const on = ctx[c.id];
            return (
              <span key={c.id} onClick={() => setCtx({ [c.id]: !on } as any)} style={{ height: 26, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRadius: 7, fontSize: 11.5, cursor: 'pointer', border: `1px solid ${on ? 'var(--clay)' : 'var(--line-2)'}`, background: on ? 'var(--clay-soft)' : 'transparent', color: on ? 'var(--clay)' : 'var(--ink-3)', fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--clay)' : 'var(--line-2)' }} />
                {c.label}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 9, fontSize: 10.5, color: 'var(--ink-3)' }}>~{tokenEst} tokens of context</div>
      </div>

      {/* messages */}
      <div ref={msgRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.6 }}>
            Ask your co-writer about the scene, your world, or what a passage needs. Toggle the context chips above to bring your draft, codex, and Lore Bible into the conversation.
          </div>
        )}
        {messages.map((m, i) => {
          const isU = m.role === 'user';
          const last = i === messages.length - 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: isU ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 10, letterSpacing: 0.6, color: 'var(--ink-3)', fontWeight: 600 }}>{isU ? 'YOU' : 'CO-WRITER'}</span>
              <div
                style={{
                  maxWidth: '90%',
                  background: isU ? 'var(--clay-soft)' : 'var(--canvas)',
                  border: `1px solid ${isU ? 'transparent' : 'var(--line)'}`,
                  borderRadius: 13,
                  [isU ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 4,
                  padding: '11px 14px',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--ink)',
                  whiteSpace: 'pre-wrap',
                } as React.CSSProperties}
              >
                {m.content}
                {!isU && last && streaming && (
                  <span style={{ display: 'inline-block', width: 2, height: 15, background: 'var(--clay)', marginLeft: 2, verticalAlign: -2, boxShadow: '0 0 6px var(--clay)', animation: 'blink 1s steps(2) infinite' }} />
                )}
              </div>
            </div>
          );
        })}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out infinite' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out .15s infinite' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)', animation: 'think 1.1s ease-in-out .3s infinite' }} />
          </div>
        )}
      </div>

      {/* input */}
      {thread?.readonly ? (
        <div style={{ flex: '0 0 auto', padding: '14px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
          Imported conversation · read-only
        </div>
      ) : (
        <div style={{ flex: '0 0 auto', padding: '12px 14px 14px', borderTop: '1px solid var(--line)' }}>
          {!hasKey && (
            <div style={{ marginBottom: 9, fontSize: 11, color: 'var(--danger)' }}>No API key — add ANTHROPIC_API_KEY to .env to enable the co-writer.</div>
          )}
          <div style={{ background: 'var(--canvas)', border: '1px solid var(--line-2)', borderRadius: 13, padding: '6px 6px 6px 14px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder="Ask your co-writer…"
              style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5, maxHeight: 120, padding: '6px 0' }}
            />
            <button onClick={send} style={{ width: 34, height: 34, flex: '0 0 auto', display: 'grid', placeItems: 'center', border: 'none', borderRadius: 9, background: 'var(--forest)', color: '#EFE7D6', cursor: 'pointer' }}>
              <Icon.Send size={16} />
            </button>
          </div>
          <div onClick={() => setImportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, color: 'var(--ink-3)', fontSize: 11, cursor: 'pointer' }}>
            <Icon.Import size={13} />
            Import conversation from claude.ai
          </div>
        </div>
      )}

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImport={async (text) => {
            const { id } = await api.chat.import(text, 'Imported from claude.ai');
            const list = await api.chat.threads();
            setThreads(list);
            await loadThread(id, list);
            setImportOpen(false);
          }}
        />
      )}
    </aside>
  );
}

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,22,16,.42)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh', animation: 'overlayin .15s ease both' }}>
      <div className="glass-2" onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '92vw', background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '0 0 6px', color: 'var(--ink)' }}>Import from claude.ai</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 12px' }}>Paste a conversation. It becomes a read-only thread beside your draft.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full conversation…" style={{ width: '100%', minHeight: 200, padding: '12px', border: '1px solid var(--line-2)', borderRadius: 10, background: 'var(--canvas)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={() => text.trim() && onImport(text)} style={{ height: 36, padding: '0 18px', border: '1px solid var(--forest)', background: 'var(--forest)', color: '#EFE7D6', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Import</button>
          <button onClick={onClose} style={{ height: 36, padding: '0 14px', border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-2)', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
