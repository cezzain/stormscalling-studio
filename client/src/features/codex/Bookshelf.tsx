import { useState } from 'react';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';
import type { Entity, EntityType } from '../../lib/types';

interface Shelf {
  id: string;
  label: string;
  subtitle: string;
  types: EntityType[];
  primary: EntityType; // the type created by this shelf's "+ New"
  cover: string; // CSS background for the book cover
}

// Three tomes on the shelf. Together their types cover the whole codex.
const SHELVES: Shelf[] = [
  {
    id: 'characters',
    label: 'Characters',
    subtitle: 'The people of your world',
    types: ['character'],
    primary: 'character',
    cover: 'linear-gradient(145deg, var(--clay), var(--clay-2))',
  },
  {
    id: 'places',
    label: 'Places',
    subtitle: 'Nations & locations',
    types: ['nation', 'location'],
    primary: 'location',
    cover: 'linear-gradient(145deg, var(--forest), var(--forest-2))',
  },
  {
    id: 'lore',
    label: 'Factions & Lore',
    subtitle: 'Factions & concepts',
    types: ['faction', 'concept'],
    primary: 'faction',
    cover: 'linear-gradient(145deg, var(--sage), var(--tan))',
  },
];

export function Bookshelf() {
  const entities = useStore((s) => s.entities);
  const selectEntity = useStore((s) => s.selectEntity);
  const refreshEntities = useStore((s) => s.refreshEntities);
  const [openId, setOpenId] = useState<string | null>(null);

  const countFor = (shelf: Shelf) => entities.filter((e) => shelf.types.includes(e.type)).length;

  const addTo = async (shelf: Shelf) => {
    const e = await api.entities.create({ type: shelf.primary, name: `New ${shelf.primary}` });
    await refreshEntities();
    selectEntity(e.id);
  };

  if (openId) {
    const shelf = SHELVES.find((s) => s.id === openId)!;
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
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 20 }}>{items.length} {items.length === 1 ? 'entry' : 'entries'}</div>

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

  // ---- the shelf: three closed tomes ----
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px 70px' }}>
      <div style={{ textAlign: 'center', marginBottom: 34 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 32, margin: 0, color: 'var(--ink)' }}>Codex</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-3)', marginTop: 6 }}>Choose a volume to open.</p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center' }}>
        {SHELVES.map((shelf, i) => (
          <BookSpine key={shelf.id} shelf={shelf} count={countFor(shelf)} delay={i * 0.08} onOpen={() => setOpenId(shelf.id)} />
        ))}
      </div>

      {/* the shelf plank */}
      <div style={{ width: 460, maxWidth: '82%', height: 14, marginTop: 6, borderRadius: '3px', background: 'linear-gradient(var(--tan), var(--ink-3))', opacity: 0.5, boxShadow: '0 14px 26px rgba(0,0,0,.18)' }} />
    </div>
  );
}

const COVER_W = 156;
const BOOK_H = 232;
const DEPTH = 46;

// A 3D book standing spine-out on the shelf. At rest you see the spine; on
// hover it swings a little to reveal the cover; clicking opens it fully.
function BookSpine({ shelf, count, delay, onOpen }: { shelf: Shelf; count: number; delay: number; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  // rotateY: 76° ≈ spine to camera, 26° ≈ cover cracked open toward viewer.
  const rot = hover ? 26 : 76;
  const faceBase: React.CSSProperties = { position: 'absolute', left: '50%', top: '50%', backfaceVisibility: 'hidden' };
  return (
    <div style={{ perspective: 1400, width: DEPTH + 26, height: BOOK_H, animation: `fadeup .5s ${delay}s both` }}>
      <div
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={`Open ${shelf.label}`}
        style={{
          position: 'relative', width: COVER_W, height: BOOK_H, cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transform: `translateX(${(DEPTH - COVER_W) / 2 + 13}px) translateY(${hover ? -10 : 0}px) rotateY(${rot}deg)`,
          transition: 'transform .55s var(--spring, ease)',
          filter: hover ? 'drop-shadow(0 22px 30px rgba(0,0,0,.34))' : 'drop-shadow(0 12px 20px rgba(0,0,0,.22))',
        }}
      >
        {/* COVER — wide front face */}
        <div
          style={{
            ...faceBase, width: COVER_W, height: BOOK_H, marginLeft: -COVER_W / 2, marginTop: -BOOK_H / 2,
            transform: `translateZ(${DEPTH / 2}px)`, background: shelf.cover, borderRadius: '3px 11px 11px 3px',
            padding: '22px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}
        >
          <div style={{ position: 'absolute', left: 8, top: 10, bottom: 10, width: 3, background: 'rgba(0,0,0,.2)', borderRadius: 2 }} />
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

        {/* SPINE — narrow left face, title runs vertically */}
        <div
          style={{
            ...faceBase, width: DEPTH, height: BOOK_H, marginLeft: -DEPTH / 2, marginTop: -BOOK_H / 2,
            transform: `rotateY(-90deg) translateZ(${COVER_W / 2}px)`, background: shelf.cover, filter: 'brightness(.86)',
            borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 2px 0 6px rgba(0,0,0,.25), inset -2px 0 6px rgba(0,0,0,.25)',
          }}
        >
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 1, color: '#F5EEDF', whiteSpace: 'nowrap' }}>{shelf.label}</span>
        </div>

        {/* PAGES — right edge */}
        <div
          style={{
            ...faceBase, width: DEPTH, height: BOOK_H - 8, marginLeft: -DEPTH / 2, marginTop: -(BOOK_H - 8) / 2,
            transform: `rotateY(90deg) translateZ(${COVER_W / 2}px)`,
            background: 'repeating-linear-gradient(90deg, var(--surface), var(--surface) 2px, var(--surface-2) 2px, var(--surface-2) 4px)',
            borderRadius: 2,
          }}
        />
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
