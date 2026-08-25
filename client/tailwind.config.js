/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        teal: {
          50: 'rgb(var(--tw-color-teal-50, 240 253 250) / <alpha-value>)',
          100: 'rgb(var(--tw-color-teal-100, 204 251 241) / <alpha-value>)',
          200: 'rgb(var(--tw-color-teal-200, 153 246 228) / <alpha-value>)',
          300: 'rgb(var(--tw-color-teal-300, 94 234 212) / <alpha-value>)',
          400: 'rgb(var(--tw-color-teal-400, 45 212 191) / <alpha-value>)',
          500: 'rgb(var(--tw-color-teal-500, 20 184 166) / <alpha-value>)',
          600: 'rgb(var(--tw-color-teal-600, 13 148 136) / <alpha-value>)',
          700: 'rgb(var(--tw-color-teal-700, 15 118 110) / <alpha-value>)',
          800: 'rgb(var(--tw-color-teal-800, 17 94 89) / <alpha-value>)',
          900: 'rgb(var(--tw-color-teal-900, 19 78 74) / <alpha-value>)',
          950: 'rgb(var(--tw-color-teal-950, 4 47 46) / <alpha-value>)',
        },
        surface: '#F8F9FF',
        'on-surface': '#0B1C30',
        'surface-container-low': '#EFF4FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem', // 4px
        sm: '0.125rem',     // 2px
        md: '0.25rem',      // 4px
        lg: '0.5rem',       // 8px
        xl: '0.75rem',      // 12px
        full: '9999px',
      },
      // Escala de elevação usada em toda a aplicação. `xs`/`2xs` já eram
      // referenciadas no código, mas não existiam no Tailwind 3 e eram
      // silenciosamente ignoradas — deixando cards e barras totalmente planos.
      boxShadow: {
        '2xs': '0 1px 1px 0 rgb(15 23 42 / 0.04)',
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
      },
      blur: {
        xs: '2px',
      },
      borderWidth: {
        3: '3px',
      },
      width: {
        sidebar: '260px',
      },
      maxWidth: {
        app: '1440px',
      },
      keyframes: {
        'overlay-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'panel-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'overlay-in': 'overlay-in 150ms ease-out',
        'panel-in': 'panel-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};
