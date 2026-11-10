/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aasc: {
          orange: '#EE7D1F',
          'orange-deep': '#E8641A',
          'orange-soft': '#F6A25B',
          blue: '#1A5A9A',
          'blue-light': '#2E7BC4',
          night: '#0B0F1A',
          ink: '#121826',
          steel: '#1C2435',
          line: '#2A3448',
        },
      },
      fontFamily: {
        display: ['"Exo 2"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(238,125,31,.35), 0 8px 30px -8px rgba(238,125,31,.45)',
        card: '0 10px 30px -12px rgba(0,0,0,.6)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        streak: { from: { transform: 'translateX(-30%) skewX(-24deg)' }, to: { transform: 'translateX(130%) skewX(-24deg)' } },
        flash: { '0%': { boxShadow: '0 0 0 0 rgba(238,125,31,.8)' }, '100%': { boxShadow: '0 0 0 24px rgba(238,125,31,0)' } },
        shuttle: { '0%,100%': { transform: 'translateY(0) rotate(-12deg)' }, '50%': { transform: 'translateY(-10px) rotate(12deg)' } },
      },
      animation: {
        rise: 'rise .35s ease-out both',
        streak: 'streak 2.4s ease-in-out infinite',
        flash: 'flash .8s ease-out',
        shuttle: 'shuttle 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
