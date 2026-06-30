/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        fieldguide: {
          50: '#eff6ff',
          500: '#3b82f6',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Consolas"', 'monospace'],
      },
    },
  },
  plugins: [],
}
