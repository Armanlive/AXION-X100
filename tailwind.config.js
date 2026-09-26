/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: {
          50: '#1e2638',
          100: '#171e2e',
          200: '#111726',
          300: '#0d121f',
          DEFAULT: '#111726',
        },
        border: {
          subtle: '#1d263b',
          DEFAULT: '#25324e',
          active: '#3b82f6',
        },
        brand: {
          primary: '#2563eb',
          hover: '#1d4ed8',
          accent: '#38bdf8',
        },
        status: {
          ready: '#10b981',
          working: '#3b82f6',
          understanding: '#f59e0b',
          listening: '#ef4444',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', 'Menlo', 'monospace'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
