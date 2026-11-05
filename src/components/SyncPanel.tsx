import { formatDistanceToNow } from 'date-fns';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { deriveKeys, newSeed, seedToLink, seedToWords, wordsToSeed } from '../sync/crypto';
import { deleteRemoteAndLeave, enableSync, getDeviceName, getSeed, leaveSync, renameDevice, syncNow, useSync } from '../sync/engine';
import { repo } from '../db/repo';

function AddDevice() {
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const [words, setWords] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void getSeed().then(async (seed) => {
      if (!seed) return;
      const l = seedToLink(seed, location.origin);
      setLink(l);
      setQr(await QRCode.toString(l, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1c2b22', light: '#ffffff' } }));
    });
  }, []);
  return (
    <div className="sync-add">
      <div className="sync-qr" aria-label="QR code with your sync link" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="stack" style={{ gap: 8, flex: 1, minWidth: 220 }}>
        <p style={{ margin: 0 }}>
          On your other device, <strong>scan this code with the camera</strong>, or open the link there. You can also type the 24-word code in Settings → Sync on that device.
        </p>
        <div className="row">
          <button
            className="btn small"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button className="btn small ghost" onClick={async () => setWords(words ? null : seedToWords((await getSeed())!))}>
            {words ? 'Hide words' : 'Show 24-word code'}
          </button>
        </div>
        {words && (
          <ol className="sync-words" aria-label="Sync code">
            {words.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
        )}
        <p className="muted small" style={{ margin: 0 }}>
          Anyone with this code or link can read and change your synced data. Keep it private, like a password.
        </p>
      </div>
    </div>
  );
}

export function SyncPanel() {
  const s = useSync();
  const [mode, setMode] = useState<'idle' | 'join' | 'add'>('idle');
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [me, setMe] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    void getDeviceName().then(setName);
    void repo.deviceId().then(setMe);
    const t = window.setInterval(() => tick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, [s.enabled]);

  if (!s.enabled)
    return (
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          Keep your tasks, notes and habits in step across browsers and devices, the way Brave Sync works. Everything is <strong>encrypted on this device</strong> with a key only your devices hold. The relay stores an unreadable copy and never sees your data.
        </p>
        {mode === 'join' ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr('');
              try {
                const seed = /k=/.test(input) ? null : wordsToSeed(input);
                if (!seed) {
                  location.assign(input.trim());
                  return;
                }
                await enableSync(seed);
                setMode('idle');
              } catch (x) {
                setErr((x as Error).message);
              }
            }}
          >
            <label className="field">
              <span className="label">Sync code</span>
              <textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter the 24 words from your other device, or paste its sync link" spellCheck={false} autoCapitalize="none" />
            </label>
            {err && <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700, margin: 0 }}>{err}</p>}
            <p className="muted small" style={{ margin: 0 }}>This device’s data is merged with the chain; nothing is lost on either side.</p>
            <div className="row">
              <button className="btn primary" type="submit" disabled={!input.trim()}>Join</button>
              <button className="btn ghost" type="button" onClick={() => setMode('idle')}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="row">
            <button className="btn primary" onClick={() => void enableSync(newSeed()).then(() => setMode('add'))}>Start syncing</button>
            <button className="btn" onClick={() => setMode('join')}>I have a sync code</button>
          </div>
        )}
      </div>
    );

  const others = Object.entries(s.devices).filter(([id]) => id !== me);
  return (
    <div className="stack">
      <div className="row">
        <span className={`sync-dot ${s.phase}`} aria-hidden="true" />
        <span>
          <strong>{{ idle: 'Synced', syncing: 'Syncing…', error: 'Sync problem', offline: 'Offline', off: 'Off' }[s.phase]}</strong>
          {s.lastSyncedAt && s.phase !== 'syncing' && <span className="muted"> · {formatDistanceToNow(new Date(s.lastSyncedAt), { addSuffix: true })}</span>}
        </span>
        <span className="spacer" />
        <button className="btn small" onClick={() => void syncNow()} disabled={s.phase === 'syncing'}>Sync now</button>
      </div>
      {s.phase === 'error' && <p className="banner small" role="alert">{s.error}</p>}
      {s.phase === 'offline' && <p className="muted small" style={{ margin: 0 }}>You’re offline. Changes are kept here and sync when you reconnect.</p>}
      <p className="muted small" style={{ margin: 0 }}>
        Chain fingerprint <code>{s.fingerprint}</code>. It’s the same on every device in this chain.
      </p>
      <label className="field">
        <span className="label">This device’s name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void renameDevice(name)} maxLength={40} />
      </label>
      {others.length > 0 && (
        <div>
          <span className="label" style={{ fontWeight: 700 }}>Other devices</span>
          <ul className="entry-list" style={{ marginTop: 6 }}>
            {others.map(([id, d]) => (
              <li key={id}>
                <span aria-hidden="true">💻</span> {d.name}
                <span className="spacer" />
                <span className="muted small">seen {formatDistanceToNow(new Date(d.lastSeen), { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {mode === 'add' ? <AddDevice /> : <div><button className="btn primary" onClick={() => setMode('add')}>Add another device</button></div>}
      <details className="chart-table">
        <summary>Stop syncing</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <p className="muted small" style={{ margin: 0 }}>Leaving keeps everything on this device and stops sharing changes. Other devices keep syncing with each other.</p>
          <div className="row">
            <button className="btn" onClick={() => void leaveSync()}>Leave on this device</button>
            <button
              className="btn danger"
              onClick={() => {
                if (window.confirm('Delete the encrypted copy from the relay and leave? Devices still in the chain will upload it again when they next sync, so leave on those first.')) void deleteRemoteAndLeave();
              }}
            >
              Delete relay copy and leave
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

/** Opened from a QR code or link: /sync#k=… */
export function JoinFromLink({ seed, onDone }: { seed: Uint8Array; onDone: () => void }) {
  const s = useSync();
  const [fp, setFp] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => void deriveKeys(seed).then((k) => setFp(k.fingerprint)), [seed]);
  const same = s.enabled && s.fingerprint === fp;
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Join a sync chain</h2>
      {same ? (
        <p>This device is already in this chain.</p>
      ) : (
        <>
          <p>
            Sync this device with chain <code>{fp}</code>? Check that the fingerprint matches the one on your other device. This device’s data will be merged in; nothing is deleted.
          </p>
          {s.enabled && <p className="banner small">This device is in a different chain ({s.fingerprint}). Joining switches it to the new one.</p>}
          <div className="row">
            <button
              className="btn primary"
              disabled={busy || !fp}
              onClick={async () => {
                setBusy(true);
                await enableSync(seed);
                onDone();
              }}
            >
              {busy ? 'Joining…' : 'Join and sync'}
            </button>
            <button className="btn ghost" onClick={onDone}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
