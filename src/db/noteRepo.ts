import type { Note } from '../core/types';
import { repo, uid } from './repo';

export const noteRepo = {
  add: (data: Partial<Note> = {}) =>
    repo.save('notes', { id: uid(), title: '', body: '', pinned: false, labels: [], createdAt: new Date().toISOString(), ...data } as Note),
  update: (id: string, change: Partial<Note>) => repo.patch<Note>('notes', id, change),
  remove: (id: string) => repo.remove('notes', id),
  restore: ({ deletedAt: _d, ...note }: Note) => repo.save('notes', note),
};

/** Plain-text preview of a markdown body for list rows and search. */
export function noteSnippet(md: string, max = 140): string {
  return md
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/^\s*\|?[-:| ]+\|[-:| ]*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '☐ ')
    .replace(/[*_~`>|#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** A note's display title: its title, else its first line. */
export const noteTitle = (n: Pick<Note, 'title' | 'body'>) => n.title.trim() || noteSnippet(n.body.split('\n').find((l) => l.trim()) ?? '', 60) || 'Untitled';
