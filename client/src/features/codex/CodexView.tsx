import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';
import { CodexBodyEditor } from './CodexBodyEditor';
import { Bookshelf } from './Bookshelf';
import type { Entity, EntityType, Backlink } from '../../lib/types';

const TYPES: EntityType[] = ['character', 'nation', 'location', 'faction', 'concept'];

export function CodexView() {
  const { entityId, entities } = useStore();
  const refreshEntities = useStore((s) => s.refreshEntities);
  const selectPage = useStore((s) => s.selectPage);
  const openCodexShelf = useStore((s) => s.openCodexShelf);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const coverInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!entityId) {
      setEntity(null);
      return;
    }
    api.entities
      .get(entityId)
      .then((e) => {
        setEntity(e);
        setNameVal(e.name);
        setBacklinks(e.backlinks ?? []);
      })
      .catch(() => setEntity(null));
  }, [entityId]);

  // No entry selected → show the bookshelf landing (three volumes to open).
  if (!entityId) return <Bookshelf />;
  if (!entity) return null;

  const save = async (patch: Partial<Entity>) => {
    const updated = await api.entities.update(entity.id, patch);
    setEntity((e) => (e ? { ...e, ...updated } : e));
    refreshEntities();
  };

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v) return;
    const aliases = [...entity.aliases, v];
    save({ aliases });
    setAliasInput('');
  };
  const removeAlias = (a: string) => save({ aliases: entity.aliases.filter((x) => x !== a) });

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '40px 24px 80px' }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <button
          onClick={() => openCodexShelf()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px', marginBottom: 18,
            border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surface-2)',
            color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 500,
          }}
        >
          <Icon.Chevron size={11} style={{ transform: 'rotate(90deg)' }} /> Bookshelf
        </button>
        <div style={{ display: 'flex', gap: 26, marginBottom: 30 }}>
          {/* cover */}
          <div
            onClick={() => coverInput.current?.click()}
            title="Set cover image"
            style={{
              width: 150,
              height: 200,
              flex: '0 0 auto',
              borderRadius: 13,
              border: '1px solid var(--line)',
              background: entity.cover_image
                ? `center/cover url(${entity.cover_image})`
                : 'repeating-linear-gradient(135deg,var(--surface),var(--surface) 9px,var(--surface-2) 9px,var(--surface-2) 18px)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 14,
              boxShadow: 'var(--shadow)',
              cursor: 'pointer',
            }}
          >
            {!entity.cover_image && <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 10, color: 'var(--ink-3)' }}>cover image</span>}
          </div>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                const { url } = await api.upload(f);
                save({ cover_image: url });
              }
              e.target.value = '';
            }}
          />

          <div style={{ flex: 1, paddingTop: 6, minWidth: 0 }}>
            {/* type badge (click to change) */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span
                onClick={() => setTypeOpen((o) => !o)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 11px', borderRadius: 7, background: 'var(--clay-soft)', color: 'var(--clay)', fontSize: 11, fontWeight: 600, letterSpacing: 0.4, cursor: 'pointer' }}
              >
                {entity.type.toUpperCase()}
                <Icon.Chevron size={10} />
              </span>
              {typeOpen && (
                <div className="glass" style={{ position: 'absolute', top: 28, left: 0, zIndex: 30, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 6, boxShadow: 'var(--shadow)' }}>
                  {TYPES.map((t) => (
                    <div key={t} onClick={() => { save({ type: t }); setTypeOpen(false); }} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer', color: 'var(--ink)' }}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* name */}
            {editingName ? (
              <input
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={() => { save({ name: nameVal.trim() || 'Untitled' }); setEditingName(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { save({ name: nameVal.trim() || 'Untitled' }); setEditingName(false); } }}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 42, margin: '14px 0 8px', color: 'var(--ink)', background: 'transparent', border: 'none', borderBottom: '2px solid var(--clay)', outline: 'none', width: '100%' }}
              />
            ) : (
              <h1 onClick={() => { setNameVal(entity.name); setEditingName(true); }} style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 42, margin: '14px 0 8px', color: 'var(--ink)', cursor: 'text' }}>
                {entity.name}
              </h1>
            )}

            {/* aliases */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>also known as</span>
              {entity.aliases.map((a) => (
                <span key={a} style={{ fontSize: 12, padding: '2px 9px', border: '1px solid var(--line)', borderRadius: 20, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {a}
                  <span onClick={() => removeAlias(a)} style={{ cursor: 'pointer', color: 'var(--ink-3)' }}>×</span>
                </span>
              ))}
              <input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addAlias(); }}
                placeholder="+ alias"
                style={{ fontSize: 12, padding: '2px 9px', border: '1px dashed var(--line-2)', borderRadius: 20, color: 'var(--ink-2)', background: 'transparent', outline: 'none', width: 80 }}
              />
            </div>

            <div style={{ fontFamily: 'var(--font-body)', fontSize: 15.5, color: 'var(--ink-2)' }}>
              <CodexBodyEditor id={entity.id} body={entity.body} onSaved={(html) => save({ body: html })} />
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--line)', margin: '0 0 26px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <Icon.Link size={15} style={{ color: 'var(--ink-3)' }} />
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Backlinks · {backlinks.length}</span>
        </div>
        {backlinks.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink-3)' }}>
            No backlinks yet. Mention <b style={{ color: 'var(--clay)' }}>@{entity.name}</b> in a scene and it will appear here.
          </div>
        ) : (
          backlinks.map((b, i) => (
            <div key={i} className="glass" onClick={() => selectPage(b.pageId)} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 11, padding: '13px 16px', marginBottom: 9, cursor: 'pointer', boxShadow: 'var(--shadow-s)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{b.title}</span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{b.loc}</span>
              </div>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>…{b.snippet}…</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
