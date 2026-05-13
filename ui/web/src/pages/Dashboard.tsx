import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchTests, fetchConfig, startRun, type DiscoveredTest } from '../api/client';
import { Spinner } from '../components/Spinner';
import { TagChip } from '../components/TagChip';

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
    if (searchParams.get('refresh')) setSearchParams({}, { replace: true });
    return () => { c.v = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('refresh')]);

  const projects = useMemo(() => Array.from(new Set(tests.map((t) => t.projectName))).sort(), [tests]);
  const tags = useMemo(() => Array.from(new Set(tests.flatMap((t) => t.tags))).sort(), [tests]);

  // Group by title for card view (collapse multi-project duplicates)
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

            return (
              <div key={title} className="card-hover p-5 space-y-4 cursor-default group">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 shrink-0 text-base">
                      {isAI ? '✦' : '◦'}
                    </span>
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                      {title}
                    </h3>
                  </div>
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
                  <span className="text-[11px] text-slate-600 font-mono truncate max-w-[120px]" title={filePath}>
                    {filePath}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
