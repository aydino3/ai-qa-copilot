import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRuns, type RunSummary, type RunStatus } from '../api/client';
import { Spinner } from '../components/Spinner';
import { Donut } from '../components/Donut';

const STATUS_PILL_CLASS: Record<RunStatus | 'unknown', string> = {
  running:   'status-pill-running',
  completed: 'status-pill-completed',
  failed:    'status-pill-failed',
  error:     'status-pill-error',
  unknown:   'status-pill-unknown',
};

const STATUS_ICON: Record<RunStatus | 'unknown', string> = {
  running:   '⟳',
  completed: '✓',
  failed:    '✗',
  error:     '⚠',
  unknown:   '○',
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
    day:   'numeric',
    hour:  '2-digit',
    minute:'2-digit',
    second:'2-digit',
  });
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type FilterKey = 'all' | 'completed' | 'failed' | 'running';

export function History() {
  const [runs, setRuns]       = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<FilterKey>('all');

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

  // ── Aggregate statistics ─────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = runs.length;
    const completed  = runs.filter((r) => r.status === 'completed').length;
    const failed     = runs.filter((r) => r.status === 'failed' || r.status === 'error').length;
    const running    = runs.filter((r) => r.status === 'running').length;
    const finished   = completed + failed;
    const passRate   = finished === 0 ? 0 : Math.round((completed / finished) * 100);
    const durations  = runs
      .filter((r) => r.endedAt !== null)
      .map((r) => (r.endedAt as number) - r.startedAt);
    const avgMs      = durations.length === 0 ? 0
      : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    return { total, completed, failed, running, passRate, avgMs };
  }, [runs]);

  // ── Filtered list ────────────────────────────────────────────────
  const filteredRuns = useMemo(() => {
    if (filter === 'all') return runs;
    if (filter === 'failed') return runs.filter((r) => r.status === 'failed' || r.status === 'error');
    return runs.filter((r) => r.status === filter);
  }, [runs, filter]);

  return (
    <section className="space-y-8 animate-slide-up">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
            <span className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-sm shadow-glow-sm">
              📊
            </span>
            Run History
          </h2>
          {loading ? (
            <Spinner label="Loading runs…" />
          ) : (
            <p className="text-sm text-slate-400">
              {runs.length} run{runs.length !== 1 ? 's' : ''} total
              {stats.running > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-brand-300 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                  {stats.running} active
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
        <div className="rounded-xl border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-4">
          {error}
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pass Rate"
          accent="emerald"
          chart={
            <Donut
              value={stats.passRate}
              size={80}
              stroke={7}
              colorClass={
                stats.passRate >= 80 ? 'text-emerald-400'
                : stats.passRate >= 50 ? 'text-amber-400'
                : 'text-rose-400'
              }
              sublabel="pass"
            />
          }
          footer={
            <span className="text-xs text-slate-500">
              {stats.completed} / {stats.completed + stats.failed} finished
            </span>
          }
        />
        <StatCard
          label="Total Runs"
          accent="brand"
          value={stats.total}
          footer={<span className="text-xs text-slate-500">All time (session)</span>}
        />
        <StatCard
          label="Failures"
          accent="rose"
          value={stats.failed}
          footer={<span className="text-xs text-slate-500">{stats.failed === 0 ? 'No failures so far' : 'Across all runs'}</span>}
        />
        <StatCard
          label="Avg Duration"
          accent="cyan"
          value={stats.avgMs === 0 ? '—' : formatMs(stats.avgMs)}
          footer={<span className="text-xs text-slate-500">{runs.filter((r) => r.endedAt).length} samples</span>}
        />
      </div>

      {/* ── Filter chips ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'completed', 'failed', 'running'] as const).map((key) => {
          const counts = key === 'all' ? runs.length
            : key === 'completed' ? stats.completed
            : key === 'failed' ? stats.failed
            : stats.running;
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all duration-200 capitalize ${
                active
                  ? 'bg-gradient-brand text-white shadow-glow-sm'
                  : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 border border-white/10'
              }`}
            >
              {key} <span className="ml-1.5 opacity-70 tabular-nums">{counts}</span>
            </button>
          );
        })}
      </div>

      {/* ── Run cards ──────────────────────────────────────────── */}
      {loading && runs.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-7 w-24 bg-surface-4 rounded-full" />
                <div className="h-4 w-40 bg-surface-4 rounded" />
                <div className="ml-auto h-4 w-16 bg-surface-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 space-y-3">
          <div className="text-5xl">📜</div>
          <div className="text-lg font-semibold text-slate-200">
            {runs.length === 0 ? 'No runs yet' : `No ${filter} runs`}
          </div>
          <div className="text-xs text-slate-500">
            {runs.length === 0 ? (
              <>
                Trigger a run from the <Link to="/" className="text-brand-400 hover:text-brand-300">Dashboard</Link> to see it appear here.
              </>
            ) : (
              <>Try selecting a different filter.</>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredRuns.map((r) => (
            <RunCard key={r.id} run={r} />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600">
        History is in-memory and resets when the backend restarts.
      </p>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────
// StatCard
// ────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, chart, footer, accent,
}: {
  label: string;
  value?: React.ReactNode;
  chart?: React.ReactNode;
  footer?: React.ReactNode;
  accent: 'emerald' | 'rose' | 'brand' | 'cyan';
}) {
  const accentRgb = {
    emerald: '16,185,129',
    rose:    '244,63,94',
    brand:   '108,99,255',
    cyan:    '34,211,238',
  }[accent];

  return (
    <div className="stat-card animate-count-up">
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl opacity-70"
        style={{ background: `radial-gradient(circle at center, rgba(${accentRgb},0.22) 0%, rgba(${accentRgb},0) 70%)` }}
      />
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 relative z-10">
        {label}
      </div>
      <div className="flex items-end justify-between gap-4 relative z-10">
        {chart ? (
          <div className="flex-1">{chart}</div>
        ) : (
          <div className="text-4xl font-bold text-white tabular-nums leading-none tracking-tight">
            {value}
          </div>
        )}
      </div>
      {footer && <div className="relative z-10">{footer}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// RunCard
// ────────────────────────────────────────────────────────────────────

function RunCard({ run }: { run: RunSummary }) {
  const statusKey: RunStatus | 'unknown' = run.status ?? 'unknown';
  const isFinished = run.status !== 'running';
  return (
    <Link
      to={`/runs/${run.id}`}
      className="card-hover group block p-5 animate-slide-up"
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* Status pill */}
        <span className={`${STATUS_PILL_CLASS[statusKey]} animate-status-pop`}>
          <span className={statusKey === 'running' ? 'inline-block animate-spin' : ''}>
            {STATUS_ICON[statusKey]}
          </span>
          {run.status ?? 'unknown'}
        </span>

        {/* Timing */}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-200">
            {formatTimestamp(run.startedAt)}
          </span>
          <span className="text-xs text-slate-500">{relativeTime(run.startedAt)}</span>
        </div>

        {/* Args (truncated) */}
        <div className="flex-1 min-w-[200px]">
          {run.args.length > 0 ? (
            <code className="block font-mono text-xs text-slate-400 truncate bg-white/[0.03] px-2 py-1 rounded-md border border-white/[0.05]">
              {run.args.join(' ')}
            </code>
          ) : (
            <span className="text-xs text-slate-600">no args</span>
          )}
        </div>

        {/* Duration */}
        <div className="text-right">
          <div className="text-sm font-mono font-semibold text-slate-300 tabular-nums">
            {formatDuration(run.startedAt, run.endedAt)}
          </div>
          {isFinished && (
            <div className={`text-[11px] font-mono tabular-nums ${run.exitCode === 0 ? 'text-emerald-400' : run.exitCode !== null ? 'text-rose-400' : 'text-slate-600'}`}>
              exit {run.exitCode ?? '—'}
            </div>
          )}
        </div>

        {/* Run id + arrow */}
        <div className="flex items-center gap-2">
          <code className="font-mono text-[11px] text-slate-600 group-hover:text-brand-300 transition-colors">
            {run.id.slice(0, 8)}…
          </code>
          <span className="text-slate-600 group-hover:text-brand-300 group-hover:translate-x-0.5 transition-all">→</span>
        </div>
      </div>
    </Link>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}
