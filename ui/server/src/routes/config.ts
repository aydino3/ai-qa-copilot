import { Router, type Request, type Response } from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FRAMEWORK_ROOT } from '../config.js';

export const configRouter: Router = Router();

const ENV_PATH = path.join(FRAMEWORK_ROOT, '.env');

// Keys that will never be returned or updated through this API.
const REDACTED_KEYS = new Set(['ANTHROPIC_API_KEY']);

interface EnvLine {
  type: 'comment' | 'blank' | 'pair';
  raw: string;
  key?: string;
  value?: string;
}

function parseEnvFile(contents: string): EnvLine[] {
  return contents.split('\n').map((raw) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '') return { type: 'blank', raw };
    if (trimmed.startsWith('#')) return { type: 'comment', raw };
    const eq = raw.indexOf('=');
    if (eq === -1) return { type: 'comment', raw }; // malformed — keep as-is
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1);
    return { type: 'pair', raw, key, value };
  });
}

function serializeEnvFile(lines: EnvLine[], updates: Record<string, string>): string {
  const seen = new Set<string>();
  const out: string[] = lines.map((line) => {
    if (line.type !== 'pair' || !line.key) return line.raw;
    seen.add(line.key);
    if (line.key in updates && !REDACTED_KEYS.has(line.key)) {
      return `${line.key}=${updates[line.key]}`;
    }
    return line.raw;
  });
  // Append any keys from updates that didn't already exist in the file.
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key) && !REDACTED_KEYS.has(key)) {
      out.push(`${key}=${value}`);
    }
  }
  return out.join('\n');
}

configRouter.get('/', async (_req: Request, res: Response) => {
  let contents = '';
  try {
    contents = await fs.readFile(ENV_PATH, 'utf8');
  } catch {
    // .env doesn't exist yet — return empty config.
  }
  const lines = parseEnvFile(contents);
  const vars: Record<string, string> = {};
  for (const line of lines) {
    if (line.type === 'pair' && line.key && !REDACTED_KEYS.has(line.key)) {
      vars[line.key] = line.value ?? '';
    }
  }
  res.json({ vars, envPath: ENV_PATH });
});

configRouter.post('/', async (req: Request, res: Response) => {
  const updates = (req.body ?? {}) as Record<string, unknown>;
  // Validate: values must be strings, keys must be safe identifiers.
  const safeKey = /^[A-Z_][A-Z0-9_]*$/i;
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (!safeKey.test(k) || REDACTED_KEYS.has(k)) continue;
    cleaned[k] = typeof v === 'string' ? v : String(v ?? '');
  }

  let existing = '';
  try {
    existing = await fs.readFile(ENV_PATH, 'utf8');
  } catch {
    // File doesn't exist — will be created.
  }
  const lines = parseEnvFile(existing);
  const updated = serializeEnvFile(lines, cleaned);
  try {
    await fs.writeFile(ENV_PATH, updated, 'utf8');
    res.json({ ok: true, envPath: ENV_PATH, updated: Object.keys(cleaned) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'write_failed', message });
  }
});
