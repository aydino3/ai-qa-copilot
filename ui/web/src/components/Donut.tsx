import { useLayoutEffect, useState } from 'react';

interface DonutProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  /** Tailwind colour class for the progress ring, e.g. text-emerald-400. */
  colorClass?: string;
  trackClass?: string;
  /** Content rendered in the centre. Defaults to a formatted percentage. */
  label?: React.ReactNode;
  sublabel?: string;
}

export function Donut({
  value,
  max = 100,
  size = 96,
  stroke = 8,
  colorClass = 'text-emerald-400',
  trackClass = 'text-white/[0.06]',
  label,
  sublabel,
}: DonutProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeMax = max > 0 ? max : 1;
  const target = Math.max(0, Math.min(1, value / safeMax));

  const [pct, setPct] = useState(0);
  useLayoutEffect(() => {
    // Double rAF ensures the browser has painted before we trigger the CSS transition.
    let id1: number;
    const id2 = window.requestAnimationFrame(() => {
      id1 = window.requestAnimationFrame(() => setPct(target));
    });
    return () => { window.cancelAnimationFrame(id2); window.cancelAnimationFrame(id1); };
  }, [target]);

  const offset = circumference * (1 - pct);
  const displayPct = Math.round(target * 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClass}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={`${colorClass} transition-[stroke-dashoffset] duration-700 ease-out`}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white tabular-nums leading-none">
          {label ?? `${displayPct}%`}
        </span>
        {sublabel && (
          <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
