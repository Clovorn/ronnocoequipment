/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        cream: {
          50:  '#fbf8f3',
          100: '#f5efe4',
          200: '#ebe1cf',
          300: '#dccbac',
        },
        ink: {
          900: '#1f160e',
          800: '#332217',
          700: '#4a3322',
          600: '#6b4d36',
          500: '#8f6e4f',
        },
        copper: {
          500: '#b8612a',
          600: '#9a4f20',
          700: '#7a3f1a',
        },
      },
      boxShadow: {
        soft: '0 1px 0 rgba(31, 22, 14, 0.04), 0 4px 12px -2px rgba(31, 22, 14, 0.06)',
        elevated: '0 2px 0 rgba(31, 22, 14, 0.06), 0 12px 32px -8px rgba(31, 22, 14, 0.18)',
      },
    },
  },
  plugins: [],
};
