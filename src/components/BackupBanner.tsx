import { Link } from 'react-router-dom';
import { addDays } from '../core/dates';
import type { Settings } from '../core/types';
import { repo } from '../db/repo';

/** Shows when there are entries and no export (or dismissal) in the last 14 days. */
export function BackupBanner({ settings, hasData, today }: { settings: Settings; hasData: boolean; today: string }) {
  if (!hasData) return null;
  const cutoff = addDays(today, -14);
  const last = [settings.lastExportAt, settings.reminderDismissedAt].filter(Boolean).map((s) => s!.slice(0, 10)).sort().pop();
  if (last && last > cutoff) return null;
  return (
    <div className="banner" role="note">
      <span aria-hidden="true">🧺</span>
      <span style={{ flex: 1, minWidth: 200 }}>
        {settings.lastExportAt ? 'It’s been a while since your last backup.' : 'Your tasks, notes and habits live only on this device.'} Export a copy to keep it safe.
      </span>
      <Link className="btn small primary" to="/settings#backup">
        Back up
      </Link>
      <button className="btn small ghost" onClick={() => void repo.updateSettings({ reminderDismissedAt: today })}>
        Later
      </button>
    </div>
  );
}
