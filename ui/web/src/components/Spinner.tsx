interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md';
}

export function Spinner({ label, size = 'sm' }: SpinnerProps) {
  const ring = size === 'sm'
    ? 'w-3.5 h-3.5 border-2'
    : 'w-5 h-5 border-2';
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span
        aria-hidden
        className={`inline-block rounded-full border-surface-4 border-t-brand-400 animate-spin ${ring}`}
      />
      {label && <span>{label}</span>}
    </div>
  );
}
