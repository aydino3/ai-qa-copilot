import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchTests, fetchConfig, startRun, type DiscoveredTest } from '../api/client';
import { Spinner } from '../components/Spinner';

const PROJECT_ICON: Record<string, string> = {
  chromium: '🟡',
  firefox: '🦊',
  'mobile-safari': '📱',
  setup: '🔧',
  api: '🔌',
};

const TAG_COLORS: Record<string, string> = {
  smoke: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  regression: 'bg-sky-900/50 text-sky-300 border-sky-700',
  'ai-generated': 'bg-purple-900/50 text-purple-300 border-purple-700',
};

function tagChipClass(tag: string): string {
  return TAG_COLORS[tag] ?? 'bg-slate-800 text-slate-400 border-slate-700';
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tests, setTests] = useState<DiscoveredTest[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [project, setProject] = useState<string>('');
  const [grep, setGrep] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  function loadTests(cancelled: { value: boolean }) {
    setLoading(true);
    setLoadError(null);
    fetchTests()
      .then((res) => {
        if (cancelled.value) return;
        setTests(res.tests);
        setErrors(res.errors.map((e) => e.message));
      })
      .catch((err: Error) => {
        if (!cancelled.value) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled.value) setLoading(false);
      });
  }

  // Auto-refresh when navigated here with ?refresh=1 (from New Test page).
  useEffect(() => {
    const cancelled = { value: false };
    loadTests(cancelled);
    fetchConfig()
      .then((cfg) => {
        if (!cancelled.value) setBaseUrl(cfg.vars['BASE_URL'] ?? null);
      })
      .catch(() => {/* non-critical */});

    if (searchParams.get('refresh')) {
      setSearchParams({}, { replace: true });
    }
    return () => { cancelled.value = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('refresh')]);

  const projects = useMemo(
    () => Array.from(new Set(tests.map((t) => t.projectName))).sort(),
    [tests]
  );
  const tags = useMemo(
    () => Array.from(new Set(tests.flatMap((t) => t.tags))).sort(),
    [tests]
  );

  async function handleRun() {
    setStarting(true);
    setStartError(null);
    try {
      const { runId } = await startRun({
        project: project || undefined,
        grep: grep || undefined,
      });
      navigate(`/runs/${runId}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="space-y-6">
      {/* Environment banner */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <header className="space-y-0.5">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          {loading ? (
            <Spinner label="Discovering tests…" />
          ) : (
            <p className="text-sm text-slate-400">{tests.length} test(s) discovered</p>
          )}
        </header>

        {baseUrl && (
          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-slate-400">Testing against</span>
            <a
              href={baseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:text-sky-300 font-mono font-medium truncate max-w-xs"
            >
              {baseUrl}
            </a>
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">
          Failed to load tests: {loadError}
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded border border-amber-700 bg-amber-950/30 text-amber-200 text-sm p-3 space-y-1">
          <div className="font-semibold">⚠ Discovery warnings</div>
          {errors.map((e, i) => (
            <div key={i} className="font-mono text-xs whitespace-pre-wrap">
              {e}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Project</span>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {PROJECT_ICON[p] ?? '▸'} {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Grep / tag</span>
          <input
            value={grep}
            onChange={(e) => setGrep(e.target.value)}
            placeholder="@smoke"
            list="tag-suggestions"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
          />
          <datalist id="tag-suggestions">
            {tags.map((t) => (
              <option key={t} value={`@${t}`} />
            ))}
          </datalist>
        </label>

        <div className="flex items-end">
          <button
            onClick={handleRun}
            disabled={starting || loading}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded text-sm flex items-center justify-center gap-2"
          >
            {starting ? (
              <>
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Starting…
              </>
            ) : (
              <>▶ Run tests</>
            )}
          </button>
        </div>
      </div>

      {startError && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">
          {startError}
        </div>
      )}

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium">Test</th>
              <th className="text-left px-3 py-2.5 font-medium">Project</th>
              <th className="text-left px-3 py-2.5 font-medium">Tags</th>
              <th className="text-left px-3 py-2.5 font-medium">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="px-3 py-2.5"><div className="h-3 bg-slate-800 rounded w-2/3" /></td>
                  <td className="px-3 py-2.5"><div className="h-3 bg-slate-800 rounded w-16" /></td>
                  <td className="px-3 py-2.5"><div className="h-3 bg-slate-800 rounded w-12" /></td>
                  <td className="px-3 py-2.5"><div className="h-3 bg-slate-800 rounded w-1/2" /></td>
                </tr>
              ))}
            {!loading &&
              tests.map((t, i) => (
                <tr
                  key={`${t.file}:${t.line}:${t.projectName}:${i}`}
                  className="hover:bg-slate-900/40 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-500 shrink-0">
                        {t.tags.includes('ai-generated') ? '✦' : '◦'}
                      </span>
                      <span>{t.title}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                    {PROJECT_ICON[t.projectName] ?? '▸'} {t.projectName}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs border px-1.5 py-0.5 rounded ${tagChipClass(tag)}`}
                        >
                          @{tag}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap">
                    {t.file.split('/').slice(-2).join('/')}:{t.line}
                  </td>
                </tr>
              ))}
            {!loading && tests.length === 0 && !loadError && (
              <tr>
                <td colSpan={4} className="px-3 py-12 text-center text-slate-500">
                  <div className="space-y-2">
                    <div className="text-3xl">🔍</div>
                    <div className="text-slate-300 font-medium">No tests discovered</div>
                    <div className="text-xs max-w-sm mx-auto">
                      Check the discovery warnings above or verify your Playwright config
                      and <code>.env</code> file at the framework root.
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
