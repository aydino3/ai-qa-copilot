import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { PORT, FRAMEWORK_ROOT } from './config.js';
import { testsRouter } from './routes/tests.js';
import { runsRouter } from './routes/runs.js';
import { configRouter } from './routes/config.js';
import { generateTestRouter } from './routes/generateTest.js';
import { visualInspectRouter } from './routes/visual-inspect.js';
import { attachLogSocket } from './ws/logSocket.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, frameworkRoot: FRAMEWORK_ROOT });
});

app.use('/api/tests', testsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/config', configRouter);
app.use('/api/generate-test', generateTestRouter);
app.use('/api/visual-inspect', visualInspectRouter);

const server = http.createServer(app);
attachLogSocket(server);

server.listen(PORT, () => {
  console.log(`[ui-server] listening on http://localhost:${PORT}`);
  console.log(`[ui-server] framework root: ${FRAMEWORK_ROOT}`);
});
