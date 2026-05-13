import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { runRegistry, type RunRecord, type StepPayload } from '../runner/runRegistry.js';

interface WsMessage {
  type: 'log' | 'status' | 'step' | 'error';
  stream?: 'stdout' | 'stderr';
  data?: string;
  status?: RunRecord['status'];
  exitCode?: number | null;
  payload?: StepPayload;
  ts?: number;
}

const RUN_WS_PATH = /^\/ws\/runs\/([\w-]+)$/;

export function attachLogSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const subscribers = new Map<string, Set<WebSocket>>();

  const addSubscriber = (runId: string, ws: WebSocket) => {
    let set = subscribers.get(runId);
    if (!set) { set = new Set(); subscribers.set(runId, set); }
    set.add(ws);
  };

  const removeSubscriber = (runId: string, ws: WebSocket) => {
    const set = subscribers.get(runId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) subscribers.delete(runId);
  };

  const broadcast = (runId: string, payload: WsMessage, closeAfter = false) => {
    const set = subscribers.get(runId);
    if (!set) return;
    const json = JSON.stringify(payload);
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(json);
        if (closeAfter) ws.close();
      }
    }
  };

  runRegistry.on('log', ({ runId, chunk }: { runId: string; chunk: { stream: 'stdout' | 'stderr'; data: string; ts: number } }) => {
    broadcast(runId, { type: 'log', stream: chunk.stream, data: chunk.data, ts: chunk.ts });
  });

  runRegistry.on('step', ({ runId, payload }: { runId: string; payload: StepPayload }) => {
    broadcast(runId, { type: 'step', payload, ts: payload.ts });
  });

  runRegistry.on('status', (record: RunRecord) => {
    const terminal = record.status !== 'running';
    broadcast(record.id, { type: 'status', status: record.status, exitCode: record.exitCode, ts: Date.now() }, terminal);
  });

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = req.url ?? '';
    const match = RUN_WS_PATH.exec(url);
    if (!match) { socket.destroy(); return; }
    const runId = match[1] ?? '';
    if (!runId) { socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const record = runRegistry.get(runId);
      if (!record) {
        ws.send(JSON.stringify({ type: 'error', data: 'run_not_found' } satisfies WsMessage));
        ws.close();
        return;
      }

      // Replay buffered history: interleave logs and steps in arrival order
      // using the ts field so the client sees a coherent timeline.
      type Replayable =
        | { kind: 'log'; ts: number; stream: 'stdout' | 'stderr'; data: string }
        | { kind: 'step'; ts: number; payload: StepPayload };
      const events: Replayable[] = [
        ...record.logs.map((c) => ({ kind: 'log' as const, ts: c.ts, stream: c.stream, data: c.data })),
        ...record.steps.map((s) => ({ kind: 'step' as const, ts: s.ts, payload: s })),
      ];
      events.sort((a, b) => a.ts - b.ts);
      for (const ev of events) {
        if (ev.kind === 'log') {
          ws.send(JSON.stringify({ type: 'log', stream: ev.stream, data: ev.data, ts: ev.ts } satisfies WsMessage));
        } else {
          ws.send(JSON.stringify({ type: 'step', payload: ev.payload, ts: ev.ts } satisfies WsMessage));
        }
      }

      ws.send(JSON.stringify({ type: 'status', status: record.status, exitCode: record.exitCode, ts: Date.now() } satisfies WsMessage));

      if (record.status !== 'running') { ws.close(); return; }

      addSubscriber(runId, ws);
      ws.on('close', () => removeSubscriber(runId, ws));
    });
  });
}
