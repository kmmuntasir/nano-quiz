/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0eefe',
          200: '#baddfe',
          300: '#7cc4fd',
          400: '#36a6fa',
          500: '#0c8cf0',
          600: '#006cd4',
          700: '#0057ab',
          800: '#064a8d',
          900: '#0a3e74',
          950: '#07274b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        page: '1.5rem',
        card: '2rem',
      },
    },
  },
  plugins: [],
}