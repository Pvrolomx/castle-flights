/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        castle: {
          gold: '#C4A265',
          dark: '#1A1A2E',
          sand: '#F5F0EB',
          blue: '#0F3460',
        }
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
