/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        heading: ['IBM Plex Sans', 'sans-serif']
      }
    }
  },
  plugins: []
};
