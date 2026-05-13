import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRuns, type RunSummary, type RunStatus } from '../api/client';
import { Spinner } from '../components/Spinner';

const STATUS_STYLES: Record<RunStatus | 'unknown', string> = {
  running: 'bg-sky-900/60 text-sky-300 border-sky-700',
  completed: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  failed: 'bg-rose-900/60 text-rose-300 border-rose-700',
  error: 'bg-amber-900/60 text-amber-300 border-amber-700',
  unknown: 'bg-slate-800 text-slate-400 border-slate-700',
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
    // Light polling so running rows update without manual refresh.
    const id = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(id);
  }, []);

  const activeCount = runs.filter((r) => r.status === 'running').length;

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Run history</h2>
          {loading ? (
            <Spinner label="Loading runs…" />
          ) : (
            <p className="text-sm text-slate-400">
              {runs.length} run(s) total
              {activeCount > 0 && (
                <span className="ml-2 text-sky-400">
                  · {activeCount} active
                </span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => load()}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded px-3 py-1.5"
        >
          ⟳ Refresh
        </button>
      </header>

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium">Status</th>
              <th className="text-left px-3 py-2.5 font-medium">Started</th>
              <th className="text-left px-3 py-2.5 font-medium">Duration</th>
              <th className="text-left px-3 py-2.5 font-medium">Args</th>
              <th className="text-left px-3 py-2.5 font-medium">Exit</th>
              <th className="text-left px-3 py-2.5 font-medium">Run ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-3 py-2.5">
                      <div className="h-3 bg-slate-800 rounded w-3/4" />
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
                    className="hover:bg-slate-900/40 transition-colors cursor-pointer"
                    onClick={() => {
                      window.location.assign(`/runs/${r.id}`);
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-wide border px-2 py-1 rounded ${STATUS_STYLES[statusKey]}`}
                      >
                        <span>{STATUS_ICONS[statusKey]}</span>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                      {formatTimestamp(r.startedAt)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                      {formatDuration(r.startedAt, r.endedAt)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300 font-mono text-xs">
                      {r.args.length > 0 ? r.args.join(' ') : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">
                      {r.exitCode === null ? '—' : r.exitCode}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/runs/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sky-400 hover:text-sky-300 font-mono text-xs"
                      >
                        {r.id.slice(0, 8)}…
                      </Link>
                    </td>
                  </tr>
                );
              })}
            {!loading && runs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-slate-500">
                  <div className="space-y-2">
                    <div className="text-3xl">📜</div>
                    <div className="text-slate-300 font-medium">No runs yet</div>
                    <div className="text-xs">
                      Trigger a run from the <Link to="/" className="text-sky-400 hover:text-sky-300">Dashboard</Link> to see it appear here.
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        History is in-memory and resets when the backend restarts.
      </p>
    </section>
  );
}
