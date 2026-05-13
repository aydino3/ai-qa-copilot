import { useEffect, useState } from 'react';
import { fetchConfig, saveConfig } from '../api/client';
import { Spinner } from '../components/Spinner';

const PRIMARY_KEYS = [
  'BASE_URL',
  'API_BASE_URL',
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
  'AI_ENABLED',
  'GEMINI_API_KEY',
  'API_KEY',
];

const KEY_DESCRIPTIONS: Record<string, string> = {
  BASE_URL: 'URL of the application under test',
  API_BASE_URL: 'Base URL for the API client (data setup/teardown)',
  TEST_USER_EMAIL: 'Standard-user credentials',
  TEST_USER_PASSWORD: '',
  TEST_ADMIN_EMAIL: 'Admin-user credentials',
  TEST_ADMIN_PASSWORD: '',
  AI_ENABLED: 'Set to true to enable Gemini-powered test generation',
  GEMINI_API_KEY: 'Google AI Studio API key (free tier — aistudio.google.com)',
  API_KEY: 'Optional bearer token for ApiClient',
};

const PASSWORD_KEYS = new Set(['TEST_USER_PASSWORD', 'TEST_ADMIN_PASSWORD', 'GEMINI_API_KEY']);

export function Settings() {
  const [vars, setVars] = useState<Record<string, string>>({});
  const [envPath, setEnvPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConfig()
      .then((res) => {
        setVars(res.vars);
        setEnvPath(res.envPath);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const primaryVars = PRIMARY_KEYS.filter((k) => k in vars || PRIMARY_KEYS.includes(k));
  const otherKeys = Object.keys(vars).filter((k) => !PRIMARY_KEYS.includes(k));

  function update(key: string, value: string) {
    setVars((prev) => ({ ...prev, [key]: value }));
    setSaveResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await saveConfig(vars);
      setSaveResult({ ok: true, message: `Saved ${res.updated.length} variable(s).` });
    } catch (err) {
      setSaveResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-8 max-w-2xl animate-slide-up">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-sm shadow-glow-sm">⚙</span>
          Environment settings
        </h2>
        {envPath && (
          <p className="text-xs text-slate-500 font-mono mt-0.5">{envPath}</p>
        )}
      </header>

      {loadError && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm p-4">
          Failed to load config: {loadError}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading environment…" />
      ) : (
        <form
          className="space-y-6"
          onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
        >
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Core variables
            </legend>
            <div className="card p-4 space-y-4">
              {primaryVars.map((key) => (
                <EnvRow
                  key={key}
                  envKey={key}
                  value={vars[key] ?? ''}
                  description={KEY_DESCRIPTIONS[key]}
                  isPassword={PASSWORD_KEYS.has(key)}
                  onChange={(v) => update(key, v)}
                />
              ))}
            </div>
          </fieldset>

          {otherKeys.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-3">
                Other variables
              </legend>
              <div className="card p-4 space-y-4">
                {otherKeys.map((key) => (
                  <EnvRow
                    key={key}
                    envKey={key}
                    value={vars[key] ?? ''}
                    isPassword={false}
                    onChange={(v) => update(key, v)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center gap-4 pt-1">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</>
              ) : (
                <>💾 Save to .env</>
              )}
            </button>
            {saveResult && (
              <span className={`text-sm ${saveResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                {saveResult.ok ? '✓ ' : '✗ '}{saveResult.message}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

interface EnvRowProps {
  envKey: string;
  value: string;
  description?: string;
  isPassword: boolean;
  onChange: (v: string) => void;
}

function EnvRow({ envKey, value, description, isPassword, onChange }: EnvRowProps) {
  const [show, setShow] = useState(false);
  const inputType = isPassword && !show ? 'password' : 'text';

  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2">
        <span className="text-xs font-mono font-semibold text-brand-300">{envKey}</span>
        {description && <span className="text-xs text-slate-500">{description}</span>}
      </span>
      <div className="flex gap-2">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-mono flex-1 text-sm"
          placeholder={`${envKey}=`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="btn-ghost text-xs px-3"
          >
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </label>
  );
}
