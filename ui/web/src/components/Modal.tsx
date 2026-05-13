import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, width = 'sm' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    width === 'xl' ? 'max-w-6xl' :
    width === 'lg' ? 'max-w-4xl' :
    width === 'md' ? 'max-w-lg' : 'max-w-sm';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className={`card ${widthClass} w-full mx-4 p-6 space-y-4 animate-slide-up shadow-glow`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
