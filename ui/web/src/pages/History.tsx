import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRuns, type RunSummary, type RunStatus } from '../api/client';
import { Spinner } from '../components/Spinner';

const STATUS_STYLES: Record<RunStatus | 'unknown', string> = {
  running: 'bg-brand-500/20 text-brand-300 border-brand-500/40',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  failed: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  error: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  unknown: 'bg-surface-4 text-slate-400 border-white/[0.08]',
};

const STATUS_ICONS: Record<RunStatus | 'unknown', string> = {
  running: '⟳',
  completed: '✓',
  failed: '✗',
  error: '⚠',
  unknown: '○',
};

function formatDuration(start: number, end: number | null): string {
  if (!end) return '—';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function History() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(quiet = false) {
    if (!quiet) setLoading(true);
    fetchRuns()
      .then((res) => setRuns(res.runs))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const id = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(id);
  }, []);

  const activeCount = runs.filter((r) => r.status === 'running').length;

  return (
    <section className="space-y-6 animate-slide-up">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-sm shadow-glow-sm">📜</span>
            Run history
          </h2>
          {loading ? (
            <Spinner label="Loading runs…" />
          ) : (
            <p className="text-sm text-slate-400">
              {runs.length} run{runs.length !== 1 ? 's' : ''} total
              {activeCount > 0 && (
                <span className="ml-2 text-brand-300 font-medium">
                  · {activeCount} active
                </span>
              )}
            </p>
          )}
        </div>
        <button onClick={() => load()} className="btn-ghost text-xs">
          ⟳ Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-4">
          {error}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-3/60 text-slate-500 text-xs uppercase tracking-wide border-b border-white/[0.06]">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Started</th>
              <th className="text-left px-4 py-3 font-semibold">Duration</th>
              <th className="text-left px-4 py-3 font-semibold">Args</th>
              <th className="text-left px-4 py-3 font-semibold">Exit</th>
              <th className="text-left px-4 py-3 font-semibold">Run ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-surface-4 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              runs.map((r) => {
                const statusKey: RunStatus | 'unknown' = r.status ?? 'unknown';
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-surface-3/40 transition-colors cursor-pointer"
                    onClick={() => { window.location.assign(`/runs/${r.id}`); }}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full ${STATUS_STYLES[statusKey]}`}>
                        <span>{STATUS_ICONS[statusKey]}</span>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      {formatTimestamp(r.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-xs tabular-nums">
                      {formatDuration(r.startedAt, r.endedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs max-w-[200px] truncate">
                      {r.args.length > 0 ? r.args.join(' ') : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      <span className={r.exitCode === 0 ? 'text-emerald-400' : r.exitCode !== null ? 'text-rose-400' : 'text-slate-600'}>
                        {r.exitCode === null ? '—' : r.exitCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/runs/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-400 hover:text-brand-300 font-mono text-xs transition-colors"
                      >
                        {r.id.slice(0, 8)}…
                      </Link>
                    </td>
                  </tr>
                );
              })}
            {!loading && runs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="space-y-3">
                    <div className="text-4xl">📜</div>
                    <div className="text-slate-300 font-semibold">No runs yet</div>
                    <div className="text-xs text-slate-500">
                      Trigger a run from the{' '}
                      <Link to="/" className="text-brand-400 hover:text-brand-300 transition-colors">
                        Dashboard
                      </Link>{' '}
                      to see it appear here.
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600">
        History is in-memory and resets when the backend restarts.
      </p>
    </section>
  );
}
