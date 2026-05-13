import { useEffect, useRef } from 'react';
import type { LogEvent } from '../hooks/useRunStream';

interface TerminalProps {
  logs: LogEvent[];
  emptyMessage?: string;
}

export function Terminal({ logs, emptyMessage = 'Waiting for output…' }: TerminalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div
      ref={ref}
      className="bg-black/60 text-slate-200 font-mono text-xs leading-relaxed rounded-lg p-3 h-[28rem] overflow-y-auto whitespace-pre-wrap"
    >
      {logs.length === 0 ? (
        <span className="text-slate-600">{emptyMessage}</span>
      ) : (
        logs.map((chunk, i) => (
          <span key={i} className={chunk.stream === 'stderr' ? 'text-rose-400' : 'text-slate-300'}>
            {chunk.data}
          </span>
        ))
      )}
    </div>
  );
}
