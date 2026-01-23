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
        primary: "#D84315",
        secondary: "#FFAB91",
        tertiary: "#FBE9E7",
      },
    },
  },
  plugins: [],
}
