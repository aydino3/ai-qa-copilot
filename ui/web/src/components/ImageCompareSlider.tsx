import { useCallback, useEffect, useRef, useState } from 'react';

interface ImageCompareSliderProps {
  /** "Before" — typically the baseline image */
  beforeSrc: string;
  /** "After" — typically the actual rendered image */
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Initial position of the divider as a 0–100 percentage. */
  initialPosition?: number;
  /** Magnifier radius in pixels. Set to 0 to disable. */
  magnifierSize?: number;
  /** Zoom factor for the magnifier. */
  magnifierZoom?: number;
}

/**
 * Two images stacked, with a draggable vertical divider revealing the
 * "after" image as the user drags right. Pointer-event based, so it
 * works with mouse, touch, and pen input. Optional hover magnifier
 * shows a circular zoom of whichever side the cursor is over.
 */
export function ImageCompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Baseline',
  afterLabel = 'Actual',
  initialPosition = 50,
  magnifierSize = 140,
  magnifierZoom = 2.25,
}: ImageCompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [mag, setMag] = useState<{ x: number; y: number; side: 'before' | 'after' } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const updatePositionFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  // Pointer move/up listeners are attached at window level only while dragging
  // so the user can drag outside the image bounds without losing the grab.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => updatePositionFromClientX(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, updatePositionFromClientX]);

  // Keyboard control for accessibility
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft')  { setPosition((p) => Math.max(0, p - step));   e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPosition((p) => Math.min(100, p + step)); e.preventDefault(); }
    if (e.key === 'Home')       { setPosition(0);   e.preventDefault(); }
    if (e.key === 'End')        { setPosition(100); e.preventDefault(); }
  }

  function onPointerDownHandle(e: React.PointerEvent) {
    setDragging(true);
    updatePositionFromClientX(e.clientX);
    e.preventDefault();
  }

  function onPointerMoveContainer(e: React.PointerEvent) {
    if (magnifierSize <= 0) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const side: 'before' | 'after' = x / rect.width * 100 <= position ? 'before' : 'after';
    setMag({ x, y, side });
  }

  function onPointerLeaveContainer() {
    setMag(null);
  }

  const beforeImageStyle: React.CSSProperties = {
    clipPath: `inset(0 ${100 - position}% 0 0)`,
    WebkitClipPath: `inset(0 ${100 - position}% 0 0)`,
  };

  // Build the magnifier background — same image, scaled, with the visible
  // area centred on the cursor position.
  function magnifierBg(): React.CSSProperties | null {
    if (!mag || !naturalSize || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = naturalSize.w / rect.width;
    const scaleY = naturalSize.h / rect.height;
    // Position the background image so the cursor point is centred in the lens
    const bgX = -mag.x * scaleX * magnifierZoom / scaleX + magnifierSize / 2;
    const bgY = -mag.y * scaleY * magnifierZoom / scaleY + magnifierSize / 2;
    return {
      backgroundImage: `url(${mag.side === 'before' ? beforeSrc : afterSrc})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${rect.width * magnifierZoom}px ${rect.height * magnifierZoom}px`,
      backgroundPosition: `${bgX}px ${bgY}px`,
    };
  }

  const bg = magnifierBg();

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        role="img"
        aria-label={`Comparison between ${beforeLabel} and ${afterLabel}. Use arrow keys to move the divider.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMoveContainer}
        onPointerLeave={onPointerLeaveContainer}
        className="relative w-full rounded-xl overflow-hidden border-2 border-white/[0.08] bg-[#0a0a10] select-none cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-brand-500/60"
        style={{ aspectRatio: naturalSize ? `${naturalSize.w} / ${naturalSize.h}` : '16 / 10' }}
      >
        {/* "After" image — full width baseline beneath */}
        <img
          src={afterSrc}
          alt={afterLabel}
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        {/* "Before" image — clipped on top */}
        <img
          src={beforeSrc}
          alt={beforeLabel}
          draggable={false}
          style={beforeImageStyle}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-[clip-path] duration-75"
        />

        {/* Labels — pinned to opposite corners so they remain visible regardless of slider position */}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 backdrop-blur-sm">
          {beforeLabel}
        </span>
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-rose-500/20 text-rose-200 border border-rose-500/40 backdrop-blur-sm">
          {afterLabel}
        </span>

        {/* Divider line + handle */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-white/80 via-brand-300 to-white/80 shadow-glow pointer-events-none"
          style={{ left: `calc(${position}% - 1px)` }}
        />
        <button
          type="button"
          onPointerDown={onPointerDownHandle}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-gradient-brand shadow-glow-lg border-2 border-white/90 flex items-center justify-center text-white font-bold cursor-ew-resize hover:scale-110 active:scale-95 transition-transform ${dragging ? 'scale-110' : ''}`}
          style={{ left: `${position}%` }}
          aria-label="Drag to compare images"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <path d="M5 1L1 7L5 13M13 1L17 7L13 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Hover magnifier — circular lens that follows the cursor */}
        {bg && mag && (
          <div
            className="pointer-events-none absolute rounded-full border-2 border-brand-300 shadow-glow-lg"
            style={{
              width: magnifierSize,
              height: magnifierSize,
              left: mag.x - magnifierSize / 2,
              top: mag.y - magnifierSize / 2,
              ...bg,
            }}
          >
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-slate-300 bg-surface-3/80 backdrop-blur px-2 py-0.5 rounded">
              {mag.side === 'before' ? beforeLabel : afterLabel} · {magnifierZoom.toFixed(1)}×
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>← drag handle, arrow keys, or click anywhere on the image →</span>
        <span className="font-mono tabular-nums">{Math.round(position)}% / 100%</span>
      </div>
    </div>
  );
}
