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

function buildTimeline(events: StepEvent[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  // Tracks the index of the most-recent 'running' step for a given title so
  // we can match its corresponding 'end' event even if titles repeat.
  const pending = new Map<string, number>();

  for (const ev of events) {
    if (ev.action === 'start') {
      const idx = steps.length;
      steps.push({ title: ev.title, state: 'running', error: null, startTs: ev.ts });
      pending.set(ev.title, idx);
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
  return steps;
}

function durationMs(step: TimelineStep): string {
  if (!step.endTs) return '';
  const ms = step.endTs - step.startTs;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

interface ManagerTimelineProps {
  stepEvents: StepEvent[];
  runStatus: RunStatus | null;
}

export function ManagerTimeline({ stepEvents, runStatus }: ManagerTimelineProps) {
  const steps = useMemo(() => buildTimeline(stepEvents), [stepEvents]);
  const isRunning = runStatus === 'running' || runStatus === null;

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2">
        {isRunning ? (
          <>
            <span className="inline-block w-6 h-6 rounded-full border-2 border-slate-600 border-t-sky-400 animate-spin" />
            <span className="text-sm">Waiting for test steps…</span>
            <span className="text-xs text-slate-600">
              Steps appear here as test.step() blocks execute
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl">📋</span>
            <span className="text-sm text-slate-400">No step events recorded</span>
            <span className="text-xs">
              Ensure tests use <code className="text-slate-300">test.step()</code> blocks
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
      {/* Summary chips */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500">{steps.length} step(s)</span>
        {passed > 0 && <span className="text-emerald-400">✓ {passed} passed</span>}
        {failed > 0 && <span className="text-rose-400">✗ {failed} failed</span>}
        {running > 0 && <span className="text-sky-400">⟳ {running} running</span>}
      </div>

      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              step.state === 'running'
                ? 'border-sky-800 bg-sky-950/30'
                : step.state === 'failed'
                  ? 'border-rose-800 bg-rose-950/20'
                  : 'border-slate-800/60 bg-slate-900/20'
            }`}
          >
            {/* Icon */}
            <span className="mt-0.5 shrink-0 w-5 text-center">
              {step.state === 'running' ? (
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-sky-600 border-t-sky-300 animate-spin" />
              ) : step.state === 'passed' ? (
                <span className="text-emerald-400 font-bold">✓</span>
              ) : (
                <span className="text-rose-400 font-bold">✗</span>
              )}
            </span>

            {/* Body */}
            <span className="flex-1 min-w-0">
              <span
                className={
                  step.state === 'running'
                    ? 'text-sky-200'
                    : step.state === 'failed'
                      ? 'text-rose-200'
                      : 'text-slate-300'
                }
              >
                {step.title}
              </span>
              {step.error && (
                <div className="mt-1 text-xs text-rose-300 font-mono whitespace-pre-wrap opacity-80">
                  {step.error}
                </div>
              )}
            </span>

            {/* Duration */}
            {step.endTs && (
              <span className="shrink-0 text-xs text-slate-500 font-mono">
                {durationMs(step)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
