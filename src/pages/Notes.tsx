import { formatDistanceToNow } from 'date-fns';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Note } from '../core/types';
import { colorHex } from '../data/colors';
import { useNotes, useTaskData } from '../db/hooks';
import { noteRepo, noteSnippet, noteTitle } from '../db/noteRepo';
import { IconLeft, IconPlus } from '../components/Icons';
import { useUI } from '../store/ui';

const NoteEditor = lazy(() => import('../components/notes/NoteEditor'));

function NotePane({ note }: { note: Note }) {
  const { projects } = useTaskData();
  const navigate = useNavigate();
  const showToast = useUI((s) => s.showToast);
  const [title, setTitle] = useState(note.title);
  const pending = useRef<string | null>(null);
  const timer = useRef(0);
  const titleRef = useRef<HTMLInputElement>(null);
  /** The body this pane last loaded or saved. Any other value arriving means another device changed it. */
  const known = useRef(note.body);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setTitle(note.title);
    known.current = note.body;
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A newer version synced from another device: show it in place, unless you're mid-edit
  // (then your version is saved and becomes the newest).
  useEffect(() => {
    if (note.body !== known.current && pending.current === null) {
      known.current = note.body;
      setRevision((r) => r + 1);
    }
  }, [note.body]);
  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(note.title);
  }, [note.title]);

  // Autosave the body half a second after typing stops, and on leaving.
  const flush = () => {
    window.clearTimeout(timer.current);
    const body = pending.current?.trim();
    if (body !== undefined && body !== note.body) {
      known.current = body;
      void noteRepo.update(note.id, { body });
    }
    pending.current = null;
  };
  useEffect(() => flush, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const words = (pending.current ?? note.body).split(/\s+/).filter(Boolean).length;
  return (
    <article className="note-pane">
      <div className="note-meta row">
        <Link to="/notes" className="btn small ghost note-back" aria-label="All notes">
          <IconLeft width={18} height={18} /> Notes
        </Link>
        <select className="chip" aria-label="Project" value={note.projectId ?? ''} onChange={(e) => void noteRepo.update(note.id, { projectId: e.target.value || undefined })}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}># {p.name}</option>
          ))}
        </select>
        <button className={`chip${note.pinned ? ' set' : ''}`} aria-pressed={note.pinned} onClick={() => void noteRepo.update(note.id, { pinned: !note.pinned })}>
          📌 {note.pinned ? 'Pinned' : 'Pin'}
        </button>
        <span className="spacer" />
        <span className="muted small">{words} words · edited {formatDistanceToNow(new Date(note.updatedAt ?? note.createdAt), { addSuffix: true })}</span>
        <button
          className="btn small ghost"
          onClick={() => {
            flush();
            void noteRepo.remove(note.id);
            navigate('/notes');
            showToast('Note deleted', { label: 'Undo', run: () => void noteRepo.restore(note) });
          }}
        >
          Delete
        </button>
      </div>
      <input
        ref={titleRef}
        className="note-title"
        value={title}
        placeholder="Title"
        aria-label="Note title"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== note.title && void noteRepo.update(note.id, { title: title.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), (document.querySelector('.note-prose') as HTMLElement | null)?.focus())}
      />
      <Suspense fallback={<p className="muted">Loading editor…</p>}>
        <NoteEditor
          docKey={note.id}
          revision={revision}
          value={note.body}
          onChange={(md) => {
            pending.current = md;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(flush, 500);
          }}
        />
      </Suspense>
    </article>
  );
}

export default function Notes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notes, loaded } = useNotes();
  const { projects } = useTaskData();
  const [q, setQ] = useState('');
  const current = notes.find((n) => n.id === id);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes
      .filter((n) => !needle || `${n.title}\n${n.body}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
  }, [notes, q]);

  const create = async () => {
    const n = await noteRepo.add();
    navigate(`/notes/${n.id}`);
    window.setTimeout(() => (document.querySelector('.note-title') as HTMLElement | null)?.focus(), 80);
  };

  return (
    <div className={`notes-layout${id ? ' has-note' : ''}`}>
      <aside className="notes-list">
        <div className="page-head">
          <h1>Notes</h1>
          <button className="btn primary small" onClick={() => void create()}>
            <IconPlus width={16} height={16} /> New note
          </button>
        </div>
        <input className="notes-search" type="search" placeholder="Search notes" aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
        {loaded && notes.length === 0 && (
          <div className="empty small-empty">
            <p className="muted">Notes support headings, checklists, tables and code blocks, and are saved as Markdown.</p>
            <button className="btn primary" onClick={() => void create()}>Write your first note</button>
          </div>
        )}
        <ul className="note-rows">
          {list.map((n) => {
            const p = projects.find((x) => x.id === n.projectId);
            return (
              <li key={n.id}>
                <Link to={`/notes/${n.id}`} className={`note-row${n.id === id ? ' active' : ''}`} aria-current={n.id === id ? 'page' : undefined}>
                  <strong>{n.pinned && <span aria-label="Pinned">📌 </span>}{noteTitle(n)}</strong>
                  <span className="muted small note-snippet">{(n.title.trim() ? noteSnippet(n.body) : noteSnippet(n.body).replace(noteTitle(n), '').trim()) || 'No content'}</span>
                  <span className="muted small row" style={{ gap: 6 }}>
                    {formatDistanceToNow(new Date(n.updatedAt ?? n.createdAt), { addSuffix: true })}
                    {p && (
                      <>
                        · <i className="dot" style={{ background: colorHex(p.color), width: 7, height: 7 }} aria-hidden="true" /> {p.name}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {q && list.length === 0 && <p className="muted small">No notes match “{q}”.</p>}
      </aside>
      <section className="notes-main">
        {current ? <NotePane key={current.id} note={current} /> : id && loaded ? <p className="muted">This note was deleted.</p> : <div className="notes-placeholder muted">Select a note, or create a new one.</div>}
      </section>
    </div>
  );
}
