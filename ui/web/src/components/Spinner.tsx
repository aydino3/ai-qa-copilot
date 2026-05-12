interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span
        aria-hidden
        className="inline-block w-4 h-4 rounded-full border-2 border-slate-600 border-t-sky-400 animate-spin"
      />
      {label && <span>{label}</span>}
    </div>
  );
}
