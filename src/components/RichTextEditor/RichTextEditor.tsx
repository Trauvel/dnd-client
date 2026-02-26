import React, { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions/placeholder';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      padding: '6px 10px',
      border: 'none',
      background: active ? '#e7f1ff' : 'transparent',
      borderRadius: 6,
      cursor: 'pointer',
      color: active ? '#0d6efd' : '#495057',
      fontSize: 14,
    }}
  >
    {children}
  </button>
);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Введите текст...',
  minHeight = 200,
  disabled = false,
}) => {
  const inputFileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; padding: 12px; outline: none;`,
        class: 'rich-text-editor-content',
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const file = Array.from(items).find((item) => item.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        const f = file.getAsFile();
        if (!f) return true;
        fileToDataUrl(f).then((src) => {
          editor?.chain().focus().setImage({ src }).run();
        });
        return true;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = Array.from(files).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        fileToDataUrl(file).then((src) => {
          const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (coordinates) {
            editor?.chain().focus().insertContentAt(coordinates.pos, { type: 'image', attrs: { src } }).run();
          } else {
            editor?.chain().focus().setImage({ src }).run();
          }
        });
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const addImageFromFile = useCallback(() => {
    inputFileRef.current?.click();
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file?.type.startsWith('image/')) return;
      fileToDataUrl(file).then((src) => {
        editor?.chain().focus().setImage({ src }).run();
      });
      e.target.value = '';
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div
      style={{
        border: '1px solid #dee2e6',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '8px 10px',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
        }}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Жирный (Ctrl+B)"
        >
          <b>Ж</b>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Курсив (Ctrl+I)"
        >
          <i>К</i>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Заголовок 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Заголовок 3"
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Маркированный список"
        >
          •
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Нумерованный список"
        >
          1.
        </ToolbarButton>
        <ToolbarButton onClick={addImageFromFile} title="Вставить изображение или скриншот">
          🖼
        </ToolbarButton>
        <input
          ref={inputFileRef}
          type="file"
          accept="image/*"
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .rich-text-editor-content p { margin: 0 0 0.5em 0; }
        .rich-text-editor-content p:last-child { margin-bottom: 0; }
        .rich-text-editor-content h2 { font-size: 1.25em; margin: 0.75em 0 0.25em 0; }
        .rich-text-editor-content h3 { font-size: 1.1em; margin: 0.5em 0 0.25em 0; }
        .rich-text-editor-content ul, .rich-text-editor-content ol { margin: 0.25em 0; padding-left: 1.5em; }
        .rich-text-editor-content img { max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 8px 0; }
        .rich-text-editor-content .is-editor-empty::before { color: #adb5bd; }
      `}</style>
    </div>
  );
};
