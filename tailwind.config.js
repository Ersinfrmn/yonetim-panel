/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0eeff',
          100: '#e0ddff',
          200: '#c4baff',
          300: '#a593ff',
          400: '#8b6dff',
          500: '#6C3FE8',
          600: '#5a32c4',
          700: '#4826a0',
          800: '#361b7c',
          900: '#241158',
        },
        surface: {
          DEFAULT: '#080810',
          card:    '#111128',
          sidebar: '#0D0D1A',
        },
        border: {
          subtle: 'rgba(108,63,232,0.15)',
          glow:   'rgba(139,92,246,0.4)',
        },
        ink: {
          primary:   '#F0F0FF',
          secondary: '#6B6B8A',
          muted:     '#3D3D5C',
        },
        status: {
          success: '#22C55E',
          error:   '#EF4444',
          warning: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
