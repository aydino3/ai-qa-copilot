import { NavLink, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { RunDetails } from './pages/RunDetails';

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-6">
        <h1 className="text-lg font-semibold tracking-tight">AI QA Copilot</h1>
        <nav className="flex gap-4 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/runs/preview"
            className={({ isActive }) =>
              isActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
            }
          >
            Run details (preview)
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs/:runId" element={<RunDetails />} />
        </Routes>
      </main>
    </div>
  );
}
