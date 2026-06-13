import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import { Typography } from '@tiptap/extension-typography';
import { mentionExtension } from '../editor/mentionConfig';

export function CodexBodyEditor({ id, body, onSaved }: { id: string; body: string; onSaved: (html: string) => void }) {
  const timer = useRef<number | null>(null);
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Typography,
        Image,
        Placeholder.configure({ placeholder: 'Describe this entry — its history, role, secrets…' }),
        mentionExtension,
      ],
      content: body || '<p></p>',
      onUpdate: ({ editor }) => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onSaved(editor.getHTML()), 800);
      },
    },
    [id],
  );

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <div className="manuscript" style={{ ['--ms-size' as any]: '15.5px' }}>
      <EditorContent editor={editor} />
    </div>
  );
}
