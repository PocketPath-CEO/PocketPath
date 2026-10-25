/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f8',
          100: '#d8e0ee',
          200: '#b0c0dd',
          300: '#7e93c4',
          400: '#526ca8',
          500: '#384f8c',
          600: '#283c70',
          700: '#1d2d56',
          800: '#152243',
          900: '#0e1834',
          950: '#080d20',
        },
        mint: {
          50: '#effdf6',
          100: '#d8fbe9',
          200: '#b3f5d6',
          300: '#79eaba',
          400: '#3dd699',
          500: '#18bd7c',
          600: '#0c9964',
          700: '#0a7853',
          800: '#0b5e44',
          900: '#0a4d39',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(14,24,52,0.06), 0 4px 16px rgba(14,24,52,0.04)',
        cardHover: '0 2px 6px rgba(14,24,52,0.08), 0 8px 24px rgba(14,24,52,0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
