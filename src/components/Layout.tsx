import { NavLink, Link, Outlet } from 'react-router-dom';
import { Celebration } from './Celebration';
import { IconCalendar, IconChart, IconGarden, IconSettings, IconSun } from './Icons';
import { Credit, LogoMark } from './Logo';
import { Toasts } from './Toasts';

const TABS = [
  { to: '/', label: 'Garden', Icon: IconGarden, end: true },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/insights', label: 'Insights', Icon: IconChart },
  { to: '/progress', label: 'Progress', Icon: IconSun },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
];

export function Layout() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <Link to="/" className="nav-brand" aria-label="Greenbit home">
          <LogoMark size={36} />
          <span>Greenbit</span>
        </Link>
        <div className="nav-links">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
        <Credit className="nav-credit" />
      </nav>
      <main className="main" id="main">
        <Link to="/" className="mobile-brand" aria-label="Greenbit home">
          <LogoMark size={32} />
          <span>Greenbit</span>
        </Link>
        <Outlet />
      </main>
      <Celebration />
      <Toasts />
    </div>
  );
}
