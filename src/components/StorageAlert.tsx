import { useEffect, useRef } from 'react';
import { useWrites } from '../db/pending';
import { useUI } from '../store/ui';

/**
 * Shown when a save has been waiting for the device's storage for a few seconds, which
 * happens when another Greenbit tab or window is stuck holding it. The save is queued,
 * not lost: it finishes by itself once the storage is free.
 */
export function StorageAlert() {
  const { stuck, pending } = useWrites();
  const showToast = useUI((s) => s.showToast);
  const wasStuck = useRef(false);

  useEffect(() => {
    if (stuck) wasStuck.current = true;
    else if (wasStuck.current && pending === 0) {
      wasStuck.current = false;
      showToast('All changes saved');
    }
  }, [stuck, pending, showToast]);

  if (!stuck) return null;
  return (
    <div className="storage-alert" role="alert">
      <strong>Not saved yet.</strong> Greenbit is waiting for this device’s storage, usually because Greenbit is open in another tab or window. Close the other Greenbit tabs and your changes will save automatically.
      <span className="muted small"> Reloading now would lose them.</span>
    </div>
  );
}
