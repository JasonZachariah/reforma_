/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./hello.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#D643E3",
        secondary: "#FEDAF5",
        tertiary: "#FFEBFE",
        neutral: {
          100: "#F9F6F6",
          200: "#E6E3E3",
          300: "#CDC8C6",
          400: "#A09591",
          500: "#817671",
          600: "#675C58",
          700: "#504645",
          800: "#372828",
          900: "#181211",
        },
      },
    },
  },
  plugins: [],
}
