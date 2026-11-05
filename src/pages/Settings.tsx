import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildExport, exportFileName, validateImport, type BackupFile } from '../core/backup';
import { useGardenData } from '../db/hooks';
import { repo } from '../db/repo';
import { AUTHOR, LogoMark } from '../components/Logo';
import { Sheet } from '../components/Sheet';
import { formatLong } from '../components/format';
import { useUI } from '../store/ui';
import { notificationPermission, requestNotifications, sendTestNotification, type PermissionState } from '../reminders/scheduler';

async function shareOrDownload(file: BackupFile, name: string) {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const f = new File([blob], name, { type: 'application/json' });
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [f] })) {
    try {
      await navigator.share({ files: [f], title: 'Greenbit backup' });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Settings() {
  const { settings, habits, entries } = useGardenData();
  const today = useUI((s) => s.today);
  const showToast = useUI((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState('');
  const archived = habits.filter((h) => h.archivedAt);
  const [perm, setPerm] = useState<PermissionState>(notificationPermission());
  const installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  const doExport = async () => {
    const snap = await repo.snapshot();
    try {
      await shareOrDownload(buildExport(snap.settings, snap), exportFileName(today));
      await repo.updateSettings({ lastExportAt: new Date().toISOString() });
      showToast('Backup exported');
    } catch {
      /* user cancelled share */
    }
  };

  const onFile = async (file: File | undefined) => {
    setImportError('');
    if (!file) return;
    const r = validateImport(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!r.ok) return setImportError(r.error);
    setPending(r.data);
  };

  const apply = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace' && !window.confirm('Replace everything on this device with the backup? Current habits and entries will be erased.')) return;
    try {
      await repo.importData(pending, mode);
      showToast(mode === 'merge' ? 'Backup merged' : 'Backup restored');
      setPending(null);
    } catch (e) {
      setImportError(`Import failed and nothing was changed: ${(e as Error).message}`);
      setPending(null);
    }
  };

  return (
    <div className="page stack">
      <h1>Settings</h1>

      <section className="card stack">
        <h2>Preferences</h2>
        <div className="field">
          <span className="label">Week starts on</span>
          <div className="segmented" role="group" aria-label="Week starts on">
            <button aria-pressed={settings.weekStartsOn === 1} onClick={() => void repo.updateSettings({ weekStartsOn: 1 })}>Monday</button>
            <button aria-pressed={settings.weekStartsOn === 0} onClick={() => void repo.updateSettings({ weekStartsOn: 0 })}>Sunday</button>
          </div>
        </div>
        <div className="field">
          <span className="label">Calendar default</span>
          <div className="segmented" role="group" aria-label="Calendar default">
            <button aria-pressed={settings.calendarMode === 'per-habit'} onClick={() => void repo.updateSettings({ calendarMode: 'per-habit' })}>Per habit</button>
            <button aria-pressed={settings.calendarMode === 'combined'} onClick={() => void repo.updateSettings({ calendarMode: 'combined' })}>Combined</button>
          </div>
        </div>
      </section>

      <section className="card stack" id="reminders">
        <h2>Reminders</h2>
        <p className="muted">
          Task reminders show as notifications on this device{' '}
          <strong>while Greenbit is open or running in a background tab</strong>. Greenbit has no server, so it can’t wake a closed browser. Reminders that come due while it’s closed appear as soon as you open it again.
        </p>
        {ios && !installed && <p className="banner small">On iPhone and iPad, notifications only work after you add Greenbit to your Home Screen (Share → Add to Home Screen).</p>}
        <div className="row">
          <span>
            Notifications: <strong>{{ granted: 'On', denied: 'Blocked', default: 'Not set up', unsupported: 'Not supported here' }[perm]}</strong>
          </span>
          <span className="spacer" />
          {perm === 'default' && (
            <button className="btn primary" onClick={async () => setPerm(await requestNotifications())}>
              Turn on notifications
            </button>
          )}
          {perm === 'granted' && (
            <button className="btn" onClick={() => void sendTestNotification()}>
              Send a test
            </button>
          )}
        </div>
        {perm === 'denied' && <p className="muted small">Your browser is blocking notifications for this site. Allow them in the browser’s site settings, then reload. Reminders will still show inside Greenbit.</p>}
      </section>

      <section className="card stack" id="backup">
        <h2>Backup</h2>
        <p className="muted">
          Greenbit keeps your tasks, notes and habits on this device, with no accounts. Browsers (especially iOS Safari) can clear site data, so export a backup now and then.
          {settings.lastExportAt ? ` Last export: ${formatLong(settings.lastExportAt.slice(0, 10))}.` : ' You haven’t exported yet.'}
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => void doExport()}>Export backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import backup…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        {importError && <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>{importError}</p>}
      </section>

      {archived.length > 0 && (
        <section className="card">
          <h2>Archived habits</h2>
          <ul className="entry-list">
            {archived.map((h) => (
              <li key={h.id}>
                <Link to={`/habits/${h.id}`}>{h.name}</Link>
                <span className="spacer" />
                <button className="btn small" onClick={() => void repo.restoreHabit(h.id)}>Restore</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card stack">
        <h2>Danger zone</h2>
        <p className="muted">Erase all tasks, notes, habits and settings from this device.</p>
        <div>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm(`Erase everything: tasks, notes, ${habits.length} habits and ${entries.length} entries? Export a backup first if you might want them back.`)) void repo.resetAll().then(() => showToast('All data erased'));
            }}
          >
            Reset all data
          </button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="about">
        <div className="row" style={{ gap: 12 }}>
          <LogoMark size={48} />
          <div>
            <h2 id="about" style={{ margin: 0 }}>About Greenbit</h2>
            <span className="muted small">Version {__APP_VERSION__}</span>
          </div>
        </div>
        <p>
          Greenbit is a local-first home for your tasks, notes and habits. Every habit is a plant that grows with small, steady effort. Works fully offline, with no tracking and no accounts.
        </p>
        <p>
          Designed and built by{' '}
          <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer">
            {AUTHOR.name}
          </a>
          . See more work at <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer">amir-ali.me</a>.
        </p>
        <p className="muted small">Daily quotes come from public-domain translations of classic works, each with a named source.</p>
      </section>

      <Sheet open={!!pending} title="Import backup" onClose={() => setPending(null)}>
        {pending && (
          <div className="stack">
            <p>
              This backup contains <strong>{pending.tasks.length.toLocaleString()} tasks</strong>, <strong>{pending.projects.length} projects</strong>, <strong>{pending.notes.length} notes</strong>, <strong>{pending.habits.length} habits</strong> and <strong>{pending.entries.length.toLocaleString()} habit entries</strong>, exported {formatLong(pending.exportedAt.slice(0, 10))}.
            </p>
            <p className="muted small">
              <strong>Merge</strong> adds anything missing and keeps the most recently edited version of anything in both. <strong>Replace</strong> erases this device first.
            </p>
            <div className="row">
              <button className="btn primary" onClick={() => void apply('merge')}>Merge</button>
              <button className="btn danger" onClick={() => void apply('replace')}>Replace</button>
              <button className="btn ghost" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
