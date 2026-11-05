import { useNavigate } from 'react-router-dom';
import { AUTO_RETRIES, dismissSyncAlert, repairSync, useSync } from '../sync/engine';
import { ReportBugLink } from './ReportBug';
import { Sheet } from './Sheet';

/** Shown only after the automatic retries (including background repairs) haven't fixed sync. */
export function SyncAlert() {
  const s = useSync();
  const navigate = useNavigate();
  const retried = s.failures > AUTO_RETRIES;
  return (
    <Sheet open={s.enabled && s.needsAttention} title="Sync needs attention" onClose={dismissSyncAlert}>
      <div className="stack">
        <p style={{ margin: 0 }}>
          {retried ? `Greenbit tried ${AUTO_RETRIES} times, including repairing automatically, but couldn’t sync this device.` : 'Greenbit can’t sync this device.'}
        </p>
        <p className="banner small" style={{ margin: 0 }}>{s.error}</p>
        <p className="muted small" style={{ margin: 0 }}>
          Your changes are safe on this device. <strong>Repair sync</strong> merges the synced copy with this device and saves the result for all devices. If this keeps happening, please report a bug: the report includes this device’s sync activity (never your data).
        </p>
        <div className="row">
          <button
            className="btn primary"
            onClick={() => {
              dismissSyncAlert();
              void repairSync();
            }}
          >
            Repair sync
          </button>
          <ReportBugLink className="btn">🐞 Report a bug</ReportBugLink>
          <button
            className="btn ghost"
            onClick={() => {
              dismissSyncAlert();
              navigate('/settings#sync');
            }}
          >
            Sync settings
          </button>
          <span className="spacer" />
          <button className="btn ghost" onClick={dismissSyncAlert}>
            Not now
          </button>
        </div>
      </div>
    </Sheet>
  );
}
