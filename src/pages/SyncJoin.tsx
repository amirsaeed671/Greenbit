import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JoinFromLink } from '../components/SyncPanel';
import { linkToSeed } from '../sync/crypto';

export default function SyncJoin() {
  const navigate = useNavigate();
  // Read the secret once, then drop it from the address bar and history.
  const [seed] = useState(() => {
    const s = linkToSeed(location.hash);
    history.replaceState(null, '', '/sync');
    return s;
  });
  return (
    <div className="page stack">
      <h1>Sync</h1>
      {seed ? <JoinFromLink seed={seed} onDone={() => navigate('/settings#sync')} /> : <p className="muted">This sync link is incomplete. Open Settings → Sync on your other device and copy the link again.</p>}
    </div>
  );
}
