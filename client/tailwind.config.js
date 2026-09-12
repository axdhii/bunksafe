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
        aurora: {
          bg: '#000000',
          surface: '#080808',
          card: '#0a0a0a',
          cardHover: '#121212',
          cardLight: '#ffffff',
          surfaceLight: '#f4f4f5',
          cyan: '#ffffff',       // Re-mapped to crisp stark white (eradicating neon blue)
          sky: '#e4e4e7',        // Zinc-200
          teal: '#d4d4d8',       // Zinc-300
          mint: '#10b981',       // Muted emerald for positive attendance status
          amber: '#f59e0b',      // Muted amber for warning
          ruby: '#ef4444',       // Muted ruby for critical
          violet: '#d4d4d8',     // Monochrome silver neutral
          lavender: '#e4e4e7',
        }
      },
      fontFamily: {
        sans: ['Agrandir', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        sub: ['Agrandir Grand Light', 'Agrandir Light', 'Agrandir', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -5px rgba(255, 255, 255, 0.15)',
        'glow-sky': '0 0 20px -5px rgba(255, 255, 255, 0.1)',
        'glow-mint': '0 0 20px -5px rgba(16, 185, 129, 0.15)',
        'glow-ruby': '0 0 20px -5px rgba(239, 68, 68, 0.15)',
        'glow-amber': '0 0 20px -5px rgba(245, 158, 11, 0.15)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
