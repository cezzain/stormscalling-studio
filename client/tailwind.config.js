/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        column: 'var(--column)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        forest: 'var(--forest)',
        'forest-2': 'var(--forest-2)',
        sage: 'var(--sage)',
        tan: 'var(--tan)',
        clay: 'var(--clay)',
        'clay-2': 'var(--clay-2)',
        'clay-soft': 'var(--clay-soft)',
        's-draft': 'var(--s-draft)',
        's-revised': 'var(--s-revised)',
        's-done': 'var(--s-done)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        ui: 'var(--font-ui)',
      },
      boxShadow: {
        s: 'var(--shadow-s)',
        DEFAULT: 'var(--shadow)',
      },
      borderColor: {
        DEFAULT: 'var(--line)',
      },
      keyframes: {
        fadeup: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        panelin: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        overlayin: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        fadeup: 'fadeup .35s ease both',
        panelin: 'panelin .25s ease both',
        overlayin: 'overlayin .15s ease both',
      },
    },
  },
  plugins: [],
};
