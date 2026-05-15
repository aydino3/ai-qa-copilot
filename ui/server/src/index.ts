import http from 'node:http';
import * as path from 'node:path';
import express from 'express';
import cors from 'cors';
import { PORT, FRAMEWORK_ROOT, TEST_RESULTS_DIR } from './config.js';
import { testsRouter } from './routes/tests.js';
import { runsRouter } from './routes/runs.js';
import { configRouter } from './routes/config.js';
import { attachLogSocket } from './ws/logSocket.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, frameworkRoot: FRAMEWORK_ROOT });
});

// Serve Playwright artifacts (screenshots, videos, traces, snapshot baselines)
// so the frontend can embed them directly via URL.
app.use('/test-results', express.static(TEST_RESULTS_DIR));
app.use('/tests', express.static(path.join(FRAMEWORK_ROOT, 'tests')));

app.use('/api/tests', testsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/config', configRouter);

const server = http.createServer(app);
attachLogSocket(server);

server.listen(PORT, () => {
  console.log(`[ui-server] listening on http://localhost:${PORT}`);
  console.log(`[ui-server] framework root: ${FRAMEWORK_ROOT}`);
});
