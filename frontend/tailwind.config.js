/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary = Deep Teal (#648381)
        primary: {
          50:  '#eef5f4',
          100: '#d7e6e4',
          200: '#b4cfcd',
          300: '#a3c7c5',
          400: '#86b3b0',
          500: '#648381',
          600: '#557572',
          700: '#46605e',
          800: '#3a4f4e',
          900: '#304140',
          950: '#1c2625',
        },
        // Dark surfaces tinted toward Charcoal (#575761)
        surface: {
          DEFAULT: '#2a2a31',
          card:    '#34343d',
          border:  '#474751',
          hover:   '#3e3e48',
        },
        success: '#8ACB88',  // Willow Green
        warning: '#FFBF46',  // Sunflower Gold
        danger:  '#e2655f',  // soft red (no red in palette; kept for delete/reject)
        info:    '#7fb0ac',  // light teal
        // Raw palette swatches for direct use
        mint:    '#E4FDE1',  // Frosted Mint
        willow:  '#8ACB88',  // Willow Green
        teal:    '#648381',  // Deep Teal
        charcoal:'#575761',  // Charcoal
        gold:    '#FFBF46',  // Sunflower Gold
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
