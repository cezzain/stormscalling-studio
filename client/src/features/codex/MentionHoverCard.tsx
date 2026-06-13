import { useStore } from '../../lib/store';
import { useEditorUi } from '../../lib/editorUi';

const TYPE_LABEL: Record<string, string> = {
  character: 'CHARACTER',
  nation: 'NATION',
  location: 'LOCATION',
  faction: 'FACTION',
  concept: 'CONCEPT',
};

function strip(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  const t = (d.textContent || '').replace(/\s+/g, ' ').trim();
  return t.length > 180 ? t.slice(0, 180) + '…' : t;
}

export function MentionHoverCard() {
  const hover = useEditorUi((s) => s.hover);
  const setHover = useEditorUi((s) => s.setHover);
  const entities = useStore((s) => s.entities);
  const selectEntity = useStore((s) => s.selectEntity);

  if (!hover) return null;
  const ent = entities.find((e) => e.id === hover.entityId);
  if (!ent) return null;

  return (
    <div
      className="glass"
      onMouseEnter={() => setHover(hover)}
      onMouseLeave={() => setHover(null)}
      style={{
        position: 'fixed',
        left: hover.x,
        top: hover.y,
        zIndex: 70,
        width: 268,
        background: 'var(--surface-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 13,
        padding: 15,
        boxShadow: 'var(--shadow)',
        animation: 'fadeup .15s ease both',
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <div
          style={{
            width: 46,
            height: 58,
            flex: '0 0 auto',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: ent.cover_image
              ? `center/cover url(${ent.cover_image})`
              : 'repeating-linear-gradient(135deg,var(--surface),var(--surface) 5px,var(--canvas) 5px,var(--canvas) 10px)',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.5, color: 'var(--clay)' }}>{TYPE_LABEL[ent.type]}</span>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 20, margin: '2px 0 0', color: 'var(--ink)', lineHeight: 1.1 }}>{ent.name}</h4>
        </div>
      </div>
      <p style={{ margin: '11px 0 12px', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
        {strip(ent.body) || 'No description yet.'}
      </p>
      <span
        onClick={() => {
          setHover(null);
          selectEntity(ent.id);
        }}
        style={{ fontSize: 11.5, color: 'var(--clay)', fontWeight: 600, cursor: 'pointer' }}
      >
        Open page →
      </span>
    </div>
  );
}
