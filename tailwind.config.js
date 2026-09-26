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
        background: '#0b0b0c',
        surface: {
          50: '#27272a',
          100: '#1f1f23',
          200: '#18181b',
          300: '#141416',
          DEFAULT: '#141416',
        },
        border: {
          subtle: '#1f1f23',
          DEFAULT: '#27272a',
          active: '#3f3f46',
        },
        brand: {
          primary: '#3b82f6',
          hover: '#2563eb',
          accent: '#06b6d4',
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
