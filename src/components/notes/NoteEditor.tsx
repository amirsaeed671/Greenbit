import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { Typography } from '@tiptap/extension-typography';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { useEffect, useRef, useState } from 'react';

const LANGS = { bash, cpp, css, diff, go, java, javascript, json, markdown, python, rust, sql, typescript, html: xml, xml, yaml } as const;
const lowlight = createLowlight(LANGS);

interface Props {
  /** Markdown in; changes come back out as Markdown. */
  value: string;
  onChange: (md: string) => void;
  /** Changing this resets the editor to `value` (opening another note). */
  docKey: string;
  /** Bumped when `value` was changed elsewhere (sync); reloads it, keeping the cursor if possible. */
  revision?: number;
  placeholder?: string;
}

function Btn({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`tb-btn${on ? ' on' : ''}`} aria-label={label} title={label} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Toolbar({ editor, source, setSource }: { editor: Editor; source: boolean; setSource: (v: boolean) => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      lang: (e.getAttributes('codeBlock').language as string) ?? '',
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const off = source;
  return (
    <div className="note-toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo" onClick={() => c().undo().run()} disabled={off || !s.canUndo}>↶</Btn>
      <Btn label="Redo" onClick={() => c().redo().run()} disabled={off || !s.canRedo}>↷</Btn>
      <i className="tb-sep" />
      <Btn label="Heading 1" on={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} disabled={off}>H1</Btn>
      <Btn label="Heading 2" on={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} disabled={off}>H2</Btn>
      <Btn label="Heading 3" on={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} disabled={off}>H3</Btn>
      <i className="tb-sep" />
      <Btn label="Bold" on={s.bold} onClick={() => c().toggleBold().run()} disabled={off}><b>B</b></Btn>
      <Btn label="Italic" on={s.italic} onClick={() => c().toggleItalic().run()} disabled={off}><i>I</i></Btn>
      <Btn label="Strikethrough" on={s.strike} onClick={() => c().toggleStrike().run()} disabled={off}><s>S</s></Btn>
      <Btn label="Inline code" on={s.code} onClick={() => c().toggleCode().run()} disabled={off}>{'<>'}</Btn>
      <Btn
        label="Link"
        on={s.link}
        disabled={off}
        onClick={() => {
          if (s.link) return void c().unsetLink().run();
          const url = window.prompt('Link URL');
          if (url) c().extendMarkRange('link').setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run();
        }}
      >
        🔗
      </Btn>
      <i className="tb-sep" />
      <Btn label="Bullet list" on={s.bullet} onClick={() => c().toggleBulletList().run()} disabled={off}>•</Btn>
      <Btn label="Numbered list" on={s.ordered} onClick={() => c().toggleOrderedList().run()} disabled={off}>1.</Btn>
      <Btn label="Checklist" on={s.task} onClick={() => c().toggleTaskList().run()} disabled={off}>☑</Btn>
      <Btn label="Quote" on={s.quote} onClick={() => c().toggleBlockquote().run()} disabled={off}>❝</Btn>
      <Btn label="Code block" on={s.codeBlock} onClick={() => c().toggleCodeBlock().run()} disabled={off}>{'{ }'}</Btn>
      {s.codeBlock && !off && (
        <select className="tb-select" aria-label="Code language" value={s.lang} onChange={(e) => c().updateAttributes('codeBlock', { language: e.target.value || null }).run()}>
          <option value="">Plain text</option>
          {Object.keys(LANGS).map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      )}
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()} disabled={off}>―</Btn>
      <Btn label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={off || s.table}>▦</Btn>
      {s.table && !off && (
        <>
          <Btn label="Add row below" onClick={() => c().addRowAfter().run()}>+row</Btn>
          <Btn label="Add column right" onClick={() => c().addColumnAfter().run()}>+col</Btn>
          <Btn label="Delete row" onClick={() => c().deleteRow().run()}>−row</Btn>
          <Btn label="Delete column" onClick={() => c().deleteColumn().run()}>−col</Btn>
          <Btn label="Delete table" onClick={() => c().deleteTable().run()}>✕▦</Btn>
        </>
      )}
      <span className="spacer" />
      <Btn label={source ? 'Show formatted' : 'Edit Markdown source'} on={source} onClick={() => setSource(!source)}>
        {source ? 'Aa' : 'MD'}
      </Btn>
    </div>
  );
}

/**
 * TipTap's useEditor creates the editor during render and destroys it if the component hasn't
 * mounted by the next tick. On a slow first render (a phone loading the editor for the first time)
 * that timer can win: the hook then swaps in a fresh editor, but effects in the same commit still
 * see the destroyed one, whose commands throw. Treat a destroyed editor like none; the re-render
 * with the fresh editor runs the effects again.
 */
export const usable = (e: Editor | null): e is Editor => !!e && !e.isDestroyed;

export default function NoteEditor({ value, onChange, docKey, revision = 0, placeholder = 'Write something… Markdown shortcuts work: # heading, - list, [ ] checklist, ``` code' }: Props) {
  const [source, setSource] = useState(false);
  const [raw, setRaw] = useState(value);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true } }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder }),
      Typography,
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: { attributes: { class: 'note-prose', 'aria-label': 'Note body' } },
    onUpdate: ({ editor: e }) => changeRef.current(e.getMarkdown()),
  });

  // Opening a different note replaces the document without an undo step.
  useEffect(() => {
    if (!usable(editor)) return;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
    setRaw(value);
    setSource(false);
  }, [docKey, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // The same note changed on another device: load it in place.
  useEffect(() => {
    if (!usable(editor) || revision === 0) return;
    const { from, to } = editor.state.selection;
    const hadFocus = editor.isFocused;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
    setRaw(value);
    if (hadFocus) {
      const max = editor.state.doc.content.size;
      editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
    }
  }, [revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSource = (on: boolean) => {
    if (!usable(editor)) return;
    if (on) setRaw(editor.getMarkdown());
    else editor.commands.setContent(raw, { contentType: 'markdown', emitUpdate: false });
    setSource(on);
  };

  if (!usable(editor)) return null;
  return (
    <div className="note-editor">
      <Toolbar editor={editor} source={source} setSource={toggleSource} />
      {source ? (
        <textarea
          className="note-source"
          value={raw}
          aria-label="Markdown source"
          spellCheck={false}
          onChange={(e) => {
            setRaw(e.target.value);
            changeRef.current(e.target.value);
          }}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
