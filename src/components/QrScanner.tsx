import { useEffect, useRef, useState } from 'react';
import { decodeQr } from '../sync/qrScan';
import { Sheet } from './Sheet';

/**
 * Camera QR scanner. Calls onResult once with the decoded text, then stops the camera.
 * Offers "use a photo" when the camera is unavailable or blocked.
 */
export function QrScanner({ open, onClose, onResult, title = 'Scan QR code' }: { open: boolean; onClose: () => void; onResult: (text: string) => void; title?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'no-camera' | 'denied'>('starting');
  const [hint, setHint] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (!open) return;
    done.current = false;
    setHint('');
    let stream: MediaStream | null = null;
    let raf = 0;
    let busy = false;
    let last = 0;
    const finish = (text: string) => {
      if (done.current) return;
      done.current = true;
      onResult(text);
    };
    const tick = async (t: number) => {
      raf = requestAnimationFrame(tick);
      const v = video.current;
      if (busy || done.current || !v || v.readyState < 2 || t - last < 180) return; // ~5 scans a second
      last = t;
      busy = true;
      try {
        const text = await decodeQr(v);
        if (text) finish(text);
      } finally {
        busy = false;
      }
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus('no-camera');
      try {
        setStatus('starting');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
        setStatus('scanning');
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setStatus((e as DOMException).name === 'NotAllowedError' ? 'denied' : 'no-camera');
      }
    })();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [open, onResult]);

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setHint('Reading the photo…');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const text = await decodeQr(img);
      if (text) {
        done.current = true;
        onResult(text);
      } else setHint('No QR code found in that photo. Try again closer, with the whole code in view.');
    } catch {
      setHint('Couldn’t open that image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="stack">
        {status === 'starting' || status === 'scanning' ? (
          <div className="qr-viewfinder">
            <video ref={video} playsInline muted aria-label="Camera preview" />
            <span className="qr-frame" aria-hidden="true" />
          </div>
        ) : (
          <p className="banner small" role="alert">
            {status === 'denied' ? 'Camera access is blocked for this site. Allow it in your browser’s site settings, or use a photo of the code instead.' : 'No camera is available here. You can use a photo of the code instead.'}
          </p>
        )}
        <p className="muted small" style={{ margin: 0 }} aria-live="polite">
          {hint || (status === 'scanning' ? 'Point the camera at the QR code in Settings → Sync on your other device.' : status === 'starting' ? 'Starting the camera…' : '')}
        </p>
        <label className="btn ghost small" style={{ alignSelf: 'flex-start' }}>
          Use a photo instead
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void fromPhoto(e.target.files?.[0])} />
        </label>
      </div>
    </Sheet>
  );
}
