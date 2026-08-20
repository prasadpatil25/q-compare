import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_VERSION } from '../types';
import { useTheme } from '../hooks/useTheme';
import {
  BrandIcon,
  IconAbout,
  IconAtom,
  IconBenchmark,
  IconDashboard,
  IconDataset,
  IconExperiment,
  IconInsight,
  IconMenu,
  IconPlus,
  IconReport,
  IconSettings,
} from '../components/icons';

const NAV_MAIN = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/experiments/new', label: 'New Experiment', icon: IconPlus },
  { to: '/experiments', label: 'Experiments', icon: IconExperiment },
  { to: '/datasets', label: 'Datasets', icon: IconDataset },
  { to: '/benchmarks', label: 'Benchmarks', icon: IconBenchmark },
  { to: '/insights', label: 'Insights', icon: IconInsight },
  { to: '/reports', label: 'Reports', icon: IconReport },
];

const NAV_SECONDARY = [
  { to: '/about', label: 'About', icon: IconAbout },
  { to: '/settings', label: 'Settings', icon: IconSettings },
];

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { mode, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const title =
    location.pathname === '/'
      ? 'Dashboard'
      : location.pathname.startsWith('/experiments/new')
        ? 'New Experiment'
        : location.pathname.startsWith('/experiments/') && location.pathname !== '/experiments'
          ? 'Experiment'
          : NAV_MAIN.concat(NAV_SECONDARY).find((n) =>
              n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to),
            )?.label ?? 'Q-Compare';

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <BrandIcon className="brand-icon" />
          <div>
            <div className="brand-name">Q-COMPARE</div>
            <div className="brand-sub">Decision Model Lab</div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-section">Research</div>
          {NAV_MAIN.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
          <div className="nav-section">System</div>
          {NAV_SECONDARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            aria-pressed={mode === 'light'}
          >
            <span className="theme-dot" />
            {mode === 'dark' ? 'Dark theme · slate & steel' : 'Light theme · slate & steel'}
          </button>
          <div>Q-Compare v{APP_VERSION}</div>
          <div>Classical · Bayesian · Quantum-Inspired</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="burger" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">
              <IconMenu size={17} />
            </button>
            {title}
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')}>
              <IconAtom size={14} /> <span className="label-hide">Reports</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/experiments/new')}>
              <IconPlus size={14} /> <span className="label-hide">New Experiment</span>
            </button>
          </div>
        </header>
        <main className="main-content">{<Outlet />}</main>
      </div>
    </div>
  );
}