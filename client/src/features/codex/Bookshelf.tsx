import { useState } from 'react';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';
import { type Volume, getVolumes, addVolume, removeVolume, hasHiddenDefaults, restoreDefaultVolumes } from '../../lib/volumes';
import type { Entity, EntityType } from '../../lib/types';

export function Bookshelf() {
  const entities = useStore((s) => s.entities);
  const selectEntity = useStore((s) => s.selectEntity);
  const refreshEntities = useStore((s) => s.refreshEntities);
  const createPage = useStore((s) => s.createPage);
  const selectChapter = useStore((s) => s.selectChapter);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [volumes, setVolumes] = useState<Volume[]>(getVolumes);

  const countFor = (vol: Volume) => entities.filter((e) => vol.types.includes(e.type)).length;

  const addTo = async (vol: Volume) => {
    const e = await api.entities.create({ type: vol.primary as EntityType, name: `New ${vol.primary}` });
    await refreshEntities();
    selectEntity(e.id);
  };

  const createVolume = () => {
    const name = window.prompt('Name your new volume (e.g. Magic, Beasts, Religions)');
    if (name && name.trim()) setVolumes(addVolume(name));
  };
  // A "manuscript book" is a separate top-level story in the Manuscript tree —
  // somewhere to keep side stories, drafts, or anything else for later.
  const createBook = async () => {
    setAddOpen(false);
    const name = window.prompt('Name your new book (a separate story or notebook)');
    if (!name || !name.trim()) return;
    const book = await createPage({ parent_id: null, kind: 'book', title: name.trim(), section: 'manuscript' });
    selectChapter(book.id); // jump into the Manuscript view, focused on the new book
  };
  const deleteVolume = async (vol: Volume) => {
    const inVol = entities.filter((e) => vol.types.includes(e.type));
    if (vol.custom) {
      // Custom volume → delete the volume and the entries filed under it.
      const msg = inVol.length
        ? `Delete the "${vol.label}" volume and its ${inVol.length} ${inVol.length === 1 ? 'entry' : 'entries'}? This can't be undone.`
        : `Delete the "${vol.label}" volume?`;
      if (!window.confirm(msg)) return;
      for (const e of inVol) {
        try {
          await api.entities.remove(e.id);
        } catch {
          /* ignore */
        }
      }
      if (inVol.length) await refreshEntities();
    } else {
      // Built-in volume → just hide it; its entries stay in the codex.
      if (!window.confirm(`Hide the "${vol.label}" volume? Its ${inVol.length} ${inVol.length === 1 ? 'entry' : 'entries'} stay in your codex and you can restore the volume later.`)) return;
    }
    setVolumes(removeVolume(vol.id));
    setOpenId(null);
  };

  if (openId) {
    const shelf = volumes.find((s) => s.id === openId)!;
    const items = entities.filter((e) => shelf.types.includes(e.type));
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '34px 30px 90px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <button
            onClick={() => setOpenId(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px',
              border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surface-2)',
              color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 500,
            }}
          >
            <Icon.Chevron size={11} style={{ transform: 'rotate(90deg)' }} /> Bookshelf
          </button>

          <div style={{ display: 'flex', gap: 30, marginTop: 22, alignItems: 'flex-start' }}>
            {/* the opened tome */}
            <div style={{ perspective: 1300, flex: '0 0 auto' }}>
              <div style={{ position: 'relative', width: 168, height: 226 }}>
                {/* visible inner pages */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 7, background: 'var(--surface-2)', boxShadow: 'var(--shadow)', border: '1px solid var(--line)' }} />
                <div style={{ position: 'absolute', top: 12, bottom: 12, left: 10, right: 14, borderRadius: 4, background: 'repeating-linear-gradient(0deg, var(--surface), var(--surface) 6px, var(--surface-2) 6px, var(--surface-2) 7px)' }} />
                {/* swinging cover */}
                <div
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '4px 9px 9px 4px', background: shelf.cover,
                    transformOrigin: 'left center', transformStyle: 'preserve-3d', backfaceVisibility: 'hidden',
                    animation: 'bookOpen .85s cubic-bezier(.22,.61,.36,1) forwards',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  <div style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 2, background: 'rgba(0,0,0,.22)' }} />
                </div>
              </div>
            </div>

            {/* entries revealed by the opened book */}
            <div style={{ flex: 1, minWidth: 0, animation: 'fadeup .5s .25s both' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 34, margin: '2px 0 2px', color: 'var(--ink)' }}>{shelf.label}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{items.length} {items.length === 1 ? 'entry' : 'entries'}</span>
                <span onClick={() => deleteVolume(shelf)} style={{ fontSize: 12, color: 'var(--danger)', cursor: 'pointer' }}>
                  {shelf.custom ? 'Delete volume' : 'Hide volume'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 13 }}>
                {items.map((e) => (
                  <EntityCard key={e.id} entity={e} onOpen={() => selectEntity(e.id)} />
                ))}
                <div
                  onClick={() => addTo(shelf)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 92,
                    border: '1.5px dashed var(--line-2)', borderRadius: 13, color: 'var(--ink-3)', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 500,
                  }}
                >
                  <Icon.Plus size={15} /> New {shelf.primary}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rack the volumes (plus the trailing "Add volume" tile) onto shelves of at
  // most six, so a seventh book starts a fresh shelf above.
  type Slot = { kind: 'book'; vol: Volume; delay: number } | { kind: 'add' };
  const slots: Slot[] = volumes.map((vol, i) => ({ kind: 'book', vol, delay: (i % BOOKS_PER_SHELF) * 0.08 }));
  slots.push({ kind: 'add' });
  const shelves: Slot[][] = [];
  for (let i = 0; i < slots.length; i += BOOKS_PER_SHELF) shelves.push(slots.slice(i, i + BOOKS_PER_SHELF));

  // ---- the shelf: closed tomes, racked six to a plank ----
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: shelves.length > 1 ? 'flex-start' : 'center', alignItems: 'center', padding: '40px 24px 70px' }}>
      <div style={{ textAlign: 'center', marginBottom: 34 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 32, margin: 0, color: 'var(--ink)' }}>Codex</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-3)', marginTop: 6 }}>Choose a volume to open.</p>
      </div>

      {/* Books are racked onto shelves of up to six; extra books start a new
          shelf stacked above, and each plank only spans the books on it. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        {shelves.map((row, ri) => (
          <div key={ri} style={{ display: 'inline-flex', flexDirection: 'column', maxWidth: '100%' }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', justifyContent: 'center', padding: '0 18px' }}>
              {row.map((slot) =>
                slot.kind === 'add' ? (
                  <div key="__add" style={{ position: 'relative', flex: '0 0 auto' }}>
                    <div
                      onClick={() => setAddOpen((o) => !o)}
                      title="Add a volume or a book"
                      style={{
                        width: 132, height: BOOK_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
                        border: '1.5px dashed var(--line-2)', borderRadius: 11, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12, textAlign: 'center',
                      }}
                    >
                      <Icon.Plus size={18} />
                      Add<br />new
                    </div>
                    {addOpen && (
                      <>
                        <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                        <div
                          className="glass"
                          style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 51,
                            width: 214, padding: 6, borderRadius: 13, border: '1px solid var(--line-2)', boxShadow: 'var(--shadow)',
                          }}
                        >
                          <button onClick={() => { setAddOpen(false); createVolume(); }} style={addItem}>
                            <Icon.Codex size={16} />
                            <span style={{ display: 'block' }}>
                              <span style={{ fontWeight: 600 }}>Codex volume</span>
                              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-3)' }}>A new book of entries</span>
                            </span>
                          </button>
                          <button onClick={createBook} style={addItem}>
                            <Icon.Manuscript size={16} />
                            <span style={{ display: 'block' }}>
                              <span style={{ fontWeight: 600 }}>Manuscript book</span>
                              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-3)' }}>A separate story to write</span>
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <BookSpine key={slot.vol.id} shelf={slot.vol} count={countFor(slot.vol)} delay={slot.delay} onOpen={() => setOpenId(slot.vol.id)} />
                ),
              )}
            </div>
            {/* this shelf's plank — width follows the books racked on it */}
            <div style={{ width: '100%', height: 14, marginTop: 6, borderRadius: '3px', background: 'linear-gradient(var(--tan), var(--ink-3))', opacity: 0.5, boxShadow: '0 14px 26px rgba(0,0,0,.18)' }} />
          </div>
        ))}
      </div>

      {hasHiddenDefaults() && (
        <span
          onClick={() => setVolumes(restoreDefaultVolumes())}
          style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Restore hidden volumes
        </span>
      )}
    </div>
  );
}

const BOOK_W = 172;
const BOOK_H = 232;
const BOOKS_PER_SHELF = 6;

const addItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px',
  border: 'none', background: 'transparent', borderRadius: 9, cursor: 'pointer',
  color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 12.5, textAlign: 'left',
};

// A plain front-facing book cover. Hovering lifts and tilts it slightly;
// clicking opens it into the entries view.
function BookSpine({ shelf, count, delay, onOpen }: { shelf: Volume; count: number; delay: number; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ perspective: 1100, width: BOOK_W, height: BOOK_H, animation: `fadeup .5s ${delay}s both` }}>
      <div
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={`Open ${shelf.label}`}
        style={{
          position: 'relative', width: BOOK_W, height: BOOK_H, cursor: 'pointer',
          borderRadius: '4px 11px 11px 4px', background: shelf.cover,
          boxShadow: hover ? '0 22px 40px rgba(0,0,0,.28)' : 'var(--shadow)',
          transform: hover ? 'translateY(-8px) rotateY(-12deg)' : 'translateY(0) rotateY(-3deg)',
          transformOrigin: 'left center', transition: 'transform .4s var(--spring, ease), box-shadow .35s ease',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 18px',
        }}
      >
        {/* spine highlight + page edge */}
        <div style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 3, background: 'rgba(0,0,0,.22)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, background: 'rgba(255,255,255,.12)', borderRadius: '0 11px 11px 0' }} />
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>VOLUME</div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 23, lineHeight: 1.1, color: '#F5EEDF' }}>{shelf.label}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.72)', marginTop: 7 }}>{shelf.subtitle}</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,.85)' }}>
          <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: 'rgba(0,0,0,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{count}</span>
          {count === 1 ? 'entry' : 'entries'}
        </div>
      </div>
    </div>
  );
}

function EntityCard({ entity, onOpen }: { entity: Entity; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="glass"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 13,
        border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', boxShadow: 'var(--shadow-s)',
        transform: hover ? 'translateY(-3px) scale(1.025)' : 'none',
        transition: 'transform .4s var(--spring, ease)',
      }}
    >
      <div
        style={{
          width: 44, height: 56, flex: '0 0 auto', borderRadius: 7, border: '1px solid var(--line)',
          background: entity.cover_image
            ? `center/cover url(${entity.cover_image})`
            : 'linear-gradient(145deg, var(--surface-2), var(--tan))',
          display: 'grid', placeItems: 'center',
        }}
      >
        {!entity.cover_image && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-3)' }}>{entity.name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{entity.type[0].toUpperCase() + entity.type.slice(1)}</div>
      </div>
    </div>
  );
}
