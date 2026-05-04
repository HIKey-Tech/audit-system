import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#008751',
          50: '#E5F3EC',
          100: '#BEE4CE',
          200: '#81C7A1',
          300: '#48AB78',
          400: '#219859',
          500: '#008751',
          600: '#007345',
          700: '#005C37',
          800: '#00452A',
          900: '#003823',
        },
        accent: {
          DEFAULT: '#00A651',
          50: '#E5F6EC',
          100: '#B8E5C8',
          200: '#7FCF9F',
          300: '#46B976',
          400: '#1DAB60',
          500: '#00A651',
          600: '#008F46',
          700: '#007339',
          800: '#005C2D',
          900: '#004621',
        },
        surface: {
          DEFAULT: '#F5F7FA',
          elevated: '#FFFFFF',
          alt: '#F8FAFC',
          hover: '#EFF6FF',
        },
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        text: {
          primary: '#1A202C',
          secondary: '#64748B',
          muted: '#94A3B8',
          inverse: '#FFFFFF',
        },
        danger: '#DC2626',
        warning: '#D97706',
        success: '#16A34A',
        info: '#2563EB',
        purple: '#7C3AED',
        orange: '#EA580C',
        yellow: '#CA8A04',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        sidebar: '2px 0 8px rgba(0,0,0,0.04)',
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '64px',
        header: '64px',
      },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
