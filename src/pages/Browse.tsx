import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Layout';
import { Credit } from '../components/Logo';

/** Phone-only hub with everything the desktop sidebar shows. */
export default function Browse() {
  return (
    <div className="page stack">
      <h1>Browse</h1>
      <nav className="card browse-list" aria-label="Browse">
        <Sidebar />
      </nav>
      <p className="muted small">
        Tip: on a keyboard, press <kbd>Q</kbd> anywhere to add a task. <Link to="/settings#sync">Sync this device</Link>.
      </p>
      <Credit />
    </div>
  );
}
