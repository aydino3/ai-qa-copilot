import express from 'express';
import cors from 'cors';
import { PORT, FRAMEWORK_ROOT } from './config.js';
import { testsRouter } from './routes/tests.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, frameworkRoot: FRAMEWORK_ROOT });
});

app.use('/api/tests', testsRouter);

app.listen(PORT, () => {
  console.log(`[ui-server] listening on http://localhost:${PORT}`);
  console.log(`[ui-server] framework root: ${FRAMEWORK_ROOT}`);
});
