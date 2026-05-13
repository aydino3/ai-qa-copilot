import { useEffect, useState } from 'react';
import { fetchConfig, saveConfig } from '../api/client';
import { Spinner } from '../components/Spinner';

// Variables shown in a dedicated, labelled section at the top of the form.
const PRIMARY_KEYS = [
  'BASE_URL',
  'API_BASE_URL',
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
  'AI_ENABLED',
  'API_KEY',
];

const KEY_DESCRIPTIONS: Record<string, string> = {
  BASE_URL: 'URL of the application under test',
  API_BASE_URL: 'Base URL for the API client (data setup/teardown)',
  TEST_USER_EMAIL: 'Standard-user credentials',
  TEST_USER_PASSWORD: '',
  TEST_ADMIN_EMAIL: 'Admin-user credentials',
  TEST_ADMIN_PASSWORD: '',
  AI_ENABLED: 'Set to true to enable Claude-powered failure analysis',
  API_KEY: 'Optional bearer token for ApiClient',
};

const PASSWORD_KEYS = new Set(['TEST_USER_PASSWORD', 'TEST_ADMIN_PASSWORD']);

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
    <section className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-xl font-semibold">Environment settings</h2>
        {envPath && (
          <p className="text-xs text-slate-500 font-mono mt-0.5">{envPath}</p>
        )}
      </header>

      {loadError && (
        <div className="rounded border border-rose-700 bg-rose-950/40 text-rose-200 text-sm p-3">
          Failed to load config: {loadError}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading environment…" />
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-300 mb-2">
              Core variables
            </legend>
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
          </fieldset>

          {otherKeys.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-300 mb-2">
                Other variables
              </legend>
              {otherKeys.map((key) => (
                <EnvRow
                  key={key}
                  envKey={key}
                  value={vars[key] ?? ''}
                  isPassword={false}
                  onChange={(v) => update(key, v)}
                />
              ))}
            </fieldset>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded text-sm"
            >
              {saving ? 'Saving…' : 'Save to .env'}
            </button>
            {saveResult && (
              <span className={`text-sm ${saveResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                {saveResult.message}
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
    <label className="flex flex-col gap-1">
      <span className="text-xs font-mono text-slate-300">
        {envKey}
        {description && <span className="text-slate-500 font-sans ml-2">{description}</span>}
      </span>
      <div className="flex gap-2">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm font-mono focus:border-sky-500 focus:outline-none"
          placeholder={`${envKey}=`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-xs text-slate-500 hover:text-slate-300 px-2"
          >
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </label>
  );
}
