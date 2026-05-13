import { NavLink, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { RunDetails } from './pages/RunDetails';
import { Settings } from './pages/Settings';
import { NewTest } from './pages/NewTest';
import { History } from './pages/History';

const NAV = [
  { to: '/', label: 'Dashboard',  icon: '⊞', end: true },
  { to: '/new-test', label: 'New Test', icon: '✦', end: false },
  { to: '/history',  label: 'History',  icon: '⌛', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false },
];

export function App() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-1/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
          {/* Logotype */}
          <div className="flex items-center gap-2.5 shrink-0 select-none">
            <span className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center text-white text-sm font-bold shadow-glow-sm">
              ◈
            </span>
            <span className="text-sm font-semibold tracking-tight text-white">
              AI QA <span className="text-gradient">Copilot</span>
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive
                    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-500/20 border border-brand-500/30 shadow-glow-sm'
                    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent transition-all duration-150'
                }
              >
                <span className="text-[11px]">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 animate-fade-in">
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/runs/:runId"  element={<RunDetails />} />
          <Route path="/new-test"     element={<NewTest />} />
          <Route path="/history"      element={<History />} />
          <Route path="/settings"     element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
