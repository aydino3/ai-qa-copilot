import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchTests, fetchConfig, fetchRuns, startRun, deleteTest, renameTest,
  type DiscoveredTest, type RunStatus, type RunSummary,
} from '../api/client';
import { Spinner } from '../components/Spinner';
import { TagChip } from '../components/TagChip';
import { Modal } from '../components/Modal';

const PROJECT_ICON: Record<string, string> = {
  chromium: '🟡',
  firefox: '🦊',
  'mobile-safari': '📱',
  setup: '🔧',
  api: '🔌',
};

function groupByTitle(tests: DiscoveredTest[]): Map<string, DiscoveredTest[]> {
  const map = new Map<string, DiscoveredTest[]>();
  for (const t of tests) {
    const existing = map.get(t.title) ?? [];
    existing.push(t);
    map.set(t.title, existing);
  }
  return map;
}

function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

const STATUS_BADGE: Record<RunStatus, { label: string; cls: string }> = {
  completed: { label: '✓', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  failed:    { label: '✗', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  running:   { label: '⟳', cls: 'bg-brand-500/20 text-brand-300 border-brand-500/30 animate-spin' },
  error:     { label: '⚠', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};

function lastRunForFile(runs: RunSummary[], file: string): RunSummary | null {
  // A run matches this file if it specified this exact file, or ran with no file filter (broad run).
  const matching = runs.filter((r) => {
    const hasFile = r.args.some((a) => a.endsWith('.ts') && !a.startsWith('-'));
    if (!hasFile) return true; // broad run
    return r.args.some((a) => file.endsWith(a) || a.endsWith(file));
  });
  return matching[0] ?? null; // already sorted newest-first by server
}

function LastRunBadge({ run }: { run: RunSummary }) {
  const badge = STATUS_BADGE[run.status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
      title={`Last run: ${run.status}`}
    >
      <span className={run.status === 'running' ? 'animate-spin inline-block' : ''}>{badge.label}</span>
      {run.status}
    </span>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tests, setTests] = useState<DiscoveredTest[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [project, setProject] = useState('');
  const [grep, setGrep] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [runs, setRuns] = useState<RunSummary[]>([]);

  // CRUD modal state
  const [deleteTarget, setDeleteTarget] = useState<DiscoveredTest | null>(null);
  const [renameTarget, setRenameTarget] = useState<DiscoveredTest | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadTests(cancelled: { v: boolean }) {
    setLoading(true);
    setLoadError(null);
    fetchTests()
      .then((res) => {
        if (cancelled.v) return;
        setTests(res.tests);
        setErrors(res.errors.map((e) => e.message));
      })
      .catch((err: Error) => { if (!cancelled.v) setLoadError(err.message); })
      .finally(() => { if (!cancelled.v) setLoading(false); });
  }

  useEffect(() => {
    const c = { v: false };
    loadTests(c);
    fetchConfig()
      .then((cfg) => { if (!c.v) setBaseUrl(cfg.vars['BASE_URL'] ?? null); })
      .catch(() => {});
    fetchRuns()
      .then((r) => { if (!c.v) setRuns(r.runs); })
      .catch(() => {});
    if (searchParams.get('refresh')) setSearchParams({}, { replace: true });
    return () => { c.v = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('refresh')]);

  const projects = useMemo(() => Array.from(new Set(tests.map((t) => t.projectName))).sort(), [tests]);
  const tags = useMemo(() => Array.from(new Set(tests.flatMap((t) => t.tags))).sort(), [tests]);

  const grouped = useMemo(() => groupByTitle(tests), [tests]);
  const cards = useMemo(() => {
    const entries = Array.from(grouped.entries());
    return entries.filter(([, ts]) => {
      if (project && !ts.some((t) => t.projectName === project)) return false;
      if (grep) {
        const q = grep.replace(/^@/, '').toLowerCase();
        const matchTitle = ts[0]?.title.toLowerCase().includes(q);
        const matchTag = ts.some((t) => t.tags.some((tg) => tg.toLowerCase().includes(q)));
        if (!matchTitle && !matchTag) return false;
      }
      return true;
    });
  }, [grouped, project, grep]);

  async function handleRun() {
    setStarting(true);
    setStartError(null);
    try {
      const { runId } = await startRun({ project: project || undefined, grep: grep || undefined });
      navigate(`/runs/${runId}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  function openDelete(test: DiscoveredTest) {
    setActionError(null);
    setDeleteTarget(test);
  }

  function openRename(test: DiscoveredTest) {
    setActionError(null);
    setRenameInput(basename(test.file));
    setRenameTarget(test);
  }

  function closeModals() {
    if (actionPending) return;
    setDeleteTarget(null);
    setRenameTarget(null);
    setActionError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionPending(true);
    setActionError(null);
    try {
      await deleteTest(deleteTarget.file);
      // Optimistic update — drop every spec that points at this file.
      setTests((prev) => prev.filter((t) => t.file !== deleteTarget.file));
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionPending(false);
    }
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === basename(renameTarget.file)) {
      setRenameTarget(null);
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      const result = await renameTest(renameTarget.file, trimmed);
      // Optimistic update — the discovered title doesn't change but the file does.
      const newFile = result.file;
      setTests((prev) => prev.map((t) => (t.file === renameTarget.file ? { ...t, file: newFile } : t)));
      setRenameTarget(null);
      // Re-discover in the background so Playwright's view stays in sync (titles, tags).
      loadTests({ v: false });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <section className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Test Suite</h2>
          {loading ? (
            <Spinner label="Discovering tests…" />
          ) : (
            <p className="text-sm text-slate-400">
              {cards.length} test{cards.length !== 1 ? 's' : ''} shown
              {tests.length !== cards.length && <span className="text-slate-500"> of {tests.length} total</span>}
            </p>
          )}
        </div>

        {baseUrl && (
          <a href={baseUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs hover:bg-brand-500/20 transition-colors group">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-slate-400">Environment:</span>
            <span className="text-brand-300 font-mono font-medium group-hover:text-brand-200 truncate max-w-xs">
              {baseUrl}
            </span>
          </a>
        )}
      </div>

      {/* Banners */}
      {loadError && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-4">
          Failed to load tests: {loadError}
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 text-amber-200 text-sm p-4 space-y-2">
          <div className="font-semibold text-amber-300">⚠ Discovery warnings</div>
          {errors.map((e, i) => <div key={i} className="font-mono text-xs text-amber-400/80 whitespace-pre-wrap">{e}</div>)}
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5 min-w-36">
          <label className="text-xs font-medium text-slate-400">Project</label>
          <select value={project} onChange={(e) => setProject(e.target.value)}
            className="input text-sm h-9">
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{PROJECT_ICON[p] ?? '▸'} {p}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-40">
          <label className="text-xs font-medium text-slate-400">Filter by tag or name</label>
          <input value={grep} onChange={(e) => setGrep(e.target.value)}
            placeholder="@smoke, login, api…"
            list="tag-suggestions"
            className="input text-sm h-9" />
          <datalist id="tag-suggestions">
            {tags.map((t) => <option key={t} value={`@${t}`} />)}
          </datalist>
        </div>

        <button onClick={handleRun} disabled={starting || loading} className="btn-primary h-9">
          {starting ? (
            <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Starting…</>
          ) : '▶ Run tests'}
        </button>
      </div>

      {startError && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-3">
          {startError}
        </div>
      )}

      {/* Test cards grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-surface-5 rounded w-3/4" />
              <div className="h-3 bg-surface-5 rounded w-1/2" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-surface-5 rounded" />
                <div className="h-5 w-12 bg-surface-5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 space-y-3">
          <div className="text-5xl">🔍</div>
          <div className="text-lg font-semibold text-slate-200">No tests found</div>
          <div className="text-sm text-slate-500 text-center max-w-xs">
            {tests.length === 0
              ? 'No tests discovered yet. Use the AI Builder to generate your first test, or check your .env file.'
              : 'No tests match your current filters. Try clearing the project or tag filter.'}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([title, testGroup]) => {
            const first = testGroup[0]!;
            const uniqueTags = Array.from(new Set(testGroup.flatMap((t) => t.tags)));
            const uniqueProjects = Array.from(new Set(testGroup.map((t) => t.projectName)));
            const isAI = uniqueTags.includes('ai-generated');
            const filePath = first.file.split('/').slice(-2).join('/');
            const lastRun = lastRunForFile(runs, first.file);

            return (
              <div key={title} className="card-hover p-5 space-y-4 cursor-default group relative">
                {/* Action buttons — fade in on card hover */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => openRename(first)}
                    title="Rename test file"
                    aria-label="Rename test"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-300 hover:bg-brand-500/15 hover:scale-110 active:scale-95 transition-all duration-150"
                  >
                    <span className="text-sm">✎</span>
                  </button>
                  <button
                    onClick={() => openDelete(first)}
                    title="Delete test file"
                    aria-label="Delete test"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 hover:scale-110 active:scale-95 transition-all duration-150"
                  >
                    <span className="text-sm">🗑</span>
                  </button>
                </div>

                {/* Card header */}
                <div className="flex items-start justify-between gap-2 pr-20">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 shrink-0 text-base">
                      {isAI ? '✦' : '◦'}
                    </span>
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                      {title}
                    </h3>
                  </div>
                  {lastRun && <LastRunBadge run={lastRun} />}
                </div>

                {/* Tags */}
                {uniqueTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueTags.map((t) => <TagChip key={t} tag={t} />)}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {uniqueProjects.map((p) => (
                      <span key={p} className="text-xs text-slate-500">
                        {PROJECT_ICON[p] ?? '▸'} {p}
                      </span>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-600 font-mono truncate max-w-[120px]" title={first.file}>
                    {filePath}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={closeModals}
        title={<span className="flex items-center gap-2"><span>🗑</span>Delete test?</span>}
      >
        {deleteTarget && (
          <>
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                This will permanently delete the test file and any associated visual-regression snapshots from disk.
              </p>
              <div className="card p-3 space-y-1">
                <div className="text-xs font-semibold text-slate-400">{deleteTarget.title}</div>
                <code className="block text-xs font-mono text-rose-300/90 break-all">
                  {deleteTarget.file}
                </code>
              </div>
              {actionError && (
                <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-xs p-3">
                  {actionError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={closeModals} disabled={actionPending} className="btn-ghost text-sm">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={actionPending} className="btn-danger">
                {actionPending ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Deleting…</>
                ) : 'Delete permanently'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Rename modal */}
      <Modal
        open={renameTarget !== null}
        onClose={closeModals}
        title={<span className="flex items-center gap-2"><span>✎</span>Rename test file</span>}
      >
        {renameTarget && (
          <form
            onSubmit={(e) => { e.preventDefault(); void confirmRename(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                New filename
              </label>
              <input
                autoFocus
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="login.smoke.ts"
                className="input-mono text-sm"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Must end with one of: <code className="text-brand-300">.smoke.ts</code>,{' '}
                <code className="text-brand-300">.regression.ts</code>,{' '}
                <code className="text-brand-300">.visual.ts</code>,{' '}
                <code className="text-brand-300">.api.ts</code>,{' '}
                <code className="text-brand-300">.spec.ts</code>,{' '}
                <code className="text-brand-300">.test.ts</code>,{' '}
                <code className="text-brand-300">.ai-generated.ts</code>.
              </p>
              <div className="text-[11px] text-slate-600 font-mono break-all">
                current: {renameTarget.file}
              </div>
            </div>
            {actionError && (
              <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-xs p-3">
                {actionError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeModals} disabled={actionPending} className="btn-ghost text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionPending || !renameInput.trim()}
                className="btn-primary"
              >
                {actionPending ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Renaming…</>
                ) : 'Rename'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
