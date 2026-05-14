/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f0ff',
          100: '#e0e0ff',
          200: '#c4c4ff',
          300: '#a29bfe',
          400: '#7c6fe8',
          500: '#6c63ff',
          600: '#5a52e0',
          700: '#4740c0',
          800: '#332fa0',
          900: '#1e1a80',
        },
        surface: {
          DEFAULT: '#0d0d14',
          1: '#111118',
          2: '#16161f',
          3: '#1c1c27',
          4: '#22222f',
          5: '#2a2a3a',
        },
        glow: {
          purple: 'rgba(108, 99, 255, 0.35)',
          cyan:   'rgba(34, 211, 238, 0.25)',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6c63ff 0%, #a29bfe 100%)',
        'gradient-danger': 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
        'gradient-success': 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(28,28,39,0.8) 0%, rgba(22,22,31,0.9) 100%)',
        'shimmer': 'linear-gradient(90deg, transparent 0%, rgba(108,99,255,0.08) 50%, transparent 100%)',
      },
      boxShadow: {
        'glow-sm':  '0 0 12px rgba(108, 99, 255, 0.25)',
        'glow':     '0 0 24px rgba(108, 99, 255, 0.35)',
        'glow-lg':  '0 0 48px rgba(108, 99, 255, 0.45)',
        'card':     '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.2)',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
      animation: {
        'glow-pulse':   'glow-pulse 2s ease-in-out infinite',
        'slide-up':     'slide-up 0.2s ease-out',
        'fade-in':      'fade-in 0.15s ease-out',
        'ring-pulse':   'ring-pulse 1.8s ease-out infinite',
        'count-up':     'count-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'status-pop':   'status-pop 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'donut-fill':   'donut-fill 1s cubic-bezier(0.65,0,0.35,1) forwards',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(108,99,255,0.2)' },
          '50%':       { boxShadow: '0 0 28px rgba(108,99,255,0.5)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'ring-pulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(108,99,255,0.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(108,99,255,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(108,99,255,0)' },
        },
        'count-up': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.95)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'status-pop': {
          '0%':   { opacity: '0', transform: 'scale(0.6)' },
          '60%':  { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'donut-fill': {
          from: { strokeDashoffset: 'var(--donut-circumference, 251.327)' },
          to:   { strokeDashoffset: 'var(--donut-offset, 0)' },
        },
      },
    },
  },
  plugins: [],
};
