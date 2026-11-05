import { completionPatch } from '../core/tasks';
import type { Label, Note, Project, Task } from '../core/types';
import { PROJECT_COLORS } from '../data/colors';
import { db } from './db';
import { repo, uid } from './repo';

const nowIso = () => new Date().toISOString();

export const taskRepo = {
  async addTask(data: Omit<Task, 'id' | 'order' | 'updatedAt' | 'hlc'> & { order?: number }): Promise<Task> {
    const order = data.order ?? Date.now();
    return repo.save('tasks', { ...data, id: uid(), order } as Task);
  },
  updateTask: (id: string, change: Partial<Task>) => repo.patch<Task>('tasks', id, change),
  /** Returns the patch that was applied, so the caller can offer Undo. */
  async completeTask(task: Task, today: string): Promise<Partial<Task>> {
    const change = completionPatch(task, today, nowIso());
    await repo.patch<Task>('tasks', task.id, change);
    return change;
  },
  async undoComplete(before: Task) {
    await repo.patch<Task>('tasks', before.id, {
      completedAt: before.completedAt,
      dueDate: before.dueDate,
      completions: before.completions,
    });
  },
  reopen: (id: string) => repo.patch<Task>('tasks', id, { completedAt: undefined }),
  deleteTask: (id: string) => repo.remove('tasks', id),
  /** Undo a delete: re-save the task as it was, with a fresh stamp so it wins over the tombstone. */
  restoreTask: ({ deletedAt: _d, ...task }: Task) => repo.save('tasks', task),

  async addProject(name: string, color: string): Promise<Project> {
    const count = await db.projects.count();
    return repo.save('projects', { id: uid(), name: name.trim(), color, order: count });
  },
  updateProject: (id: string, change: Partial<Project>) => repo.patch<Project>('projects', id, change),
  /** Deleting a project deletes its tasks too (like Todoist); notes move to no project. */
  async deleteProject(id: string) {
    for (const t of await db.tasks.where('projectId').equals(id).toArray()) await repo.remove('tasks', t.id);
    for (const n of (await db.notes.toArray()).filter((n) => n.projectId === id && !n.deletedAt)) await repo.patch<Note>('notes', n.id, { projectId: undefined });
    await repo.remove('projects', id);
  },

  async addLabel(name: string, color = 'grey'): Promise<Label> {
    return repo.save('labels', { id: uid(), name: name.trim(), color });
  },
  updateLabel: (id: string, change: Partial<Label>) => repo.patch<Label>('labels', id, change),
  async deleteLabel(id: string) {
    for (const t of (await db.tasks.toArray()).filter((t) => t.labels.includes(id) && !t.deletedAt)) await repo.patch<Task>('tasks', t.id, { labels: t.labels.filter((l) => l !== id) });
    for (const n of (await db.notes.toArray()).filter((n) => n.labels.includes(id) && !n.deletedAt)) await repo.patch<Note>('notes', n.id, { labels: n.labels.filter((l) => l !== id) });
    await repo.remove('labels', id);
  },

  /** Find projects/labels by name (case-insensitive), creating the missing ones. */
  async resolveNames(projectName: string | undefined, labelNames: string[], projects: Project[], labels: Label[]) {
    let projectId: string | undefined;
    if (projectName) {
      const p = projects.find((x) => x.name.toLowerCase() === projectName.toLowerCase());
      const color = PROJECT_COLORS[(projects.length * 3 + 7) % PROJECT_COLORS.length].id; // spread hues
      projectId = p ? p.id : projectName.toLowerCase() === 'inbox' ? undefined : (await this.addProject(projectName, color)).id;
    }
    const labelIds: string[] = [];
    for (const name of labelNames) {
      const l = labels.find((x) => x.name.toLowerCase() === name.toLowerCase());
      labelIds.push(l ? l.id : (await this.addLabel(name, PROJECT_COLORS[(labels.length * 3 + labelIds.length * 3 + 2) % PROJECT_COLORS.length].id)).id);
    }
    return { projectId, labelIds };
  },
};
