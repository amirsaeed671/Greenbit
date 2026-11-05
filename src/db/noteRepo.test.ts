import { describe, expect, it } from 'vitest';
import { decodeEntities, noteSnippet, noteTitle } from './noteRepo';

describe('note previews', () => {
  it('never shows HTML entities or empty-line markers', () => {
    const body = 'markdown\n\n\n\nsync this so I can view this on my device\n\n\n\n&nbsp;\n\nhello ho &amp; bye';
    expect(noteSnippet(body)).toBe('markdown sync this so I can view this on my device hello ho & bye');
  });
  it('strips markdown syntax', () => {
    expect(noteSnippet('# Title\n\n- [ ] task\n\n**bold** and `code` [link](https://x.y)\n\n```js\nconst a = 1;\n```')).toBe('Title ☐ task bold and code link [code]');
    expect(noteSnippet('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('a b 1 2');
  });
  it('decodes numeric entities and leaves unknown ones', () => {
    expect(decodeEntities('&#169; &#x2014; &bogus;')).toBe('© — &bogus;');
  });
  it('title falls back to the first line', () => {
    expect(noteTitle({ title: '', body: '&nbsp;\n\nFirst real line' })).toBe('First real line');
  });
});
