import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isOpen } from '../core/tasks';
import { colorHex, PROJECT_COLORS } from '../data/colors';
import { useTaskData } from '../db/hooks';
import { taskRepo } from '../db/taskRepo';
import { useUI } from '../store/ui';
import { Celebration } from './Celebration';
import { IconBrowse, IconCalendar, IconChart, IconClose, IconGarden, IconInbox, IconNotes, IconPlus, IconSettings, IconSun, IconToday, IconUpcoming } from './Icons';
import { Credit, LogoMark } from './Logo';
import { Sheet } from './Sheet';
import { QuickAdd } from './tasks/QuickAdd';
import { Toasts } from './Toasts';
import { useSync } from '../sync/engine';
import { IconBug, IconSync } from './Icons';
import { ReportBugLink } from './ReportBug';

const MOBILE_TABS = [
  { to: '/', label: 'Today', Icon: IconToday, end: true },
  { to: '/upcoming', label: 'Upcoming', Icon: IconUpcoming },
  { to: '/notes', label: 'Notes', Icon: IconNotes },
  { to: '/habits', label: 'Habits', Icon: IconGarden },
];

/** Phone menu: the desktop sidebar, sliding in from the left over the current page. */
function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('a, button')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const els = ref.current.querySelectorAll<HTMLElement>('a[href], button');
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
          <motion.aside
            ref={ref}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { x: '-100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '-100%', transition: { duration: 0.18, ease: 'easeIn' } }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          >
            <div className="drawer-head">
              <Link to="/" className="nav-brand drawer-brand" aria-label="Greenbit home" onClick={onClose}>
                <LogoMark size={30} />
                <span>Greenbit</span>
              </Link>
              <button className="btn ghost icon-btn" onClick={onClose} aria-label="Close menu">
                <IconClose width={22} height={22} />
              </button>
            </div>
            <div className="drawer-links">
              <Sidebar />
            </div>
            <Credit className="credit drawer-credit" />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const HABIT_TABS = [
  { to: '/habits', label: 'Garden', Icon: IconGarden, end: true },
  { to: '/habits/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/habits/insights', label: 'Insights', Icon: IconChart },
  { to: '/habits/progress', label: 'Progress', Icon: IconSun },
];

const cls = ({ isActive }: { isActive: boolean }) => `side-link${isActive ? ' active' : ''}`;

export function HabitsSubnav() {
  return (
    <nav className="subnav" aria-label="Habits">
      {HABIT_TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

function NewProject({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('blue');
  const navigate = useNavigate();
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const p = await taskRepo.addProject(name, color);
        onDone();
        navigate(`/projects/${p.id}`);
      }}
    >
      <label className="field">
        <span className="label">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home, Work, Side project" />
      </label>
      <div className="row" role="radiogroup" aria-label="Colour">
        {PROJECT_COLORS.map((c) => (
          <button type="button" key={c.id} role="radio" aria-checked={color === c.id} aria-label={c.name} className={`swatch${color === c.id ? ' on' : ''}`} style={{ background: c.hex }} onClick={() => setColor(c.id)} />
        ))}
      </div>
      <button className="btn primary" type="submit" disabled={!name.trim()}>Add project</button>
    </form>
  );
}

function SyncBadge() {
  const s = useSync();
  if (!s.enabled) return null;
  const label = { idle: 'Synced', syncing: 'Syncing…', error: 'Sync problem', offline: 'Offline', off: '' }[s.phase];
  return (
    <NavLink to="/settings#sync" className={cls} title={s.error}>
      <IconSync /> <span>{label}</span>
      <i className={`sync-dot ${s.phase}`} aria-hidden="true" />
    </NavLink>
  );
}

export function Sidebar() {
  const { tasks, projects, labels } = useTaskData();
  const today = useUI((s) => s.today);
  const setQuickAdd = useUI((s) => s.setQuickAdd);
  const [newProject, setNewProject] = useState(false);
  const live = tasks.filter(isOpen);
  const count = (f: (t: (typeof live)[number]) => boolean) => live.filter(f).length || '';
  return (
    <>
      <button className="btn primary add-btn" onClick={() => setQuickAdd(true)}>
        <IconPlus width={18} height={18} /> Add task
      </button>
      <NavLink to="/" end className={cls}><IconToday /> <span>Today</span><em>{count((t) => !!t.dueDate && t.dueDate <= today)}</em></NavLink>
      <NavLink to="/upcoming" className={cls}><IconUpcoming /> <span>Upcoming</span></NavLink>
      <NavLink to="/inbox" className={cls}><IconInbox /> <span>Inbox</span><em>{count((t) => !t.projectId)}</em></NavLink>
      <NavLink to="/notes" className={cls}><IconNotes /> <span>Notes</span></NavLink>

      <div className="side-group">
        <span>Projects</span>
        <button className="icon-mini" aria-label="Add project" onClick={() => setNewProject(true)}>+</button>
      </div>
      {projects.filter((p) => !p.archivedAt).map((p) => (
        <NavLink key={p.id} to={`/projects/${p.id}`} className={cls}>
          <i className="dot" style={{ background: colorHex(p.color) }} aria-hidden="true" />
          <span>{p.name}</span>
          <em>{count((t) => t.projectId === p.id)}</em>
        </NavLink>
      ))}
      {labels.length > 0 && <div className="side-group"><span>Labels</span></div>}
      {labels.map((l) => (
        <NavLink key={l.id} to={`/labels/${l.id}`} className={cls}>
          <i className="dot" style={{ background: colorHex(l.color) }} aria-hidden="true" />
          <span>@{l.name}</span>
        </NavLink>
      ))}

      <div className="side-group"><span>Habits</span></div>
      {HABIT_TABS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={cls}><Icon /> <span>{label}</span></NavLink>
      ))}
      <div className="side-group" />
      <NavLink to="/settings" className={cls}><IconSettings /> <span>Settings</span></NavLink>
      <SyncBadge />
      <ReportBugLink className="side-link">
        <IconBug /> <span>Report a bug</span>
      </ReportBugLink>
      <Sheet open={newProject} title="New project" onClose={() => setNewProject(false)}>
        <NewProject onDone={() => setNewProject(false)} />
      </Sheet>
    </>
  );
}

export function Layout() {
  const [drawer, setDrawer] = useState(false);
  const quickAddOpen = useUI((s) => s.quickAddOpen);
  const setQuickAdd = useUI((s) => s.setQuickAdd);
  const { projects, labels, settings } = useTaskData();
  const location = useLocation();
  const onTaskPage = !location.pathname.startsWith('/habits') && !location.pathname.startsWith('/notes') && !location.pathname.startsWith('/settings');
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  // Any navigation (or opening quick add) closes the phone menu.
  useEffect(() => setDrawer(false), [location.pathname, location.hash]);
  useEffect(() => {
    if (quickAddOpen) setDrawer(false);
  }, [quickAddOpen]);

  // Q opens quick add anywhere (unless typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== 'q' || e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      setQuickAdd(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setQuickAdd]);

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <Link to="/" className="nav-brand" aria-label="Greenbit home">
          <LogoMark size={34} />
          <span>Greenbit</span>
        </Link>
        <div className="side-links">
          <Sidebar />
        </div>
        <div className="nav-links">
          {MOBILE_TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
          <button className={`tab${drawer ? ' active' : ''}`} onClick={() => setDrawer(true)} aria-haspopup="dialog" aria-expanded={drawer}>
            <IconBrowse />
            <span>Browse</span>
          </button>
        </div>
        <Credit className="nav-credit" />
      </nav>
      <main className="main" id="main">
        <Link to="/" className="mobile-brand" aria-label="Greenbit home">
          <LogoMark size={30} />
          <span>Greenbit</span>
        </Link>
        <Outlet />
      </main>
      <AnimatePresence>
        {onTaskPage && !quickAddOpen && (
          <motion.button className="fab" aria-label="Add task" onClick={() => setQuickAdd(true)} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <IconPlus width={26} height={26} />
          </motion.button>
        )}
      </AnimatePresence>
      <Sheet open={quickAddOpen} title="Add task" onClose={() => setQuickAdd(false)}>
        <QuickAdd projects={projects} labels={labels} weekStartsOn={settings.weekStartsOn} defaults={projectMatch ? { projectId: projectMatch[1] } : {}} onClose={() => setQuickAdd(false)} closeOnAdd />
      </Sheet>
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <Celebration />
      <Toasts />
    </div>
  );
}
