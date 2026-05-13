import { useEffect, useRef, useState } from 'react';
import type { RunStatus } from '../api/client';

export interface LogEvent {
  stream: 'stdout' | 'stderr';
  data: string;
  ts: number;
}

export interface StepEvent {
  action: 'start' | 'end';
  title: string;
  status?: 'passed' | 'failed';
  error?: string | null;
  ts: number;
}

export interface RunStream {
  logs: LogEvent[];
  stepEvents: StepEvent[];
  status: RunStatus | null;
  exitCode: number | null;
  socketState: 'connecting' | 'open' | 'closed' | 'error';
}

interface ServerMessage {
  type: 'log' | 'status' | 'step' | 'error';
  stream?: 'stdout' | 'stderr';
  data?: string;
  status?: RunStatus;
  exitCode?: number | null;
  payload?: StepEvent;
  ts?: number;
}

export function useRunStream(runId: string | undefined): RunStream {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [stepEvents, setStepEvents] = useState<StepEvent[]>([]);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [socketState, setSocketState] = useState<RunStream['socketState']>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!runId) return;
    setLogs([]);
    setStepEvents([]);
    setStatus(null);
    setExitCode(null);
    setSocketState('connecting');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/runs/${encodeURIComponent(runId)}`);
    wsRef.current = ws;

    ws.onopen = () => setSocketState('open');
    ws.onerror = () => setSocketState('error');
    ws.onclose = () => setSocketState('closed');
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as ServerMessage;
      } catch { return; }

      if (msg.type === 'log' && msg.data && msg.stream && typeof msg.ts === 'number') {
        setLogs((prev) => [...prev, { stream: msg.stream!, data: msg.data!, ts: msg.ts! }]);
      } else if (msg.type === 'step' && msg.payload) {
        setStepEvents((prev) => [...prev, msg.payload!]);
      } else if (msg.type === 'status' && msg.status) {
        setStatus(msg.status);
        setExitCode(msg.exitCode ?? null);
      }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [runId]);

  return { logs, stepEvents, status, exitCode, socketState };
}
