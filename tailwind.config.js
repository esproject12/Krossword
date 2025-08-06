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
        'tall': { 'raw': '(min-height: 740px)' },
      },
       // --- ADD THESE TWO NEW BLOCKS ---
      keyframes: {
        pop: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' }, // Made the pop a bit bigger
        }
      },
      animation: {
        pop: 'pop 0.2s ease-out',
      }
    },
  },
  plugins: [],
}