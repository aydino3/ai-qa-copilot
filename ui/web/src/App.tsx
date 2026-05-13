import { NavLink, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { RunDetails } from './pages/RunDetails';
import { Settings } from './pages/Settings';
import { NewTest } from './pages/NewTest';

const NAV = [
  { to: '/', label: '⊞ Dashboard', end: true },
  { to: '/new-test', label: '✦ New test', end: false },
  { to: '/settings', label: '⚙ Settings', end: false },
];

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-8 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sky-400 text-lg font-bold">◈</span>
          <h1 className="text-sm font-semibold tracking-tight">AI QA Copilot</h1>
        </div>
        <nav className="flex gap-1 text-sm">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive
                  ? 'bg-slate-800 text-slate-100 px-3 py-1.5 rounded-md text-xs font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 px-3 py-1.5 rounded-md text-xs font-medium transition-colors'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs/:runId" element={<RunDetails />} />
          <Route path="/new-test" element={<NewTest />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
