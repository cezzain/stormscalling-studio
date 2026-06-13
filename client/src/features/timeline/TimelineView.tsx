import { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';
import type { TimelineEvent } from '../../lib/types';

const COLORS = ['var(--clay)', 'var(--s-draft)', 'var(--s-revised)', 'var(--s-done)', 'var(--sage)', 'var(--forest-2)'];

export function TimelineView() {
  const { entities, calendar, pages } = useStore();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState<Partial<TimelineEvent> | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [eventMenu, setEventMenu] = useState<{ x: number; y: number; ev: TimelineEvent } | null>(null);

  const load = () => api.timeline.list().then(setEvents).catch(() => setEvents([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const close = () => setEventMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const duplicate = async (ev: TimelineEvent) => {
    await api.timeline.create({ title: `${ev.title} (copy)`, in_world_date: ev.in_world_date, description: ev.description, color: ev.color, entity_ids: ev.entity_ids, scene_id: ev.scene_id });
    setEventMenu(null);
    load();
  };

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? '—';

  const save = async (e: Partial<TimelineEvent>) => {
    if (e.id) await api.timeline.update(e.id, e);
    else await api.timeline.create(e);
    setEditing(null);
    load();
  };
  const remove = async (id: string) => { await api.timeline.remove(id); setEditing(null); load(); };

  const onDrop = async (target: TimelineEvent) => {
    if (!dragId || dragId === target.id) return setDragId(null);
    const list = [...events];
    const di = list.findIndex((e) => e.id === dragId);
    const ti = list.findIndex((e) => e.id === target.id);
    const [moved] = list.splice(di, 1);
    list.splice(ti, 0, moved);
    setEvents(list);
    await Promise.all(list.map((e, i) => api.timeline.update(e.id, { sort_order: i })));
    setDragId(null);
  };

  const cardWidth = Math.round(230 * zoom);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: '0 0 auto', padding: '26px 30px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 30, margin: '0 0 4px', color: 'var(--ink)' }}>The Long Tide</h1>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>
              {calendar ? `Year ${calendar.currentYear} of the Saltmarch Reckoning` : 'Master timeline'} · filter by character or place
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))} style={zoomBtn}>−</button>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.15))} style={zoomBtn}>+</button>
            <button onClick={() => setEditing({ title: '', in_world_date: '', description: '', color: 'var(--clay)', entity_ids: [] })} style={addBtn}>
              <Icon.Plus size={14} /> Event
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {entities.slice(0, 12).map((e) => {
            const on = filter === e.id;
            return (
              <span
                key={e.id}
                onClick={() => setFilter((f) => (f === e.id ? null : e.id))}
                style={{ height: 28, display: 'inline-flex', alignItems: 'center', padding: '0 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `1px solid ${on ? 'var(--clay)' : 'var(--line-2)'}`, background: on ? 'var(--clay)' : 'transparent', color: on ? '#fff' : 'var(--ink-2)', fontWeight: on ? 600 : 400 }}
              >
                {e.name}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0, padding: '10px 30px 30px', position: 'relative' }}>
        {events.length === 0 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-body)', fontSize: 15 }}>
            <div style={{ textAlign: 'center', maxWidth: 420 }}>
              <Icon.Timeline size={34} style={{ color: 'var(--ink-3)' }} />
              <p style={{ marginTop: 14 }}>No events yet. Add the first beat of your story with the “Event” button — give it an in-world date and link the characters and places it touches.</p>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', height: '100%', minWidth: Math.max(events.length * (cardWidth + 34) + 120, 1280), display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'linear-gradient(90deg,transparent,var(--line-2) 6%,var(--line-2) 94%,transparent)' }} />
            <div style={{ display: 'flex', gap: 34, alignItems: 'center' }}>
              {events.map((ev) => {
                const dim = filter && !ev.entity_ids.includes(filter) ? 0.28 : 1;
                return (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={() => setDragId(ev.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); onDrop(ev); }}
                    onClick={() => setEditing(ev)}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setEventMenu({ x: e.clientX, y: e.clientY, ev }); }}
                    style={{ flex: `0 0 ${cardWidth}px`, opacity: dim, transition: 'opacity .25s', cursor: 'pointer' }}
                  >
                    <div className="glass" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderTop: `3px solid ${ev.color}`, borderRadius: 12, padding: '14px 15px', boxShadow: 'var(--shadow)', position: 'relative' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, color: 'var(--clay)' }}>{ev.in_world_date || 'undated'}</span>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 18, margin: '5px 0 7px', color: 'var(--ink)' }}>{ev.title}</h3>
                      <p style={{ margin: '0 0 11px', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>{ev.description}</p>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                        {ev.entity_ids.map((id) => (
                          <span key={id} style={{ fontSize: 10, padding: '1px 8px', borderRadius: 14, background: 'var(--clay-soft)', color: 'var(--clay)' }}>{entityName(id)}</span>
                        ))}
                      </div>
                      <div style={{ position: 'absolute', left: '50%', bottom: -30, width: 11, height: 11, borderRadius: '50%', background: ev.color, border: '2px solid var(--canvas)', transform: 'translateX(-50%)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EventModal
          ev={editing}
          entities={entities}
          pages={pages}
          onSave={save}
          onDelete={editing.id ? () => remove(editing.id!) : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {eventMenu && (
        <div
          className="glass"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: Math.min(eventMenu.x, window.innerWidth - 180), top: Math.min(eventMenu.y, window.innerHeight - 160), zIndex: 100, width: 170, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 11, padding: 6, boxShadow: 'var(--shadow)', fontFamily: 'var(--font-ui)' }}
        >
          <div style={menuItem} onClick={() => { setEditing(eventMenu.ev); setEventMenu(null); }}>Edit</div>
          <div style={menuItem} onClick={() => duplicate(eventMenu.ev)}>Duplicate</div>
          <div style={{ ...menuItem, color: 'var(--danger)' }} onClick={() => { remove(eventMenu.ev.id); setEventMenu(null); }}>Delete</div>
        </div>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = { padding: '7px 12px', fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 7 };

function EventModal({ ev, entities, pages, onSave, onDelete, onClose }: any) {
  const [draft, setDraft] = useState<Partial<TimelineEvent>>(ev);
  const set = (p: Partial<TimelineEvent>) => setDraft((d) => ({ ...d, ...p }));
  const toggleEntity = (id: string) => {
    const ids = draft.entity_ids ?? [];
    set({ entity_ids: ids.includes(id) ? ids.filter((x: string) => x !== id) : [...ids, id] });
  };
  return (
    <div onClick={onClose} style={overlay}>
      <div className="glass-2" onClick={(e) => e.stopPropagation()} style={modal}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '0 0 16px', color: 'var(--ink)' }}>{ev.id ? 'Edit event' : 'New event'}</h3>
        <Field label="Title"><input style={inp} value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="In-world date"><input style={inp} placeholder="Yr 312 · Low Tide" value={draft.in_world_date ?? ''} onChange={(e) => set({ in_world_date: e.target.value })} /></Field>
        <Field label="Description"><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Colour">
          <div style={{ display: 'flex', gap: 7 }}>
            {COLORS.map((c) => (
              <span key={c} onClick={() => set({ color: c })} style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer', boxShadow: draft.color === c ? '0 0 0 2px var(--ink)' : '0 0 0 1px var(--line-2)' }} />
            ))}
          </div>
        </Field>
        <Field label="Linked entities">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {entities.map((en: any) => {
              const on = (draft.entity_ids ?? []).includes(en.id);
              return (
                <span key={en.id} onClick={() => toggleEntity(en.id)} style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${on ? 'var(--clay)' : 'var(--line-2)'}`, background: on ? 'var(--clay-soft)' : 'transparent', color: on ? 'var(--clay)' : 'var(--ink-2)' }}>{en.name}</span>
              );
            })}
          </div>
        </Field>
        <Field label="Scene link">
          <select style={inp} value={draft.scene_id ?? ''} onChange={(e) => set({ scene_id: e.target.value || null })}>
            <option value="">— none —</option>
            {pages.filter((p: any) => p.kind === 'page').map((p: any) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => onSave(draft)} style={primaryBtn}>Save</button>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          {onDelete && <button onClick={onDelete} style={{ ...ghostBtn, color: 'var(--danger)', marginLeft: 'auto' }}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 5 }}>{label}</div>
    {children}
  </div>
);
const zoomBtn: React.CSSProperties = { width: 30, height: 30, border: '1px solid var(--line)', background: 'var(--canvas)', color: 'var(--ink-2)', borderRadius: 8, cursor: 'pointer', fontSize: 16 };
const addBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', border: '1px solid var(--clay)', background: 'var(--clay)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,22,16,.42)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '8vh', animation: 'overlayin .15s ease both' };
const modal: React.CSSProperties = { width: 460, maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto', background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow)' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--canvas)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none' };
const primaryBtn: React.CSSProperties = { height: 36, padding: '0 18px', border: '1px solid var(--forest)', background: 'var(--forest)', color: '#EFE7D6', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const ghostBtn: React.CSSProperties = { height: 36, padding: '0 14px', border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-2)', borderRadius: 9, cursor: 'pointer', fontSize: 13 };
