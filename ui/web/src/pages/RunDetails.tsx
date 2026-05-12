import { useParams } from 'react-router-dom';

export function RunDetails() {
  const { runId } = useParams<{ runId: string }>();
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Run details</h2>
      <div className="text-sm text-slate-400">
        Run ID: <code className="text-slate-200">{runId ?? '(none)'}</code>
      </div>
      <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/40 text-sm text-slate-500 font-mono whitespace-pre-wrap min-h-[12rem]">
        Placeholder — live WebSocket log stream and results panel attach here in
        Step 5.
      </div>
    </section>
  );
}
