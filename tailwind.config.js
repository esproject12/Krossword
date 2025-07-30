// PASTE THIS ENTIRE CODE BLOCK INTO tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{components,hooks,services,src}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // This creates our custom 'tall:' variant for screens 800px or taller
        'tall': { 'raw': '(min-height: 800px)' },
      },
    },
  },
  plugins: [],
}