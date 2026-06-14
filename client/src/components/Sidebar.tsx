import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Icon } from '../lib/icons';
import type { Page, SceneStatus, EntityType, Entity } from '../lib/types';

const STATUS_COLOR: Record<SceneStatus, string> = {
  draft: 'var(--s-draft)',
  revised: 'var(--s-revised)',
  done: 'var(--s-done)',
};

// Default titles for newly-created nodes, by kind.
const KIND_TITLE: Record<Page['kind'], string> = {
  book: 'New book',
  part: 'New part',
  chapter: 'New chapter',
  page: 'Untitled page',
  folder: 'New folder',
};

// Child kinds offered in the context menu, following the manuscript hierarchy
// Part → Chapter → Page. A leaf page offers a sibling page.
const ADD_BY_KIND: Record<Page['kind'], Page['kind'][]> = {
  book: ['part', 'chapter', 'page'],
  part: ['chapter', 'page'],
  chapter: ['page'],
  folder: ['page', 'folder'],
  page: ['page'],
};

const NAV: Array<{ id: ReturnType<typeof Object.keys>[number]; label: string; icon: keyof typeof Icon }> = [
  { id: 'editor', label: 'Manuscript', icon: 'Manuscript' },
  { id: 'lore', label: 'Lore', icon: 'Pin' },
  { id: 'codex', label: 'Codex', icon: 'Codex' },
  { id: 'timeline', label: 'Timeline', icon: 'Timeline' },
  { id: 'map', label: 'Map', icon: 'Map' },
] as any;

interface MenuState {
  x: number;
  y: number;
  node: Page;
}

export function Sidebar({ open = true, compact = false }: { open?: boolean; compact?: boolean }) {
  const store = useStore();
  const { view, pages, entities, expanded, chapterId, pageId, entityId } = store;

  const [width, setWidth] = useState<number>(() => Number(localStorage.getItem('scs-sidebar-w')) || 286);
  const resizing = useRef(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [entityMenu, setEntityMenu] = useState<{ x: number; y: number; entity: Entity } | null>(null);
  const [renamingEntity, setRenamingEntity] = useState<string | null>(null);

  // ---- resize handle ----
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const w = Math.min(460, Math.max(220, e.clientX));
      setWidth(w);
    };
    const onUp = () => {
      if (resizing.current) {
        resizing.current = false;
        localStorage.setItem('scs-sidebar-w', String(width));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [width]);

  useEffect(() => {
    const close = () => {
      setMenu(null);
      setEntityMenu(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const childrenOf = (parent: string | null) =>
    pages.filter((p) => p.parent_id === parent).sort((a, b) => a.position - b.position);

  // ---- tree actions ----
  const addChild = async (parentId: string | null, kind: Page['kind'], title: string, section?: Page['section']) => {
    const page = await store.createPage({ parent_id: parentId, kind, title, ...(section ? { section } : {}) });
    if (parentId) store.setExpanded(parentId, true);
    store.setExpanded(page.id, true);
    if (kind === 'page') store.selectPage(page.id);
    else if (kind === 'chapter') store.selectChapter(page.id);
    // Parts/books/folders are organisational — just reveal them, don't open the
    // editor on an empty container. The user adds a chapter inside next.
    setMenu(null);
  };

  const setStatus = async (id: string, status: SceneStatus | null) => {
    store.updatePageLocal(id, { status });
    await api.pages.update(id, { status });
    setMenu(null);
  };

  const togglePin = async (node: Page) => {
    const pinned = !node.pinned;
    store.updatePageLocal(node.id, { pinned });
    await api.pages.update(node.id, { pinned });
    setMenu(null);
  };

  const remove = async (node: Page) => {
    if (!confirm(`Delete "${node.title}" and everything inside it?`)) return;
    await store.deletePage(node.id);
    setMenu(null);
  };

  const commitRename = async (id: string) => {
    const title = renameVal.trim() || 'Untitled';
    store.updatePageLocal(id, { title });
    await api.pages.update(id, { title });
    setRenaming(null);
  };

  // ---- codex entity actions ----
  const commitEntityRename = async (id: string) => {
    const name = renameVal.trim() || 'Untitled';
    await api.entities.update(id, { name });
    await store.refreshEntities();
    setRenamingEntity(null);
  };
  const duplicateEntity = async (ent: Entity) => {
    const copy = await api.entities.create({
      type: ent.type,
      name: `${ent.name} (copy)`,
      aliases: ent.aliases,
      cover_image: ent.cover_image,
      body: ent.body,
    });
    await store.refreshEntities();
    store.selectEntity(copy.id);
    setEntityMenu(null);
  };
  const changeEntityType = async (ent: Entity, type: EntityType) => {
    await api.entities.update(ent.id, { type });
    await store.refreshEntities();
    setEntityMenu(null);
  };
  const deleteEntity = async (ent: Entity) => {
    if (!confirm(`Delete "${ent.name}" from the codex?`)) return;
    await api.entities.remove(ent.id);
    await store.refreshEntities();
    if (useStore.getState().entityId === ent.id) {
      useStore.setState({ entityId: useStore.getState().entities[0]?.id ?? null });
    }
    setEntityMenu(null);
  };

  // ---- drag reorder ----
  const onDrop = async (target: Page) => {
    if (!dragId || dragId === target.id) return setDragId(null);
    const dragged = pages.find((p) => p.id === dragId);
    if (!dragged) return setDragId(null);
    // avoid dropping a node into its own descendant
    let a: string | null = target.id;
    while (a) {
      if (a === dragId) return setDragId(null);
      a = pages.find((p) => p.id === a)?.parent_id ?? null;
    }
    const siblings = childrenOf(target.parent_id).filter((p) => p.id !== dragId);
    const idx = siblings.findIndex((p) => p.id === target.id);
    const reordered = [...siblings.slice(0, idx + 1), dragged, ...siblings.slice(idx + 1)];
    const items = reordered.map((p, i) => ({ id: p.id, parent_id: target.parent_id, position: i }));
    items.forEach((it) => store.updatePageLocal(it.id, { parent_id: it.parent_id, position: it.position }));
    await api.pages.reorder(items);
    setDragId(null);
  };

  // ---- render a manuscript node ----
  const renderNode = (node: Page, depth: number): React.ReactNode => {
    const kids = childrenOf(node.id);
    const isLeaf = node.kind === 'page';
    const isContainer = !isLeaf;
    const open = expanded[node.id];
    const nodeView = node.section === 'lore' ? 'lore' : 'editor';
    const active = (isLeaf && pageId === node.id && view === nodeView) || (node.kind === 'chapter' && chapterId === node.id && view === nodeView);
    const pad = 8 + depth * 15;

    const onClick = () => {
      if (isLeaf) store.selectPage(node.id);
      else {
        store.toggleExpand(node.id);
        if (node.kind === 'chapter') store.selectChapter(node.id);
      }
    };

    return (
      <div key={node.id}>
        <div
          draggable={renaming !== node.id}
          onDragStart={(e) => {
            e.stopPropagation();
            setDragId(node.id);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop(node);
          }}
          onClick={onClick}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY, node });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 30,
            paddingRight: 8,
            paddingLeft: pad,
            borderRadius: 8,
            background: active ? 'var(--clay-soft)' : 'transparent',
            cursor: 'pointer',
            fontSize: node.kind === 'page' ? 12.8 : 13,
            color: active ? 'var(--ink)' : node.kind === 'book' || node.kind === 'chapter' || node.kind === 'part' ? 'var(--ink)' : 'var(--ink-2)',
            fontWeight: active || node.kind === 'book' || node.kind === 'chapter' || node.kind === 'part' ? 600 : 400,
            opacity: dragId === node.id ? 0.4 : 1,
          }}
        >
          <span style={{ width: 12, flex: '0 0 auto', color: 'var(--ink-3)', fontSize: 10, textAlign: 'center' }}>
            {isContainer && kids.length ? (open ? '▾' : '▸') : ''}
          </span>
          {node.kind === 'chapter' && node.status && (
            <span style={{ width: 9, height: 9, flex: '0 0 auto', borderRadius: '50%', background: STATUS_COLOR[node.status] }} />
          )}
          {isLeaf && (
            <span
              style={{
                width: 9,
                height: 9,
                flex: '0 0 auto',
                borderRadius: node.pinned ? 2 : '50%',
                background: active ? 'var(--clay)' : node.pinned ? 'var(--clay)' : 'var(--line-2)',
              }}
            />
          )}
          {renaming === node.id ? (
            <input
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => commitRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(node.id);
                if (e.key === 'Escape') setRenaming(null);
              }}
              style={{
                flex: 1,
                border: '1px solid var(--clay)',
                borderRadius: 5,
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                fontFamily: 'inherit',
                fontSize: 12.5,
                padding: '2px 6px',
                outline: 'none',
              }}
            />
          ) : (
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: node.kind === 'book' ? 'var(--font-display)' : 'var(--font-ui)',
              }}
            >
              {node.title}
            </span>
          )}
          {node.pinned && <span style={{ fontSize: 11, flex: '0 0 auto' }}>📌</span>}
        </div>
        {isContainer && open && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };

  // ---- codex grouped ----
  const codexGroups: Array<{ id: string; label: string; types: EntityType[] }> = [
    { id: 'codexChar', label: 'Characters', types: ['character'] },
    { id: 'codexWorld', label: 'World', types: ['nation', 'location', 'faction', 'concept'] },
  ];

  const manuscriptRoots = childrenOf(null).filter((p) => p.section !== 'lore');
  const loreRoots = childrenOf(null).filter((p) => p.section === 'lore');

  return (
    <aside
      className="glass"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
        overflow: 'hidden',
        // The retract: inline it collapses its width to 0; floating (compact)
        // it slides off to the left. Either way it eases out slowly.
        transition: 'width .42s cubic-bezier(.4,0,.2,1), transform .42s cubic-bezier(.4,0,.2,1)',
        ...(compact
          ? {
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width,
              zIndex: 41,
              transform: open ? 'translateX(0)' : 'translateX(-100%)',
              boxShadow: open ? '0 0 44px rgba(0,0,0,.28)' : 'none',
            }
          : {
              position: 'relative',
              flex: '0 0 auto',
              width: open ? width : 0,
              zIndex: 20,
            }),
      }}
    >
      {/* aurora / mist background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div
          style={{
            position: 'absolute',
            top: '-30%',
            left: '-20%',
            width: '80%',
            height: '70%',
            borderRadius: '50%',
            background: 'radial-gradient(circle,var(--forest-2),transparent 70%)',
            filter: 'blur(40px)',
            opacity: 0.1,
            animation: 'mist 26s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            right: '-15%',
            width: '75%',
            height: '60%',
            borderRadius: '50%',
            background: 'radial-gradient(circle,var(--clay),transparent 70%)',
            filter: 'blur(46px)',
            opacity: 0.07,
            animation: 'mist2 32s ease-in-out infinite',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width, flex: '0 0 auto' }}>
        {/* nav */}
        <nav style={{ padding: '12px 10px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((n) => {
            const Ico = Icon[n.icon];
            const activeNav = view === (n.id as any);
            return (
              <button
                key={n.id as string}
                onClick={() => {
                  if (n.id === 'editor') store.selectSection('manuscript');
                  else if (n.id === 'lore') store.selectSection('lore');
                  else if (n.id === 'codex') store.openCodexShelf();
                  else store.setView(n.id as any);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  height: 34,
                  padding: '0 11px',
                  border: 'none',
                  borderRadius: 9,
                  background: activeNav ? 'var(--clay-soft)' : 'transparent',
                  color: activeNav ? 'var(--clay)' : 'var(--ink-2)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                  fontWeight: activeNav ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Ico size={17} />
                {n.label}
              </button>
            );
          })}
        </nav>

        <div style={{ height: 1, background: 'var(--line)', margin: '8px 14px' }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px 16px', minHeight: 0 }}>
          {/* MANUSCRIPT */}
          <SectionHeader label="MANUSCRIPT" addTitle="New part" onAdd={() => addChild(null, 'part', 'New part', 'manuscript')} />
          {manuscriptRoots.map((r) => renderNode(r, 0))}

          {/* LORE */}
          <SectionHeader label="LORE" onAdd={() => addChild(null, 'page', 'New lore page', 'lore')} style={{ marginTop: 14 }} />
          {loreRoots.length ? (
            loreRoots.map((r) => renderNode(r, 0))
          ) : (
            <div style={{ padding: '4px 12px 6px', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Build your world bible here — pages for environment, plot, magic, factions. Everything here is sent to the co-writer as canon.
            </div>
          )}

          {/* CODEX */}
          <SectionHeader
            label="CODEX"
            onAdd={async () => {
              const e = await api.entities.create({ type: 'character', name: 'New character' });
              await store.refreshEntities();
              store.selectEntity(e.id);
            }}
            style={{ marginTop: 14 }}
          />
          {codexGroups.map((g) => {
            // "World" is a catch-all so custom-volume entity types still appear.
            const items = g.id === 'codexWorld'
              ? entities.filter((e) => e.type !== 'character')
              : entities.filter((e) => g.types.includes(e.type));
            const open = expanded[g.id] ?? true;
            return (
              <div key={g.id}>
                <div
                  onClick={() => store.toggleExpand(g.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 29,
                    paddingRight: 8,
                    paddingLeft: 8,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    color: 'var(--ink)',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: 12, color: 'var(--ink-3)', fontSize: 10, textAlign: 'center' }}>{open ? '▾' : '▸'}</span>
                  <span style={{ flex: 1 }}>{g.label}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{items.length}</span>
                </div>
                {open &&
                  items.map((e) => {
                    const active = e.id === entityId && view === 'codex';
                    return (
                      <div
                        key={e.id}
                        onClick={() => store.selectEntity(e.id)}
                        onContextMenu={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setRenameVal(e.name);
                          setEntityMenu({ x: ev.clientX, y: ev.clientY, entity: e });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          height: 29,
                          paddingRight: 8,
                          paddingLeft: 23,
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: 12.5,
                          background: active ? 'var(--clay-soft)' : 'transparent',
                          color: active ? 'var(--ink)' : 'var(--ink-2)',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        <span style={{ width: 12 }} />
                        {renamingEntity === e.id ? (
                          <input
                            autoFocus
                            value={renameVal}
                            onChange={(ev) => setRenameVal(ev.target.value)}
                            onClick={(ev) => ev.stopPropagation()}
                            onBlur={() => commitEntityRename(e.id)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') commitEntityRename(e.id);
                              if (ev.key === 'Escape') setRenamingEntity(null);
                            }}
                            style={{ flex: 1, border: '1px solid var(--clay)', borderRadius: 5, background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12.5, padding: '2px 6px', outline: 'none' }}
                          />
                        ) : (
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>

        {/* settings pinned to the bottom */}
        <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--line)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            onClick={() => store.setView('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              height: 34,
              padding: '0 11px',
              border: 'none',
              borderRadius: 9,
              background: view === 'settings' ? 'var(--clay-soft)' : 'transparent',
              color: view === 'settings' ? 'var(--clay)' : 'var(--ink-2)',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              fontWeight: view === 'settings' ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Icon.Settings size={17} />
            Settings
          </button>
        </div>
      </div>

      {/* resize handle */}
      <div
        onMouseDown={() => {
          resizing.current = true;
        }}
        style={{ position: 'absolute', top: 0, right: 0, width: 5, height: '100%', cursor: 'col-resize', zIndex: 3 }}
      />

      {/* context menu */}
      {menu && (
        <ContextMenu
          menu={menu}
          onRename={() => {
            setRenameVal(menu.node.title);
            setRenaming(menu.node.id);
            setMenu(null);
          }}
          onAdd={(kind) => addChild(menu.node.kind === 'page' ? menu.node.parent_id : menu.node.id, kind, KIND_TITLE[kind])}
          onDuplicate={() => { store.duplicatePage(menu.node.id); setMenu(null); }}
          onStatus={(s) => setStatus(menu.node.id, s)}
          onPin={() => togglePin(menu.node)}
          onDelete={() => remove(menu.node)}
        />
      )}

      {/* codex entity context menu */}
      {entityMenu && (
        <EntityContextMenu
          menu={entityMenu}
          onOpen={() => {
            store.selectEntity(entityMenu.entity.id);
            setEntityMenu(null);
          }}
          onRename={() => {
            setRenameVal(entityMenu.entity.name);
            setRenamingEntity(entityMenu.entity.id);
            setEntityMenu(null);
          }}
          onDuplicate={() => duplicateEntity(entityMenu.entity)}
          onChangeType={(t) => changeEntityType(entityMenu.entity, t)}
          onDelete={() => deleteEntity(entityMenu.entity)}
        />
      )}
    </aside>
  );
}

function SectionHeader({ label, onAdd, addTitle, style }: { label: string; onAdd: () => void; addTitle?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 4px', ...style }}>
      <span style={{ fontSize: 10.5, letterSpacing: 1.6, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      <span onClick={onAdd} title={addTitle ?? 'Add'} style={{ fontSize: 16, color: 'var(--ink-3)', cursor: 'pointer', lineHeight: 1 }}>
        +
      </span>
    </div>
  );
}

function ContextMenu({
  menu,
  onRename,
  onAdd,
  onDuplicate,
  onStatus,
  onPin,
  onDelete,
}: {
  menu: MenuState;
  onRename: () => void;
  onAdd: (kind: Page['kind']) => void;
  onDuplicate: () => void;
  onStatus: (s: SceneStatus | null) => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const item: React.CSSProperties = {
    padding: '7px 12px',
    fontSize: 12.5,
    color: 'var(--ink)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    borderRadius: 7,
  };
  // Which child kinds make sense under this node, following the
  // Part → Chapter → Page hierarchy. A leaf page offers a sibling page.
  const addKinds = ADD_BY_KIND[menu.node.kind] ?? ['page'];
  const isLeaf = menu.node.kind === 'page';
  return (
    <div
      className="glass"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: Math.min(menu.x, window.innerWidth - 200),
        top: Math.min(menu.y, window.innerHeight - 360),
        zIndex: 100,
        width: 196,
        background: 'var(--surface-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 11,
        padding: 6,
        boxShadow: 'var(--shadow)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={item} onClick={onRename}>
        Rename
      </div>
      {addKinds.map((kind) => (
        <div key={kind} style={item} onClick={() => onAdd(kind)}>
          New {kind} {isLeaf ? 'after' : 'inside'}
        </div>
      ))}
      <div style={item} onClick={onDuplicate}>
        Duplicate <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>⌘D</span>
      </div>
      <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />
      <div style={{ padding: '4px 12px 2px', fontSize: 10, letterSpacing: 1, color: 'var(--ink-3)', fontWeight: 600 }}>STATUS</div>
      {(['draft', 'revised', 'done'] as SceneStatus[]).map((s) => (
        <div key={s} style={{ ...item, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => onStatus(s)}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s] }} />
          {s[0].toUpperCase() + s.slice(1)}
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />
      <div style={item} onClick={onPin}>
        {menu.node.pinned ? 'Unpin Lore Bible' : 'Pin as Lore Bible 📌'}
      </div>
      <div style={{ ...item, color: 'var(--danger)' }} onClick={onDelete}>
        Delete
      </div>
    </div>
  );
}

const ENTITY_TYPES: EntityType[] = ['character', 'nation', 'location', 'faction', 'concept'];

function EntityContextMenu({
  menu,
  onOpen,
  onRename,
  onDuplicate,
  onChangeType,
  onDelete,
}: {
  menu: { x: number; y: number; entity: Entity };
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onChangeType: (t: EntityType) => void;
  onDelete: () => void;
}) {
  const item: React.CSSProperties = { padding: '7px 12px', fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 7 };
  return (
    <div
      className="glass"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: Math.min(menu.x, window.innerWidth - 200),
        top: Math.min(menu.y, window.innerHeight - 320),
        zIndex: 100,
        width: 190,
        background: 'var(--surface-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 11,
        padding: 6,
        boxShadow: 'var(--shadow)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={item} onClick={onOpen}>
        Open
      </div>
      <div style={item} onClick={onRename}>
        Rename
      </div>
      <div style={item} onClick={onDuplicate}>
        Duplicate
      </div>
      <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />
      <div style={{ padding: '4px 12px 2px', fontSize: 10, letterSpacing: 1, color: 'var(--ink-3)', fontWeight: 600 }}>TYPE</div>
      {ENTITY_TYPES.map((t) => (
        <div key={t} style={{ ...item, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => onChangeType(t)}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: t === menu.entity.type ? 'var(--clay)' : 'var(--line-2)' }} />
          {t[0].toUpperCase() + t.slice(1)}
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />
      <div style={{ ...item, color: 'var(--danger)' }} onClick={onDelete}>
        Delete
      </div>
    </div>
  );
}
