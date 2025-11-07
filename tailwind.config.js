/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B4BFF',
          foreground: '#FFFFFF'
        },
        accent: '#00D1B2',
        background: '#0F172A',
        surface: '#111827'
      },
      boxShadow: {
        glass: '0 12px 48px rgba(15, 23, 42, 0.35)'
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
};
