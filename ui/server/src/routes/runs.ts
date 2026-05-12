import { Router, type Request, type Response } from 'express';
import { runRegistry } from '../runner/runRegistry.js';
import { startRun, cancelRun, type RunOptions } from '../runner/spawnRun.js';

export const runsRouter: Router = Router();

runsRouter.post('/', (req: Request, res: Response) => {
  if (runRegistry.hasActive()) {
    const active = runRegistry.getActive();
    res.status(409).json({
      error: 'run_already_active',
      activeRunId: active?.id ?? null,
    });
    return;
  }

  const body = (req.body ?? {}) as Partial<RunOptions>;
  const options: RunOptions = {
    grep: typeof body.grep === 'string' ? body.grep : undefined,
    project: typeof body.project === 'string' ? body.project : undefined,
    file: typeof body.file === 'string' ? body.file : undefined,
  };

  try {
    const started = startRun(options);
    res.status(201).json({
      runId: started.id,
      pid: started.pid,
      args: started.args,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'failed_to_start', message });
  }
});

runsRouter.get('/:id', (req: Request, res: Response) => {
  const record = runRegistry.get(String(req.params.id));
  if (!record) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  // Omit the full log buffer here — clients should use the WebSocket for
  // streaming. Returning logs would balloon the payload on long runs.
  const { logs: _logs, ...summary } = record;
  void _logs;
  res.json(summary);
});

runsRouter.post('/:id/cancel', (req: Request, res: Response) => {
  const ok = cancelRun(String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'not_found_or_inactive' });
    return;
  }
  res.json({ ok: true });
});
