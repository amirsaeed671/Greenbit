import { useRegisterSW } from 'virtual:pwa-register/react';
import { useUI } from '../store/ui';

export function Toasts() {
  const toast = useUI((s) => s.toast);
  const clear = () => useUI.setState({ toast: null });
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (needRefresh)
    return (
      <div className="toast" role="status">
        A fresh version of Greenbit is ready.
        <button onClick={() => updateServiceWorker(true)}>Update</button>
        <button onClick={() => setNeedRefresh(false)} aria-label="Dismiss">✕</button>
      </div>
    );
  if (offlineReady)
    return (
      <div className="toast" role="status">
        Greenbit now works offline.
        <button onClick={() => setOfflineReady(false)} aria-label="Dismiss">OK</button>
      </div>
    );
  if (toast)
    return (
      <div className="toast" role="status">
        {toast.msg}
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.run();
              clear();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    );
  return null;
}
