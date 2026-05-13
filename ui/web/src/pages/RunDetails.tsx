import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cancelRun, fetchRun, type RunStatus, type RunSummary } from '../api/client';
import { useRunStream } from '../hooks/useRunStream';
import { Terminal } from '../components/Terminal';
import { ManagerTimeline } from '../components/ManagerTimeline';
import { Spinner } from '../components/Spinner';

type ViewMode = 'manager' | 'developer';

export function RunDetails() {
  const { runId } = useParams<{ runId: string }>();
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('manager');
  const stream = useRunStream(runId);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setSummaryLoading(true);
    fetchRun(runId)
      .then((r) => { if (!cancelled) setSummary(r); })
      .catch((err: Error) => { if (!cancelled) setSummaryError(err.message); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [runId]);

  useEffect(() => {
    if (!runId || !stream.status || stream.status === 'running') return;
    fetchRun(runId).then(setSummary).catch(() => { /* leave previous */ });
  }, [runId, stream.status]);

  const status: RunStatus | null = stream.status ?? summary?.status ?? null;
  const exitCode = stream.exitCode ?? summary?.exitCode ?? null;
  const isRunning = status === 'running' || status === null;

  async function handleCancel() {
    if (!runId) return;
    setCancelling(true);
    setCancelError(null);
    try { await cancelRun(runId); }
    catch (err) { setCancelError(err instanceof Error ? err.message : String(err)); }
    finally { setCancelling(false); }
  }

  return (
    <section className="space-y-5 animate-slide-up">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-sm shadow-glow-sm">▶</span>
            Run details
          </h2>
          <div className="text-xs text-slate-500 font-mono">{runId}</div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} exitCode={exitCode} />
          <button
            onClick={handleCancel}
            disabled={!isRunning || cancelling}
            className="btn-danger"
          >
            {cancelling ? 'Cancelling…' : 'Cancel run'}
          </button>
          <Link to="/" className="btn-ghost text-sm">
            ← Dashboard
          </Link>
        </div>
      </header>

      {summaryError && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-4">{summaryError}</div>
      )}
      {cancelError && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-4">{cancelError}</div>
      )}

      {/* Meta row */}
      {summaryLoading ? (
        <Spinner label="Loading run metadata…" />
      ) : (
        <div className="text-xs text-slate-500 font-mono flex items-center gap-2 flex-wrap">
          <span className="text-slate-600">socket:</span>
          <span className={stream.socketState === 'open' ? 'text-emerald-400' : 'text-slate-500'}>
            {stream.socketState}
          </span>
          {summary?.args && summary.args.length > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-slate-600">args:</span>
              <span className="text-slate-400">{summary.args.join(' ')}</span>
            </>
          )}
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-surface-2 border border-white/[0.06] rounded-xl p-1 w-fit">
        {(['manager', 'developer'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              viewMode === mode
                ? 'bg-gradient-brand text-white shadow-glow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode === 'manager' ? '📋 Manager' : '💻 Developer'}
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="card p-5 min-h-48">
        {viewMode === 'manager' ? (
          <ManagerTimeline stepEvents={stream.stepEvents} runStatus={status} />
        ) : (
          <Terminal logs={stream.logs} />
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status, exitCode }: { status: RunStatus | null; exitCode: number | null }) {
  const styles: Record<RunStatus | 'unknown', string> = {
    running: 'bg-brand-500/20 text-brand-300 border-brand-500/40',
    completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    failed: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    error: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    unknown: 'bg-surface-4 text-slate-400 border-white/[0.08]',
  };
  const key = status ?? 'unknown';
  return (
    <span className={`text-xs font-semibold uppercase tracking-wide border px-3 py-1.5 rounded-full ${styles[key]}`}>
      {status ?? 'unknown'}
      {exitCode !== null && status && status !== 'running' && (
        <span className="ml-1.5 opacity-70 font-normal">exit {exitCode}</span>
      )}
    </span>
  );
}
