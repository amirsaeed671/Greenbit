import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// On a slow first render TipTap can hand back an editor it has already destroyed
// (its commands then throw "Cannot read properties of null (reading 'commands')").
const destroyed = {
  isDestroyed: true,
  get commands(): never {
    throw new TypeError("Cannot read properties of null (reading 'commands')");
  },
  get state(): never {
    throw new TypeError("Cannot read properties of null (reading 'state')");
  },
};

vi.mock('@tiptap/react', () => ({
  useEditor: () => destroyed,
  useEditorState: () => ({}),
  EditorContent: () => null,
}));

describe('NoteEditor', () => {
  it('ignores an editor TipTap has already destroyed instead of crashing', async () => {
    const { default: NoteEditor, usable } = await import('./NoteEditor');
    expect(usable(destroyed as never)).toBe(false);
    expect(usable(null)).toBe(false);
    expect(() => render(<NoteEditor value="# Hello" onChange={() => {}} docKey="n1" revision={1} />)).not.toThrow();
  });
});
