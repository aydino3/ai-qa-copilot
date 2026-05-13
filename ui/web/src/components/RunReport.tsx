import { useState } from 'react';
import type { RunEvidence, TestEvidence } from '../api/client';
import { EvidenceModal } from './EvidenceModal';

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function RunReport({ evidence }: { evidence: RunEvidence }) {
  const [selected, setSelected] = useState<TestEvidence | null>(null);

  const passed = evidence.tests.filter((t) => t.ok).length;
  const failed = evidence.tests.filter((t) => !t.ok).length;
  const totalMs = evidence.tests.reduce((s, t) => s + t.duration, 0);

  if (evidence.tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2">
        <span className="text-3xl">📭</span>
        <span className="text-sm">No test results recorded for this run</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-5 text-sm flex-wrap">
        <span className="text-slate-400">
          {evidence.tests.length} test{evidence.tests.length !== 1 ? 's' : ''}
        </span>
        {passed > 0 && <span className="text-emerald-400 font-medium">✓ {passed} passed</span>}
        {failed > 0 && <span className="text-rose-400 font-medium">✗ {failed} failed</span>}
        {evidence.baselineRun && (
          <span className="text-brand-300 text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20">
            ⊕ baseline run
          </span>
        )}
        <span className="text-slate-600 text-xs font-mono ml-auto">{fmtMs(totalMs)} total</span>
      </div>

      {/* Test cards */}
      <div className="space-y-2">
        {evidence.tests.map((test, i) => (
          <TestCard key={i} test={test} onView={() => setSelected(test)} />
        ))}
      </div>

      {selected && (
        <EvidenceModal test={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TestCard({ test, onView }: { test: TestEvidence; onView: () => void }) {
  const hasVideo = !!test.video;
  const hasVisual = !!(test.baseline || test.actual || test.diff);
  const hasTrace = !!test.trace;

  return (
    <div className="card-hover flex items-center gap-4 px-4 py-3 cursor-pointer group" onClick={onView}>
      {/* Status icon */}
      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
        test.ok
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
      }`}>
        {test.ok ? '✓' : '✗'}
      </span>

      {/* Title + metadata */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-200 text-sm truncate">
          {test.specTitle || test.testTitle}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-500">{test.projectName}</span>
          {test.retry > 0 && (
            <span className="text-xs text-amber-400 font-medium">retry #{test.retry}</span>
          )}
          {hasVideo && <span className="text-xs text-brand-400">▶ video</span>}
          {hasVisual && <span className="text-xs text-purple-400">⊞ visual</span>}
          {hasTrace && <span className="text-xs text-slate-500">⬡ trace</span>}
          {test.screenshots.length > 0 && (
            <span className="text-xs text-slate-500">
              {test.screenshots.length} screenshot{test.screenshots.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Duration */}
      <span className="shrink-0 text-xs text-slate-500 font-mono tabular-nums">
        {fmtMs(test.duration)}
      </span>

      {/* CTA */}
      <span className="shrink-0 text-xs text-slate-500 group-hover:text-brand-300 transition-colors">
        Details →
      </span>
    </div>
  );
}
