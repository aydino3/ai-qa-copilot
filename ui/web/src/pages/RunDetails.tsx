import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  cancelRun,
  fetchRun,
  fetchRunEvidence,
  type RunEvidence,
  type RunStatus,
  type RunSummary,
} from '../api/client';
import { useRunStream } from '../hooks/useRunStream';
import { Terminal } from '../components/Terminal';
import { ManagerTimeline } from '../components/ManagerTimeline';
import { RunReport } from '../components/RunReport';
import { Spinner } from '../components/Spinner';
import { ErrorBoundary } from '../components/ErrorBoundary';

type ViewMode = 'evidence' | 'live' | 'developer';

export function RunDetails() {
  const { runId } = useParams<{ runId: string }>();
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [evidence, setEvidence] = useState<RunEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const hasAutoSwitched = useRef(false);
  const stream = useRunStream(runId);

  // Initial summary load
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

  // Refresh summary + load evidence when stream reaches a terminal state
  useEffect(() => {
    if (!runId || !stream.status || stream.status === 'running') return;
    let cancelled = false;
    fetchRun(runId).then((r) => { if (!cancelled) setSummary(r); }).catch(() => {});
    setEvidenceLoading(true);
    fetchRunEvidence(runId)
      .then((data) => { if (!cancelled) setEvidence(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEvidenceLoading(false); });
    return () => { cancelled = true; };
  }, [runId, stream.status]);

  // Auto-switch to evidence view once results arrive (once per page load)
  useEffect(() => {
    if (!evidence || evidence.tests.length === 0 || hasAutoSwitched.current) return;
    setViewMode('evidence');
    hasAutoSwitched.current = true;
  }, [evidence]);

  const status: RunStatus | null = stream.status ?? summary?.status ?? null;
  const exitCode = stream.exitCode ?? summary?.exitCode ?? null;
  const isRunning = status === 'running' || status === null;
  const hasEvidence = !!evidence && evidence.tests.length > 0;

  const tabs: Array<{ id: ViewMode; label: string; disabled?: boolean }> = [
    { id: 'evidence', label: '📊 Evidence', disabled: !hasEvidence && !evidenceLoading },
    { id: 'live',     label: '📋 Live' },
    { id: 'developer', label: '💻 Terminal' },
  ];

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
          <button onClick={handleCancel} disabled={!isRunning || cancelling} className="btn-danger">
            {cancelling ? 'Cancelling…' : 'Cancel run'}
          </button>
          <Link to="/" className="btn-ghost text-sm">← Dashboard</Link>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-2 border border-white/[0.06] rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setViewMode(tab.id)}
            disabled={tab.disabled}
            className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              viewMode === tab.id
                ? 'bg-gradient-brand text-white shadow-glow-sm'
                : tab.disabled
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
            {tab.id === 'evidence' && evidenceLoading && (
              <span className="inline-block w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin opacity-70" />
            )}
          </button>
        ))}
      </div>

      {/* Content panel — Evidence gets its own borderless container; other views stay in a card */}
      {viewMode === 'evidence' ? (
        evidenceLoading ? (
          <div className="card p-5 min-h-48"><Spinner label="Loading test evidence…" /></div>
        ) : hasEvidence ? (
          <ErrorBoundary>
            <RunReport evidence={evidence!} />
          </ErrorBoundary>
        ) : (
          <div className="card p-5 flex flex-col items-center justify-center h-48 text-slate-500 space-y-2">
            <span className="text-3xl">📭</span>
            <span className="text-sm">
              {isRunning ? 'Evidence available after run completes' : 'No test results recorded'}
            </span>
          </div>
        )
      ) : (
        <div className="card p-5 min-h-48">
          {viewMode === 'live' && (
            <ManagerTimeline stepEvents={stream.stepEvents} runStatus={status} exitCode={exitCode} />
          )}
          {viewMode === 'developer' && (
            <Terminal logs={stream.logs} />
          )}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status, exitCode }: { status: RunStatus | null; exitCode: number | null }) {
  const styles: Record<RunStatus | 'unknown', string> = {
    running:   'bg-brand-500/20 text-brand-300 border-brand-500/40',
    completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    failed:    'bg-rose-500/20 text-rose-300 border-rose-500/40',
    error:     'bg-amber-500/20 text-amber-300 border-amber-500/40',
    unknown:   'bg-surface-4 text-slate-400 border-white/[0.08]',
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
