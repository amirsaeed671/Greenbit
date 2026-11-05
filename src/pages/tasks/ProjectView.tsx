import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { compareTasks, isOpen } from '../../core/tasks';
import { colorHex, PROJECT_COLORS } from '../../data/colors';
import { useTaskData } from '../../db/hooks';
import { taskRepo } from '../../db/taskRepo';
import { TaskSection, useTaskActions } from '../../components/tasks/TaskSection';
import { TaskSheet } from '../../components/tasks/TaskSheet';
import { Sheet } from '../../components/Sheet';
import { useUI } from '../../store/ui';

/** Inbox (no id), a project (/projects/:id) or a label (/labels/:id). */
export default function ProjectView({ kind }: { kind: 'inbox' | 'project' | 'label' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, projects, labels, settings, loaded } = useTaskData();
  const today = useUI((s) => s.today);
  const { open, setOpen, complete } = useTaskActions();
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const project = kind === 'project' ? projects.find((p) => p.id === id) : undefined;
  const label = kind === 'label' ? labels.find((l) => l.id === id) : undefined;

  const inScope = useMemo(
    () => tasks.filter((t) => (kind === 'inbox' ? !t.projectId : kind === 'project' ? t.projectId === id : t.labels.includes(id ?? ''))),
    [tasks, kind, id],
  );
  const openTasks = useMemo(() => inScope.filter(isOpen).sort(compareTasks), [inScope]);
  const done = useMemo(() => inScope.filter((t) => t.completedAt).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [inScope]);

  if (loaded && kind !== 'inbox' && !project && !label) return <div className="page"><h1>Not found</h1></div>;
  const title = kind === 'inbox' ? 'Inbox' : project?.name ?? `@${label?.name ?? ''}`;
  const color = project ? colorHex(project.color) : label ? colorHex(label.color) : undefined;

  return (
    <div className="page stack">
      <div className="page-head">
        <h1 className="row" style={{ gap: 10 }}>
          {color && <i className="dot big" style={{ background: color }} aria-hidden="true" />}
          {title}
        </h1>
        <div className="row">
          <button className="btn small ghost" aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide completed' : `Show completed${done.length ? ` (${done.length})` : ''}`}
          </button>
          {(project || label) && (
            <button className="btn small" onClick={() => { setName(project?.name ?? label!.name); setEditing(true); }}>
              Edit
            </button>
          )}
        </div>
      </div>
      <TaskSection
        tasks={openTasks}
        projects={projects}
        labels={labels}
        today={today}
        weekStartsOn={settings.weekStartsOn}
        showProject={kind === 'label'}
        addDefaults={kind === 'project' ? { projectId: id } : kind === 'label' ? { labelId: id } : {}}
        onOpen={(t) => setOpen(t.id)}
        onComplete={complete}
        emptyHint={<p className="muted empty small-empty">{kind === 'inbox' ? 'Your inbox is empty. Tasks without a project land here.' : 'No open tasks here.'}</p>}
      />
      {showDone && done.length > 0 && <TaskSection title="Completed" tasks={done} projects={projects} labels={labels} today={today} weekStartsOn={settings.weekStartsOn} onOpen={(t) => setOpen(t.id)} onComplete={complete} />}

      <TaskSheet task={tasks.find((t) => t.id === open) ?? null} projects={projects} labels={labels} onClose={() => setOpen(null)} />
      <Sheet open={editing} title={project ? 'Edit project' : 'Edit label'} onClose={() => setEditing(false)}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (project) void taskRepo.updateProject(project.id, { name: name.trim() });
            if (label) void taskRepo.updateLabel(label.id, { name: name.trim().replace(/^@/, '') });
            setEditing(false);
          }}
        >
          <label className="field">
            <span className="label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span className="label">Colour</span>
            <div className="row" role="radiogroup" aria-label="Colour">
              {PROJECT_COLORS.map((c) => {
                const on = (project?.color ?? label?.color) === c.id;
                return (
                  <button
                    type="button"
                    key={c.id}
                    role="radio"
                    aria-checked={on}
                    aria-label={c.name}
                    className={`swatch${on ? ' on' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => (project ? taskRepo.updateProject(project.id, { color: c.id }) : taskRepo.updateLabel(label!.id, { color: c.id }))}
                  />
                );
              })}
            </div>
          </div>
          <div className="row">
            <button className="btn primary" type="submit">Save</button>
            <span className="spacer" />
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                const msg = project ? `Delete “${project.name}” and its ${openTasks.length + done.length} tasks?` : `Delete label @${label!.name}? Tasks keep everything else.`;
                if (!window.confirm(msg)) return;
                void (project ? taskRepo.deleteProject(project.id) : taskRepo.deleteLabel(label!.id));
                setEditing(false);
                navigate('/');
              }}
            >
              Delete
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
