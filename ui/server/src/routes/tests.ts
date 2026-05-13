import { Router, type Request, type Response } from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { listTests } from '../utils/playwright.js';
import { FRAMEWORK_ROOT } from '../config.js';

export const testsRouter: Router = Router();

const TESTS_DIR = path.resolve(FRAMEWORK_ROOT, 'tests');
const TEST_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

interface ResolvedTest {
  absPath: string;
  snapshotDir: string;
  basename: string;
  dir: string;
}

/**
 * Resolve a user-supplied test file path safely. The path is taken either
 * absolute (and re-anchored under tests/) or relative to FRAMEWORK_ROOT.
 * Rejects path traversal and non-test extensions.
 */
function resolveTestFile(file: string): ResolvedTest | { error: string; status: number } {
  if (!file || typeof file !== 'string') {
    return { error: '`file` is required', status: 400 };
  }
  // Strip leading slash, normalise, and resolve against FRAMEWORK_ROOT.
  const cleaned = file.replace(/^[/\\]+/, '');
  const absPath = path.resolve(FRAMEWORK_ROOT, cleaned);

  // Path-traversal guard: must live inside tests/.
  if (!absPath.startsWith(TESTS_DIR + path.sep) && absPath !== TESTS_DIR) {
    return { error: 'file must live inside tests/', status: 400 };
  }
  const ext = path.extname(absPath);
  if (!TEST_EXTENSIONS.has(ext)) {
    return { error: `unsupported extension '${ext}'`, status: 400 };
  }
  const basename = path.basename(absPath, ext);
  const dir = path.dirname(absPath);
  const snapshotDir = path.join(dir, `${basename}-snapshots`);
  return { absPath, snapshotDir, basename, dir };
}

async function removeIfExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
  await fs.rm(target, { recursive: true, force: true });
  return true;
}

testsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const { tests, errors } = await listTests();
    res.json({ count: tests.length, tests, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'failed_to_list_tests', message });
  }
});

/**
 * DELETE /api/tests?file=tests/smoke/demo.smoke.ts
 * Removes the test file and its associated -snapshots directory.
 * Returns 200 even when the file was already gone (graceful idempotency),
 * with a `removed` flag indicating what was actually deleted.
 */
testsRouter.delete('/', async (req: Request, res: Response) => {
  const file = typeof req.query.file === 'string' ? req.query.file : '';
  const resolved = resolveTestFile(file);
  if ('error' in resolved) {
    res.status(resolved.status).json({ error: 'invalid_path', message: resolved.error });
    return;
  }

  try {
    const fileRemoved = await removeIfExists(resolved.absPath);
    const snapshotsRemoved = await removeIfExists(resolved.snapshotDir);
    res.json({
      ok: true,
      file: path.relative(FRAMEWORK_ROOT, resolved.absPath),
      fileRemoved,
      snapshotsRemoved,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'delete_failed', message });
  }
});

/**
 * PATCH /api/tests
 * Body: { file: 'tests/smoke/demo.smoke.ts', newName: 'login.smoke.ts' }
 * Renames the file (and its snapshot directory) within the same parent
 * directory. `newName` is the new basename only — no path components.
 */
testsRouter.patch('/', async (req: Request, res: Response) => {
  const { file, newName } = (req.body ?? {}) as { file?: string; newName?: string };
  const resolved = resolveTestFile(file ?? '');
  if ('error' in resolved) {
    res.status(resolved.status).json({ error: 'invalid_path', message: resolved.error });
    return;
  }

  if (!newName || typeof newName !== 'string') {
    res.status(400).json({ error: 'invalid_name', message: '`newName` is required' });
    return;
  }
  // newName must be a bare basename — disallow path separators & traversal.
  if (newName.includes('/') || newName.includes('\\') || newName.includes('..') || newName.startsWith('.')) {
    res.status(400).json({ error: 'invalid_name', message: 'newName must be a bare filename' });
    return;
  }
  const newExt = path.extname(newName);
  if (!TEST_EXTENSIONS.has(newExt)) {
    res.status(400).json({ error: 'invalid_name', message: `newName must end with a supported extension (got '${newExt}')` });
    return;
  }
  // Enforce Playwright's testMatch suffix so renamed files are still discovered.
  const stemWithSuffix = path.basename(newName, newExt);
  const ALLOWED_SUFFIXES = ['spec', 'test', 'smoke', 'regression', 'visual', 'api', 'ai-generated'];
  const hasValidSuffix = ALLOWED_SUFFIXES.some((s) => stemWithSuffix.endsWith(`.${s}`));
  if (!hasValidSuffix) {
    res.status(400).json({
      error: 'invalid_name',
      message: `newName must end with one of: ${ALLOWED_SUFFIXES.map((s) => `.${s}${newExt}`).join(', ')}`,
    });
    return;
  }

  const newAbsPath = path.join(resolved.dir, newName);
  if (newAbsPath === resolved.absPath) {
    res.json({ ok: true, file: path.relative(FRAMEWORK_ROOT, newAbsPath), unchanged: true });
    return;
  }

  // Collision check.
  try {
    await fs.access(newAbsPath);
    res.status(409).json({ error: 'name_taken', message: `${newName} already exists in ${path.relative(FRAMEWORK_ROOT, resolved.dir)}` });
    return;
  } catch {
    // Good — target doesn't exist.
  }

  try {
    await fs.rename(resolved.absPath, newAbsPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      res.status(404).json({ error: 'not_found', message: 'source file does not exist' });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'rename_failed', message });
    return;
  }

  // Rename the snapshot directory too, if it exists.
  const newBasename = path.basename(newName, newExt);
  const newSnapshotDir = path.join(resolved.dir, `${newBasename}-snapshots`);
  let snapshotsRenamed = false;
  try {
    await fs.rename(resolved.snapshotDir, newSnapshotDir);
    snapshotsRenamed = true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      // Don't fail the whole request — the .ts file was already renamed.
      console.warn('[tests] failed to rename snapshot dir:', err);
    }
  }

  res.json({
    ok: true,
    file: path.relative(FRAMEWORK_ROOT, newAbsPath),
    previous: path.relative(FRAMEWORK_ROOT, resolved.absPath),
    snapshotsRenamed,
  });
});
