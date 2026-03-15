/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8f8f8',
          100: '#f0f0f0',
          200: '#e8e8e8',
          300: '#d0d0d0',
          800: '#1a1a1a',
          900: '#111111',
          950: '#0a0a0a'
        },
        accent: {
          purple: '#7c3aed',
          pink: '#ec4899',
          blue: '#3b82f6'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'sans-serif']
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
}
