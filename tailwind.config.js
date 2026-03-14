/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.ejs', './src/public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#fef3ee', 100: '#fde4d4', 200: '#fac5a8', 300: '#f6a070', 400: '#f17a42', 500: '#ec5a1c', 600: '#dd4212', 700: '#b73011', 800: '#922816', 900: '#762315' },
        accent: { 50: '#eef7ff', 100: '#d9ecff', 200: '#bcdfff', 300: '#8eccff', 400: '#58afff', 500: '#328dff', 600: '#1b6cf5', 700: '#1456e1', 800: '#1746b6', 900: '#193d8f' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
