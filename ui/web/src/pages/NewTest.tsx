import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateTest } from '../api/client';
import { TagChip } from '../components/TagChip';

const STEPS_PLACEHOLDER = `Go to /login
Fill the Email field with test@example.com
Fill the Password field with secret
Click the Sign in button
Verify the URL contains /dashboard
Verify the heading "Welcome" is visible`;

const PRESET_TAGS = ['@smoke', '@regression', '@visual'];

export function NewTest() {
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState('');
  const [steps, setSteps] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visualRegression, setVisualRegression] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    filename: string; code: string; aiEnabled: boolean; visualRegression?: boolean;
  } | null>(null);

  function togglePresetTag(tag: string) {
    const current = tagsInput.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    const clean = tag.startsWith('@') ? tag : `@${tag}`;
    if (current.includes(clean)) {
      setTagsInput(current.filter((t) => t !== clean).join(', '));
    } else {
      setTagsInput([...current, clean].join(', '));
    }
  }

  function hasTag(tag: string) {
    const clean = tag.startsWith('@') ? tag : `@${tag}`;
    return tagsInput.split(/[\s,]+/).map((t) => t.trim()).includes(clean);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUrl.trim() || !steps.trim()) return;
    setGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const res = await generateTest({
        targetUrl: targetUrl.trim(),
        steps: steps.trim(),
        tags: tagsInput.trim() || undefined,
        visualRegression,
      });
      setPreview(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-8 animate-slide-up">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-sm shadow-glow-sm">✦</span>
          AI Test Builder
        </h2>
        <p className="text-sm text-slate-400">
          Describe your test in plain English. Gemini generates a production-ready Playwright TypeScript file.
        </p>
      </header>

      <form onSubmit={handleGenerate} className="space-y-5">
        {/* Target */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Target URL or feature name
          </label>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://app.example.com/login  or  Login flow"
            className="input"
            required
          />
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Test steps <span className="text-slate-500 normal-case font-normal">(one per line)</span>
          </label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={7}
            placeholder={STEPS_PLACEHOLDER}
            className="input-mono resize-y leading-relaxed"
            required
          />
        </div>

        {/* Tags */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Tags
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => togglePresetTag(t)}
                className={`tag-chip cursor-pointer transition-all duration-150 ${
                  hasTag(t)
                    ? t === '@smoke'      ? 'tag-smoke ring-1 ring-emerald-500/50'
                    : t === '@regression' ? 'tag-regression ring-1 ring-brand-500/50'
                    : 'tag-visual ring-1 ring-purple-500/50'
                    : 'tag-default hover:border-white/20'
                }`}
              >
                {t}
              </button>
            ))}
            <span className="text-slate-600 text-xs">or type below</span>
          </div>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="@smoke, @regression, @myfeature"
            className="input text-sm"
          />
        </div>

        {/* Visual regression */}
        <label className="flex items-start gap-3 card p-4 cursor-pointer hover:border-brand-500/30 transition-all">
          <input
            type="checkbox"
            checked={visualRegression}
            onChange={(e) => setVisualRegression(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              📸 Enable Visual Regression Testing
              <span className="tag-visual">@visual</span>
            </span>
            <span className="text-xs text-slate-500 leading-relaxed">
              Adds <code className="text-brand-300">toHaveScreenshot()</code> assertions.
              First run creates the baseline; subsequent runs diff against it.
            </span>
          </span>
        </label>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={generating || !targetUrl.trim() || !steps.trim()} className="btn-primary">
            {generating ? (
              <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Generating…</>
            ) : (
              <><span>✦</span> Generate test</>
            )}
          </button>
          <span className="text-xs text-slate-600">
            {generating ? 'Calling Gemini…' : 'AI_ENABLED controls Gemini vs template'}
          </span>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-4">
          {error}
        </div>
      )}

      {preview && (
        <div className="card space-y-4 p-5 animate-slide-up">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-emerald-400 font-semibold text-sm">✓ Test saved</span>
              <code className="text-xs text-slate-400 font-mono bg-surface-3 px-2 py-0.5 rounded">
                {preview.filename}
              </code>
              <span className="tag-default">
                {preview.aiEnabled ? '✨ Gemini' : '📄 template'}
              </span>
              {preview.visualRegression && <span className="tag-visual">📸 visual</span>}
            </div>
            <button onClick={() => navigate('/?refresh=1')} className="btn-primary text-xs px-4 py-1.5">
              View in Dashboard →
            </button>
          </div>

          {/* Preview tags from parsed content */}
          <div className="flex flex-wrap gap-1.5">
            {tagsInput.split(/[\s,]+/).filter(Boolean).map((t) => (
              <TagChip key={t} tag={t} />
            ))}
            <TagChip tag="@ai-generated" />
          </div>

          <div className="rounded-lg bg-black border border-white/[0.07] overflow-auto max-h-72">
            <pre className="text-xs text-slate-300 font-mono p-4 whitespace-pre leading-relaxed">
              {preview.code}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
