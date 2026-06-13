import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Icon } from '../../lib/icons';
import type { WorldMap, MapPin } from '../../lib/types';

export function MapView() {
  const { entities } = useStore();
  const selectEntity = useStore((s) => s.selectEntity);
  const [maps, setMaps] = useState<WorldMap[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [panelEntity, setPanelEntity] = useState<string | null>(null);
  const [pinMenu, setPinMenu] = useState<{ x: number; y: number; pin: MapPin } | null>(null);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; map: WorldMap } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const dragPin = useRef<{ id: string } | null>(null);

  useEffect(() => {
    const close = () => {
      setPinMenu(null);
      setTabMenu(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const deleteMap = async (map: WorldMap) => {
    if (!confirm(`Delete the map "${map.name}" and its pins?`)) return;
    await api.maps.remove(map.id);
    setTabMenu(null);
    const remaining = maps.filter((m) => m.id !== map.id);
    if (activeId === map.id) setActiveId(remaining[0]?.id ?? null);
    await load();
  };
  const renameMap = async (map: WorldMap) => {
    const name = window.prompt('Map name', map.name) ?? null;
    setTabMenu(null);
    if (name !== null) {
      await api.maps.update(map.id, { name: name.trim() || map.name });
      await load();
    }
  };

  const deletePin = async (pin: MapPin) => {
    await api.maps.removePin(pin.id);
    setPinMenu(null);
    await load();
  };
  const renamePin = async (pin: MapPin) => {
    const label = window.prompt('Pin label', pin.label) ?? null;
    setPinMenu(null);
    if (label !== null) {
      await api.maps.updatePin(pin.id, { label });
      await load();
    }
  };

  const load = () => api.maps.list().then((m) => {
    setMaps(m);
    setActiveId((cur) => cur ?? m[0]?.id ?? null);
  }).catch(() => setMaps([]));
  useEffect(() => { load(); }, []);

  const active = maps.find((m) => m.id === activeId) ?? null;
  const placeEntities = entities.filter((e) => e.type === 'location' || e.type === 'nation');

  const createMap = async () => {
    const m = await api.maps.create({ name: `Map ${maps.length + 1}` });
    setActiveId(m.id);
    await load();
  };

  const uploadImage = async (file: File) => {
    let mapId = activeId;
    if (!mapId) {
      const m = await api.maps.create({ name: 'New map' });
      mapId = m.id;
      setActiveId(m.id);
    }
    const { url } = await api.upload(file);
    await api.maps.update(mapId!, { image_path: url });
    await load();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const img = (e.currentTarget as HTMLElement).querySelector('img');
    if (!img) return;
    const r = img.getBoundingClientRect();
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;
    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return;
    setPending({ x: xPct, y: yPct });
  };

  const addPin = async (entityId: string | null, label: string) => {
    if (!active || !pending) return;
    await api.maps.addPin(active.id, { x: pending.x, y: pending.y, label, entity_id: entityId });
    setPending(null);
    await load();
  };

  const movePin = async (pin: MapPin, e: React.PointerEvent, imgEl: HTMLImageElement | null) => {
    if (!imgEl) return;
    const r = imgEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    setMaps((ms) => ms.map((m) => (m.id === active?.id ? { ...m, pins: m.pins.map((p) => (p.id === pin.id ? { ...p, x, y } : p)) } : m)));
    await api.maps.updatePin(pin.id, { x, y });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '18px 26px', borderBottom: '1px solid var(--line)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 24, margin: 0, color: 'var(--ink)' }}>Maps</h1>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, alignItems: 'center' }}>
          {maps.map((m) => (
            <span
              key={m.id}
              onClick={() => setActiveId(m.id)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setActiveId(m.id); setTabMenu({ x: e.clientX, y: e.clientY, map: m }); }}
              title="Right-click to rename or delete"
              style={{ height: 28, display: 'inline-flex', alignItems: 'center', padding: '0 13px', borderRadius: 8, background: m.id === activeId ? 'var(--clay-soft)' : 'transparent', color: m.id === activeId ? 'var(--clay)' : 'var(--ink-3)', fontSize: 12, fontWeight: m.id === activeId ? 500 : 400, cursor: 'pointer' }}
            >
              {m.name}
            </span>
          ))}
          <span onClick={createMap} title="New map" style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 16 }}>+</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>double-click to drop a pin</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '24px 30px', display: 'flex' }}>
        {!active || !active.image_path ? (
          <div
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadImage(f); }}
            style={{ flex: 1, position: 'relative', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', background: 'repeating-linear-gradient(135deg,var(--surface),var(--surface) 13px,var(--surface-2) 13px,var(--surface-2) 26px)', boxShadow: 'var(--shadow)', cursor: 'pointer' }}
          >
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
              <Icon.Map size={34} style={{ color: 'var(--ink-3)' }} />
              <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: 'var(--ink-3)' }}>drop map image (PNG · JPG · WEBP)</span>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, position: 'relative', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <TransformWrapper minScale={0.4} maxScale={8} centerOnInit doubleClick={{ disabled: true }} panning={{ excluded: ['map-pin'] }} wheel={{ step: 0.08 }}>
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                <div style={{ position: 'relative' }} onDoubleClick={onDoubleClick}>
                  <img src={active.image_path} draggable={false} style={{ display: 'block', maxWidth: '100%', userSelect: 'none' }} alt={active.name} />
                  {active.pins.map((p) => (
                    <div
                      key={p.id}
                      className="map-pin"
                      onPointerDown={(e) => { e.stopPropagation(); dragPin.current = { id: p.id }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
                      onPointerMove={(e) => { if (dragPin.current?.id === p.id) movePin(p, e, e.currentTarget.parentElement?.querySelector('img') ?? null); }}
                      onPointerUp={(e) => { dragPin.current = null; (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); }}
                      onClick={(e) => { e.stopPropagation(); if (p.entity_id) setPanelEntity(p.entity_id); }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setPinMenu({ x: e.clientX, y: e.clientY, pin: p }); }}
                      style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-100%)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                    >
                      <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '1px 7px', borderRadius: 12, whiteSpace: 'nowrap', boxShadow: 'var(--shadow-s)' }}>{p.label || '·'}</span>
                      <Icon.Pin size={22} />
                    </div>
                  ))}
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        )}
      </div>

      <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />

      {/* pin create picker */}
      {pending && (
        <div onClick={() => setPending(null)} style={overlay}>
          <div className="glass-2" onClick={(e) => e.stopPropagation()} style={picker}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 12px', color: 'var(--ink)' }}>Drop a pin</h3>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 12px' }}>Link this place to a Location or Nation in your Codex, or just label it.</p>
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
              {placeEntities.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: 8 }}>No location/nation entities yet.</div>}
              {placeEntities.map((e) => (
                <div key={e.id} onClick={() => addPin(e.id, e.name)} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
                  {e.name}
                  <span style={{ fontSize: 10.5, color: 'var(--clay)' }}>{e.type}</span>
                </div>
              ))}
            </div>
            <LabelOnly onAdd={(label) => addPin(null, label)} />
          </div>
        </div>
      )}

      {/* slide-in entity panel */}
      {panelEntity && <EntityPanel entityId={panelEntity} onClose={() => setPanelEntity(null)} onOpen={() => { selectEntity(panelEntity); setPanelEntity(null); }} />}

      {/* pin context menu */}
      {pinMenu && (
        <div
          className="glass"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: Math.min(pinMenu.x, window.innerWidth - 180), top: Math.min(pinMenu.y, window.innerHeight - 160), zIndex: 100, width: 170, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 11, padding: 6, boxShadow: 'var(--shadow)', fontFamily: 'var(--font-ui)' }}
        >
          {pinMenu.pin.entity_id && (
            <div style={pinMenuItem} onClick={() => { setPanelEntity(pinMenu.pin.entity_id); setPinMenu(null); }}>Open entry</div>
          )}
          <div style={pinMenuItem} onClick={() => renamePin(pinMenu.pin)}>Rename label</div>
          <div style={{ ...pinMenuItem, color: 'var(--danger)' }} onClick={() => deletePin(pinMenu.pin)}>Delete pin</div>
        </div>
      )}

      {/* map tab context menu */}
      {tabMenu && (
        <div
          className="glass"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: Math.min(tabMenu.x, window.innerWidth - 180), top: Math.min(tabMenu.y, window.innerHeight - 130), zIndex: 100, width: 170, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 11, padding: 6, boxShadow: 'var(--shadow)', fontFamily: 'var(--font-ui)' }}
        >
          <div style={pinMenuItem} onClick={() => renameMap(tabMenu.map)}>Rename map</div>
          <div style={{ ...pinMenuItem, color: 'var(--danger)' }} onClick={() => deleteMap(tabMenu.map)}>Delete map</div>
        </div>
      )}
    </div>
  );
}

const pinMenuItem: React.CSSProperties = { padding: '7px 12px', fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 7 };

function LabelOnly({ onAdd }: { onAdd: (label: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Label only…" style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--canvas)', color: 'var(--ink)', fontSize: 13, outline: 'none' }} />
      <button onClick={() => onAdd(v || 'Place')} style={{ height: 36, padding: '0 14px', border: '1px solid var(--forest)', background: 'var(--forest)', color: '#EFE7D6', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
    </div>
  );
}

function EntityPanel({ entityId, onClose, onOpen }: { entityId: string; onClose: () => void; onOpen: () => void }) {
  const entities = useStore((s) => s.entities);
  const ent = entities.find((e) => e.id === entityId);
  const strip = (h: string) => { const d = document.createElement('div'); d.innerHTML = h; return (d.textContent || '').trim(); };
  return (
    <div className="glass-2" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 50, background: 'var(--surface)', borderLeft: '1px solid var(--line-2)', boxShadow: '-16px 0 40px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', animation: 'panelin .25s ease both' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{ent?.name ?? 'Pin'}</span>
        <div style={{ flex: 1 }} />
        <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18 }}>×</span>
      </div>
      <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
        {ent ? (
          <>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: 'var(--clay)' }}>{ent.type.toUpperCase()}</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 28, margin: '4px 0 12px', color: 'var(--ink)' }}>{ent.name}</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>{strip(ent.body) || 'No description yet.'}</p>
            <span onClick={onOpen} style={{ fontSize: 12, color: 'var(--clay)', fontWeight: 600, cursor: 'pointer' }}>Open full page →</span>
          </>
        ) : (
          <p style={{ color: 'var(--ink-3)' }}>This pin isn't linked to a codex entry.</p>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,22,16,.42)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '14vh', animation: 'overlayin .15s ease both' };
const picker: React.CSSProperties = { width: 420, maxWidth: '92vw', background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow)' };
