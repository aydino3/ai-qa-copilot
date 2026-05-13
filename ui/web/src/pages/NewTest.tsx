import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateTest } from '../api/client';

const STEPS_PLACEHOLDER = `Go to /login
Fill the Email field with test@example.com
Fill the Password field with secret
Click the Sign in button
Verify the URL is /dashboard
Verify the heading "Welcome" is visible`;

export function NewTest() {
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState('');
  const [steps, setSteps] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ filename: string; code: string; aiEnabled: boolean } | null>(null);

  async function handleGenerate() {
    if (!targetUrl.trim() || !steps.trim()) return;
    setGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const res = await generateTest(targetUrl.trim(), steps.trim());
      setPreview(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  function handleGoToDashboard() {
    navigate('/?refresh=1');
  }

  return (
    <section className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="text-sky-400">✦</span> AI Test Builder
        </h2>
        <p className="text-sm text-slate-400">
          Describe what you want to test in plain English and Claude will generate a
          production-ready Playwright TypeScript file saved to{' '}
          <code className="text-slate-300">tests/ai-generated/</code>.
        </p>
      </header>

      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">
            Target URL or feature name
          </span>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://your-app.com/login  or  Login flow"
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">
            Test steps <span className="text-slate-500 font-normal">(one step per line)</span>
          </span>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={8}
            placeholder={STEPS_PLACEHOLDER}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono focus:border-sky-500 focus:outline-none resize-y leading-relaxed"
            required
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={generating || !targetUrl.trim() || !steps.trim()}
            className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded text-sm"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Generating…
              </span>
            ) : (
              '✦ Generate test'
            )}
          </button>
          {!preview && (
            <span className="text-xs text-slate-500">
              AI_ENABLED controls whether Claude or a mock template is used
            </span>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">
          {error}
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-medium text-sm">✓ Test saved</span>
              <code className="text-xs text-slate-400 font-mono">{preview.filename}</code>
              <span className="text-xs border border-slate-700 rounded px-1.5 py-0.5 text-slate-500">
                {preview.aiEnabled ? '🤖 Claude' : '📄 mock template'}
              </span>
            </div>
            <button
              onClick={handleGoToDashboard}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-1.5 rounded"
            >
              Go to Dashboard →
            </button>
          </div>
          <div className="rounded-lg border border-slate-800 bg-black overflow-auto max-h-96">
            <pre className="text-xs text-slate-300 font-mono p-4 whitespace-pre">{preview.code}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
