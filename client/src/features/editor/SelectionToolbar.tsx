import { useEditorUi } from '../../lib/editorUi';
import { useStore } from '../../lib/store';
import { useActiveEditor } from './activeEditor';
import { inlineTarget } from './inlineTarget';
import { api } from '../../lib/api';

const TITLES: Record<string, string> = {
  tighten: 'Tighten passage',
  sensory: 'More sensory detail',
  continue: 'Continue (~150 words)',
  custom: 'Custom instruction',
};

export function SelectionToolbar() {
  const selection = useEditorUi((s) => s.selection);
  const setSelection = useEditorUi((s) => s.setSelection);
  const setDiff = useEditorUi((s) => s.setDiff);
  const setDiffLoading = useEditorUi((s) => s.setDiffLoading);
  const hasKey = useStore((s) => s.hasKey);
  const pageId = useStore((s) => s.pageId);

  if (!selection) return null;

  const run = async (tool: string) => {
    const ed = useActiveEditor.getState().editor;
    if (!ed) return;
    const { from, to } = ed.state.selection;
    const text = ed.state.doc.textBetween(from, to, ' ').trim() || selection.text;

    let instruction = '';
    if (tool === 'custom') {
      const input = window.prompt('How should I revise the selection?');
      if (input === null) return;
      instruction = input;
    }

    inlineTarget.editor = ed;
    inlineTarget.from = from;
    inlineTarget.to = to;
    setSelection(null);

    if (!hasKey) {
      setDiff({
        title: TITLES[tool] ?? 'Suggestion',
        original: text,
        suggestion:
          'The co-writer is unavailable — no Anthropic API key is configured. Add ANTHROPIC_API_KEY to your .env and restart. Your text is untouched.',
        tool,
      });
      return;
    }

    setDiff({ title: TITLES[tool] ?? 'Suggestion', original: text, suggestion: '', tool, instruction });
    setDiffLoading(true);
    try {
      const { suggestion } = await api.ai.inline({ tool, text, instruction, scenePageId: pageId });
      setDiff({ title: TITLES[tool] ?? 'Suggestion', original: text, suggestion, tool, instruction });
    } catch (err: any) {
      setDiff({ title: TITLES[tool] ?? 'Suggestion', original: text, suggestion: `Request failed: ${err?.message ?? 'unknown error'}`, tool, instruction });
    } finally {
      setDiffLoading(false);
    }
  };

  const btn: React.CSSProperties = {
    height: 30,
    padding: '0 12px',
    border: 'none',
    background: 'transparent',
    borderRadius: 7,
    cursor: 'pointer',
    color: 'var(--ink)',
    fontFamily: 'var(--font-ui)',
    fontSize: 12.5,
    fontWeight: 500,
  };

  return (
    <div
      className="glass"
      style={{
        position: 'fixed',
        left: selection.x,
        top: selection.y,
        transform: 'translate(-50%,-100%)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--surface-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 11,
        padding: 5,
        boxShadow: 'var(--shadow)',
        animation: 'fadeup .15s ease both',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={() => run('tighten')} style={btn}>✦ Tighten</button>
      <button onClick={() => run('sensory')} style={btn}>More sensory</button>
      <button onClick={() => run('continue')} style={btn}>Continue</button>
      <button onClick={() => run('custom')} style={{ ...btn, width: 30, padding: 0, color: 'var(--clay)', fontSize: 14 }}>✏</button>
    </div>
  );
}
