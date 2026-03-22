import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'Be Vietnam Pro', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        brand: ['Satoshi', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: '#080808',
          secondary: '#0e0e0e',
          elevated: '#141414',
        },
        text: {
          primary: '#ffffff',
          secondary: '#cccccc',
          muted: '#666666',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.10)',
        },
        accent: {
          purple: '#a78bfa',
          blue: '#60a5fa',
          emerald: '#4ade80',
          amber: '#fbbf24',
          red: '#f87171',
        },
      },
      boxShadow: {
        card: '0 16px 48px rgba(0,0,0,0.5)',
        glow: '0 0 0 1px rgba(255,255,255,0.1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 250ms ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
