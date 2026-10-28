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
        background: '#050508',
        surface: {
          50: '#162447',
          100: '#101b35',
          200: '#0c1326',
          300: '#080d1a',
          DEFAULT: '#080d1a',
        },
        border: {
          subtle: 'rgba(0, 240, 255, 0.12)',
          DEFAULT: 'rgba(0, 240, 255, 0.22)',
          active: 'rgba(0, 240, 255, 0.5)',
        },
        brand: {
          primary: '#00f0ff',
          hover: '#38bdf8',
          accent: '#00d2ff',
          neon: '#00f0ff',
          electric: '#38bdf8',
          deepDark: '#050508',
        },
        status: {
          ready: '#00f0ff',
          working: '#38bdf8',
          understanding: '#60a5fa',
          listening: '#00f0ff',
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
