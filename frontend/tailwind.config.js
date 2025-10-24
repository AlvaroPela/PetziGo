/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        petzi: {
          DEFAULT: '#6B21A8', /* purple brand */
          50: '#F6F0FB',
          100: '#EEE3FA',
          200: '#D6BFF4',
          300: '#BF9BEE',
          400: '#A66FE0',
          500: '#8B46D1',
          600: '#6B21A8',
          700: '#501885',
          800: '#3a1059',
        },
        petziYellow: '#FEF3C7'
      }
    }
  },
  plugins: [],
};