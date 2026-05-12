import { Router, type Request, type Response } from 'express';
import { listTests } from '../utils/playwright.js';

export const testsRouter: Router = Router();

testsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const { tests, errors } = await listTests();
    res.json({ count: tests.length, tests, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'failed_to_list_tests', message });
  }
});
