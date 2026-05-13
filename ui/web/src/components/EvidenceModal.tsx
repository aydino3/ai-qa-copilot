import { useState } from 'react';
import type { TestEvidence, EvidenceStep } from '../api/client';
import { Modal } from './Modal';

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

// ─── Step tree ────────────────────────────────────────────────────────────────

function StepRow({ step, depth }: { step: EvidenceStep; depth: number }) {
  const [open, setOpen] = useState(depth === 0 || step.status === 'failed');
  const hasChildren = step.steps.length > 0;
  const isInternal = step.category === 'pw:api' || step.category === 'hook';

  return (
    <>
      <div
        className={`flex items-start gap-1.5 py-1 rounded px-1 ${hasChildren ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
        style={{ paddingLeft: `${6 + depth * 18}px` }}
        onClick={hasChildren ? () => setOpen((o) => !o) : undefined}
      >
        {/* Expand toggle */}
        <span className="shrink-0 w-3 text-slate-600 text-xs mt-0.5 text-center select-none">
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>

        {/* Status icon */}
        <span className="shrink-0 text-xs mt-0.5 w-3 text-center">
          {step.status === 'failed'
            ? <span className="text-rose-400">✗</span>
            : <span className="text-emerald-400">✓</span>}
        </span>

        {/* Title */}
        <span className={`flex-1 text-xs leading-relaxed ${
          depth === 0
            ? 'text-slate-200 font-medium'
            : isInternal
              ? 'text-slate-500 font-mono'
              : 'text-slate-400'
        }`}>
          {step.title}
        </span>

        {/* Duration */}
        {step.duration > 0 && (
          <span className="shrink-0 text-xs text-slate-600 font-mono tabular-nums ml-2">
            {fmtMs(step.duration)}
          </span>
        )}
      </div>

      {/* Inline error */}
      {step.error && (
        <div
          className="text-xs text-rose-300/90 font-mono bg-rose-950/30 rounded p-2 my-0.5 whitespace-pre-wrap break-all"
          style={{ marginLeft: `${6 + depth * 18 + 28}px`, marginRight: '4px' }}
        >
          {step.error}
        </div>
      )}

      {/* Children */}
      {open && hasChildren && step.steps.map((child, i) => (
        <StepRow key={i} step={child} depth={depth + 1} />
      ))}
    </>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
      {children}
    </div>
  );
}

// ─── Image panel ──────────────────────────────────────────────────────────────

function ImagePanel({ label, src }: { label: string; src: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500 text-center font-medium">{label}</div>
      <a href={src} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={src}
          alt={label}
          className="w-full rounded border border-white/[0.08] object-contain bg-surface-2 hover:border-brand-500/40 transition-colors"
          onError={() => setErrored(true)}
        />
      </a>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function EvidenceModal({
  test,
  onClose,
}: {
  test: TestEvidence;
  onClose: () => void;
}) {
  const hasSteps = test.steps.length > 0;
  const hasScreenshots = test.screenshots.length > 0;
  const hasVideo = !!test.video;
  const hasTrace = !!test.trace;
  const hasVisual = !!(test.baseline || test.actual || test.diff);
  const hasErrors = test.errors.length > 0;

  const titleIcon = test.ok
    ? <span className="text-emerald-400">✓</span>
    : <span className="text-rose-400">✗</span>;

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2 min-w-0">
          {titleIcon}
          <span className="truncate">{test.specTitle || test.testTitle}</span>
          <span className="shrink-0 text-xs text-slate-500 font-normal font-mono ml-1">
            {test.projectName} · {fmtMs(test.duration)}
          </span>
          {test.retry > 0 && (
            <span className="shrink-0 text-xs text-amber-400 font-normal">retry #{test.retry}</span>
          )}
        </span>
      }
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">

        {/* Errors */}
        {hasErrors && (
          <Section title="Errors">
            <div className="space-y-2">
              {test.errors.map((err, i) => (
                <pre key={i} className="text-xs text-rose-300 font-mono bg-rose-950/30 rounded p-3 whitespace-pre-wrap break-all">
                  {err}
                </pre>
              ))}
            </div>
          </Section>
        )}

        {/* Steps */}
        {hasSteps && (
          <Section title={`Steps (${test.steps.length})`}>
            <div className="border border-white/[0.06] rounded-lg bg-surface-2/50 py-1 overflow-hidden">
              {test.steps.map((step, i) => (
                <StepRow key={i} step={step} depth={0} />
              ))}
            </div>
          </Section>
        )}

        {/* Video */}
        {hasVideo && (
          <Section title="Video Recording">
            <video
              src={test.video}
              controls
              className="w-full rounded-lg border border-white/[0.08] bg-black"
            />
          </Section>
        )}

        {/* Visual regression */}
        {hasVisual && (
          <Section title="Visual Regression">
            <div className={`grid gap-3 ${
              (test.baseline ? 1 : 0) + (test.actual ? 1 : 0) + (test.diff ? 1 : 0) === 3
                ? 'grid-cols-3'
                : 'grid-cols-2'
            }`}>
              {test.baseline && <ImagePanel label="Baseline (expected)" src={test.baseline} />}
              {test.actual && <ImagePanel label="Actual" src={test.actual} />}
              {test.diff && <ImagePanel label="Diff" src={test.diff} />}
            </div>
            {!test.actual && !test.diff && test.baseline && (
              <p className="text-xs text-slate-500 text-center">Snapshot matches baseline ✓</p>
            )}
          </Section>
        )}

        {/* Screenshots */}
        {hasScreenshots && (
          <Section title={`Screenshots (${test.screenshots.length})`}>
            <div className={`grid gap-3 ${test.screenshots.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {test.screenshots.map((url, i) => (
                <ImagePanel key={i} label={`Screenshot ${i + 1}`} src={url} />
              ))}
            </div>
          </Section>
        )}

        {/* Trace */}
        {hasTrace && (
          <Section title="Playwright Trace">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] bg-surface-2/50">
              <span className="text-2xl">⬡</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-300 font-medium">trace.zip</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Open at{' '}
                  <a
                    href="https://trace.playwright.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:underline"
                  >
                    trace.playwright.dev
                  </a>
                  {' '}or run <code className="font-mono text-slate-400">npx playwright show-trace</code>
                </div>
              </div>
              <a
                href={test.trace}
                download
                className="btn-ghost text-xs shrink-0"
              >
                ↓ Download
              </a>
            </div>
          </Section>
        )}
      </div>
    </Modal>
  );
}
