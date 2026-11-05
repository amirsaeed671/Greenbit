import type { Note } from '../core/types';
import { repo, uid } from './repo';

export const noteRepo = {
  add: (data: Partial<Note> = {}) =>
    repo.save('notes', { id: uid(), title: '', body: '', pinned: false, labels: [], createdAt: new Date().toISOString(), ...data } as Note),
  update: (id: string, change: Partial<Note>) => repo.patch<Note>('notes', id, change),
  remove: (id: string) => repo.remove('notes', id),
  restore: ({ deletedAt: _d, ...note }: Note) => repo.save('notes', note),
};

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

/** Decode the HTML entities Markdown may contain (e.g. &nbsp; for an empty line). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain-text preview of a markdown body for list rows and search. */
export function noteSnippet(md: string, max = 140): string {
  return decodeEntities(md)
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/^\s*\|?[-:| ]+\|[-:| ]*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '☐ ')
    .replace(/[*_~`>|#]/g, '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .slice(0, max);
}

/** A note's display title: its title, else its first line. */
export const noteTitle = (n: Pick<Note, 'title' | 'body'>) =>
  n.title.trim() || n.body.split('\n').map((l) => noteSnippet(l, 60)).find(Boolean) || 'Untitled';
