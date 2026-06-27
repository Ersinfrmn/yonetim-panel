/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fff0f0',
          100: '#ffd6d6',
          200: '#ffadad',
          300: '#ff7070',
          400: '#e03535',
          500: '#b91c1c',
          600: '#991b1b',
          700: '#7f1d1d',
          800: '#6b1515',
          900: '#450a0a',
        },
        surface: {
          DEFAULT: '#0a0a0a',
          card:    '#111111',
          sidebar: '#0d0d0d',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          glow:   'rgba(185,28,28,0.4)',
        },
        ink: {
          primary:   '#ffffff',
          secondary: '#888888',
          muted:     '#444444',
        },
        status: {
          success: '#22C55E',
          error:   '#b91c1c',
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
