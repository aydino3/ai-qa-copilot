import { useMemo } from 'react';
import type { StepEvent } from '../hooks/useRunStream';
import type { RunStatus } from '../api/client';

interface TimelineStep {
  title: string;
  state: 'running' | 'passed' | 'failed';
  error: string | null;
  startTs: number;
  endTs?: number;
}

function buildTimeline(
  events: StepEvent[],
  runStatus: RunStatus | null,
  exitCode: number | null,
): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const pending = new Map<string, number>();
  for (const ev of events) {
    if (ev.action === 'start') {
      pending.set(ev.title, steps.length);
      steps.push({ title: ev.title, state: 'running', error: null, startTs: ev.ts });
    } else {
      const idx = pending.get(ev.title);
      if (idx !== undefined) {
        const step = steps[idx];
        if (step) {
          step.state = ev.status === 'failed' ? 'failed' : 'passed';
          step.error = ev.error ?? null;
          step.endTs = ev.ts;
        }
        pending.delete(ev.title);
      }
    }
  }

  // Sweep any unresolved "running" steps once the run has reached a terminal
  // state. The socket can close before the trailing onStepEnd payloads land,
  // leaving steps visually stuck mid-spin — infer their outcome from the run
  // exit code so the timeline matches reality.
  const isTerminal = runStatus !== null && runStatus !== 'running';
  if (isTerminal) {
    const inferred: TimelineStep['state'] = exitCode === 0 ? 'passed' : 'failed';
    for (const step of steps) {
      if (step.state === 'running') step.state = inferred;
    }
  }

  return steps;
}

function fmtDuration(step: TimelineStep): string {
  if (!step.endTs) return '';
  const ms = step.endTs - step.startTs;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

interface ManagerTimelineProps {
  stepEvents: StepEvent[];
  runStatus: RunStatus | null;
  exitCode?: number | null;
}

export function ManagerTimeline({ stepEvents, runStatus, exitCode = null }: ManagerTimelineProps) {
  const steps = useMemo(
    () => buildTimeline(stepEvents, runStatus, exitCode),
    [stepEvents, runStatus, exitCode],
  );
  const isRunning = runStatus === 'running' || runStatus === null;

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-3">
        {isRunning ? (
          <>
            <span className="w-8 h-8 rounded-full border-2 border-surface-5 border-t-brand-400 animate-spin" />
            <span className="text-sm text-slate-400">Waiting for test steps…</span>
            <span className="text-xs text-slate-600">Steps appear as test.step() blocks execute</span>
          </>
        ) : (
          <>
            <span className="text-4xl">📋</span>
            <span className="text-sm text-slate-400">No step events recorded</span>
            <span className="text-xs text-center max-w-xs">
              Ensure your tests use <code className="text-brand-300">test.step()</code> blocks
            </span>
          </>
        )}
      </div>
    );
  }

  const passed = steps.filter((s) => s.state === 'passed').length;
  const failed = steps.filter((s) => s.state === 'failed').length;
  const running = steps.filter((s) => s.state === 'running').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs pb-1">
        <span className="text-slate-500">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
        {passed > 0  && <span className="text-emerald-400 font-medium">✓ {passed} passed</span>}
        {failed > 0  && <span className="text-rose-400 font-medium">✗ {failed} failed</span>}
        {running > 0 && <span className="text-brand-300 font-medium">⟳ {running} running</span>}
      </div>

      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-all duration-300 ${
            step.state === 'running'
              ? 'border-brand-500/30 bg-brand-500/[0.08] shadow-glow-sm'
              : step.state === 'failed'
                ? 'border-rose-700/40 bg-rose-950/20'
                : 'border-white/[0.06] bg-surface-2/50'
          }`}>
            <span className="mt-0.5 shrink-0 w-5 text-center text-base">
              {step.state === 'running' ? (
                <span className="inline-block w-4 h-4 rounded-full border-2 border-brand-700 border-t-brand-300 animate-spin" />
              ) : step.state === 'passed' ? (
                <span className="text-emerald-400">✓</span>
              ) : (
                <span className="text-rose-400">✗</span>
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className={
                step.state === 'running' ? 'text-brand-200 font-medium'
                : step.state === 'failed' ? 'text-rose-200'
                : 'text-slate-300'
              }>
                {step.title}
              </span>
              {step.error && (
                <div className="mt-1.5 text-xs text-rose-300/80 font-mono bg-rose-950/40 rounded p-2 whitespace-pre-wrap">
                  {step.error}
                </div>
              )}
            </span>
            {step.endTs && (
              <span className="shrink-0 text-xs text-slate-600 font-mono tabular-nums">
                {fmtDuration(step)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
