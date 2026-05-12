import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTests, startRun, type DiscoveredTest } from '../api/client';
import { Spinner } from '../components/Spinner';

export function Dashboard() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<DiscoveredTest[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState<string>('');
  const [grep, setGrep] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTests()
      .then((res) => {
        if (cancelled) return;
        setTests(res.tests);
        setErrors(res.errors.map((e) => e.message));
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        {loading ? (
          <Spinner label="Discovering tests…" />
        ) : (
          <p className="text-sm text-slate-400">{tests.length} test(s) discovered</p>
        )}
      </header>

      {loadError && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">
          Failed to load tests: {loadError}
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded border border-amber-700 bg-amber-950/30 text-amber-200 text-sm p-3 space-y-1">
          <div className="font-semibold">Discovery warnings:</div>
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
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Grep / tag</span>
          <input
            value={grep}
            onChange={(e) => setGrep(e.target.value)}
            placeholder="e.g. @smoke"
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
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded text-sm"
          >
            {starting ? 'Starting…' : 'Run tests'}
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
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Title</th>
              <th className="text-left px-3 py-2 font-medium">Project</th>
              <th className="text-left px-3 py-2 font-medium">Tags</th>
              <th className="text-left px-3 py-2 font-medium">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="px-3 py-2"><div className="h-3 bg-slate-800 rounded w-2/3" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-slate-800 rounded w-16" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-slate-800 rounded w-12" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-slate-800 rounded w-1/2" /></td>
                </tr>
              ))}
            {!loading &&
              tests.map((t, i) => (
                <tr key={`${t.file}:${t.line}:${t.projectName}:${i}`}>
                  <td className="px-3 py-2">{t.title}</td>
                  <td className="px-3 py-2 text-slate-400">{t.projectName}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {t.tags.map((tag) => `@${tag}`).join(' ')}
                  </td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs">
                    {t.file.split('/').slice(-2).join('/')}:{t.line}
                  </td>
                </tr>
              ))}
            {!loading && tests.length === 0 && !loadError && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                  <div className="space-y-1">
                    <div className="text-slate-300">No tests discovered.</div>
                    <div className="text-xs">
                      Check the discovery warnings above or verify your Playwright
                      config and <code>.env</code> file at the framework root.
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
