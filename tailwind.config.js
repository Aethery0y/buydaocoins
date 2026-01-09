/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dao: {
          primary: '#ffd700',
          dark: '#1a1a2e',
          darker: '#0f0f1a',
          accent: '#9d4edd',
        },
      },
    },
  },
  plugins: [],
}
