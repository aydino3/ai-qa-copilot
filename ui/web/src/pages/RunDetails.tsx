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

  // Refresh summary once the run terminates to pick up parsed results.
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
    <section className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Run details</h2>
          <div className="text-xs text-slate-500 font-mono">{runId}</div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} exitCode={exitCode} />
          <button
            onClick={handleCancel}
            disabled={!isRunning || cancelling}
            className="bg-rose-700 hover:bg-rose-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm px-3 py-1.5 rounded"
          >
            {cancelling ? 'Cancelling…' : 'Cancel run'}
          </button>
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">← Dashboard</Link>
        </div>
      </header>

      {summaryError && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">{summaryError}</div>
      )}
      {cancelError && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">{cancelError}</div>
      )}

      {/* Meta row */}
      {summaryLoading ? (
        <Spinner label="Loading run metadata…" />
      ) : (
        <div className="text-xs text-slate-500 font-mono">
          socket: {stream.socketState}
          {summary?.args && summary.args.length > 0 && <> &nbsp;·&nbsp; args: {summary.args.join(' ')}</>}
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
        {(['manager', 'developer'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === mode
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode === 'manager' ? '📋 Manager view' : '💻 Developer view'}
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-4 min-h-48">
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
    running: 'bg-sky-900/60 text-sky-300 border-sky-700',
    completed: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
    failed: 'bg-rose-900/60 text-rose-300 border-rose-700',
    error: 'bg-amber-900/60 text-amber-300 border-amber-700',
    unknown: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  const key = status ?? 'unknown';
  return (
    <span className={`text-xs uppercase tracking-wide border px-2 py-1 rounded ${styles[key]}`}>
      {status ?? 'unknown'}
      {exitCode !== null && status && status !== 'running' && (
        <span className="ml-1 opacity-75">exit {exitCode}</span>
      )}
    </span>
  );
}
