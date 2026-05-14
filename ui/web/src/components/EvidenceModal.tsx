import { useEffect, useState } from 'react';
import type { TestEvidence, EvidenceStep } from '../api/client';
import { ImageCompareSlider } from './ImageCompareSlider';

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
        className={`flex items-start gap-1.5 py-1 rounded px-1 ${hasChildren ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
        style={{ paddingLeft: `${6 + depth * 20}px` }}
        onClick={hasChildren ? () => setOpen((o) => !o) : undefined}
      >
        <span className="shrink-0 w-3 text-slate-600 text-xs mt-0.5 text-center select-none">
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <span className="shrink-0 text-xs mt-0.5 w-3 text-center">
          {step.status === 'failed'
            ? <span className="text-rose-400">✗</span>
            : <span className="text-emerald-400">✓</span>}
        </span>
        <span className={`flex-1 text-sm leading-relaxed ${
          depth === 0 ? 'text-slate-200 font-medium'
          : isInternal ? 'text-slate-500 font-mono text-xs'
          : 'text-slate-400'
        }`}>
          {step.title}
        </span>
        {step.duration > 0 && (
          <span className="shrink-0 text-xs text-slate-600 font-mono tabular-nums ml-3">
            {fmtMs(step.duration)}
          </span>
        )}
      </div>
      {step.error && (
        <pre
          className="text-xs text-rose-300/90 font-mono bg-rose-950/30 rounded p-2 my-0.5 whitespace-pre-wrap break-all"
          style={{ marginLeft: `${6 + depth * 20 + 28}px`, marginRight: '8px' }}
        >
          {stripAnsi(step.error)}
        </pre>
      )}
      {open && hasChildren && step.steps.map((child, i) => (
        <StepRow key={i} step={child} depth={depth + 1} />
      ))}
    </>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <span className="flex-1 h-px bg-white/[0.06]" />
        {title}
        <span className="flex-1 h-px bg-white/[0.06]" />
      </h4>
      {children}
    </div>
  );
}

// ─── Image panel ──────────────────────────────────────────────────────────────

function ImagePanel({ label, src, highlight }: { label: string; src: string; highlight?: 'pass' | 'fail' | 'diff' }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;

  const borderColor =
    highlight === 'pass' ? 'border-emerald-500/30' :
    highlight === 'fail' ? 'border-rose-500/30' :
    highlight === 'diff' ? 'border-amber-500/30' :
    'border-white/[0.08]';

  const labelColor =
    highlight === 'pass' ? 'text-emerald-400' :
    highlight === 'fail' ? 'text-rose-400' :
    highlight === 'diff' ? 'text-amber-400' :
    'text-slate-400';

  return (
    <div className="space-y-2 flex flex-col">
      <div className={`text-xs font-semibold text-center uppercase tracking-wider ${labelColor}`}>{label}</div>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className={`block border-2 ${borderColor} rounded-lg overflow-hidden hover:border-brand-500/50 transition-colors flex-1`}
        title="Click to open full-size"
      >
        <img
          src={src}
          alt={label}
          className="w-full h-full object-contain bg-[#111] min-h-48"
          onError={() => setErrored(true)}
        />
      </a>
      <div className="text-xs text-slate-600 text-center">click to open full-size</div>
    </div>
  );
}

// ─── Main full-screen overlay ─────────────────────────────────────────────────

// Strip ANSI colour codes Playwright embeds in error messages so they
// render as plain text in the browser.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[^[\]]/g;
function stripAnsi(s: string): string { return s.replace(ANSI_RE, ''); }

export function EvidenceModal({
  test,
  baselineRun = false,
  onClose,
}: {
  test: TestEvidence;
  baselineRun?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const hasSteps     = test.steps.length > 0;
  const hasScreenshots = test.screenshots.length > 0;
  const hasVideo     = !!test.video;
  const hasTrace     = !!test.trace;
  const hasVisual    = !!(test.baseline || test.actual || test.diff);
  const hasErrors    = test.errors.length > 0;
  const hasMedia     = hasVideo || hasVisual || hasScreenshots || hasTrace;

  // Count visual panels for grid
  const visualPanels = [test.baseline, test.actual, test.diff].filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-[1400px] mx-auto px-6 py-0 min-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-white/[0.06] -mx-6 px-6 py-4 mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-2xl font-bold ${test.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
              {test.ok ? '✓' : '✗'}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">
                {test.specTitle || test.testTitle}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="font-mono">{test.projectName}</span>
                <span>·</span>
                <span className="font-mono">{fmtMs(test.duration)}</span>
                {test.retry > 0 && (
                  <span className="text-amber-400 font-medium">retry #{test.retry}</span>
                )}
                {hasVideo    && <span className="text-brand-400">▶ video</span>}
                {hasVisual   && <span className="text-purple-400">⊞ visual</span>}
                {hasTrace    && <span>⬡ trace</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost shrink-0 flex items-center gap-2 text-sm"
            aria-label="Close"
          >
            <span className="text-base leading-none">✕</span>
            <span className="hidden sm:inline">Close</span>
            <span className="hidden sm:inline text-slate-600 text-xs">(Esc)</span>
          </button>
        </header>

        {/* Two-column layout on large screens */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-8 pb-12">

          {/* LEFT — steps + errors */}
          <div className="space-y-8">
            {/* Baseline success banner — replaces errors when this is a baseline-creation run */}
            {baselineRun && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3">
                <span className="text-emerald-400 text-xl shrink-0">✓</span>
                <div>
                  <div className="text-sm font-semibold text-emerald-300">Baseline Created</div>
                  <div className="text-xs text-emerald-400/70 mt-0.5">
                    New snapshot baselines were written. Future runs will compare against these images.
                    {test.screenshots.length > 0 && ' The captured screenshots are shown in the Media panel.'}
                  </div>
                </div>
              </div>
            )}

            {/* Real errors (not shown on baseline runs since they're all patched away) */}
            {hasErrors && !baselineRun && (
              <Section title="Errors">
                <div className="space-y-3">
                  {test.errors.map((err, i) => (
                    <pre key={i} className="text-sm text-rose-300 font-mono bg-rose-950/30 border border-rose-700/30 rounded-lg p-4 whitespace-pre-wrap break-all overflow-x-auto">
                      {stripAnsi(err)}
                    </pre>
                  ))}
                </div>
              </Section>
            )}

            {hasSteps && (
              <Section title={`Steps · ${test.steps.length}`}>
                <div className="border border-white/[0.06] rounded-xl bg-surface-2/60 py-2 overflow-hidden">
                  {test.steps.map((step, i) => (
                    <StepRow key={i} step={step} depth={0} />
                  ))}
                </div>
              </Section>
            )}

            {!hasSteps && !hasErrors && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600 space-y-2">
                <span className="text-3xl">📋</span>
                <span className="text-sm">No step data recorded</span>
                <span className="text-xs text-center max-w-xs">
                  Add <code className="text-slate-400 font-mono">test.step()</code> blocks to your test for step-level evidence
                </span>
              </div>
            )}
          </div>

          {/* RIGHT — media */}
          {hasMedia && (
            <div className="space-y-8">
              {/* Video */}
              {hasVideo && (
                <Section title="Video Recording">
                  <video
                    src={test.video}
                    controls
                    className="w-full rounded-xl border border-white/[0.08] bg-black shadow-card"
                    style={{ maxHeight: '480px' }}
                  />
                </Section>
              )}

              {/* Visual regression — interactive slider when both images exist,
                  fall back to a static grid otherwise. */}
              {hasVisual && (
                <Section title="Visual Regression">
                  {test.baseline && test.actual ? (
                    <div className="space-y-4">
                      <ImageCompareSlider
                        beforeSrc={test.baseline}
                        afterSrc={test.actual}
                        beforeLabel="Baseline"
                        afterLabel="Actual"
                      />
                      {test.diff && (
                        <details className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden group">
                          <summary className="px-4 py-3 cursor-pointer text-xs font-semibold uppercase tracking-widest text-amber-300 flex items-center gap-2 hover:bg-amber-500/[0.08]">
                            <span className="text-amber-400">▸</span>
                            Pixel Diff Overlay
                            <span className="ml-auto text-amber-400/60 font-normal tracking-normal normal-case">Click to expand</span>
                          </summary>
                          <div className="p-4 border-t border-amber-500/20">
                            <ImagePanel label="Diff" src={test.diff} highlight="diff" />
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${visualPanels === 3 ? 'grid-cols-3' : visualPanels === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {test.baseline && (
                        <ImagePanel label="Baseline" src={test.baseline} highlight="pass" />
                      )}
                      {test.actual && (
                        <ImagePanel label="Actual" src={test.actual} highlight="fail" />
                      )}
                      {test.diff && (
                        <ImagePanel label="Diff" src={test.diff} highlight="diff" />
                      )}
                    </div>
                  )}
                  {!test.actual && !test.diff && test.baseline && (
                    <p className="text-sm text-emerald-400 text-center py-2">
                      ✓ Screenshot matches baseline
                    </p>
                  )}
                </Section>
              )}

              {/* Screenshots */}
              {hasScreenshots && (
                <Section title={`Screenshots · ${test.screenshots.length}`}>
                  <div className={`grid gap-4 ${test.screenshots.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {test.screenshots.map((url, i) => (
                      <ImagePanel key={i} label={`Screenshot ${i + 1}`} src={url} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Trace */}
              {hasTrace && (
                <Section title="Playwright Trace">
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-surface-2/60">
                    <span className="text-3xl">⬡</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200">trace.zip</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Open at{' '}
                        <a href="https://trace.playwright.dev" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
                          trace.playwright.dev
                        </a>
                        {' '}· or run{' '}
                        <code className="font-mono text-slate-400">npx playwright show-trace &lt;file&gt;</code>
                      </div>
                    </div>
                    <a href={test.trace} download className="btn-ghost text-sm shrink-0">↓ Download</a>
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
