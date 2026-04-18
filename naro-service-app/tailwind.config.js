/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("@naro/config/tailwind.preset")],
  theme: {
    extend: {
      colors: {
        // Naro servis brand palette — turuncu
        brand: {
          50: "#fef3f2",
          500: "#ef6c4a",
          600: "#d94a1f",
          900: "#7f2910",
        },
      },
    },
  },
  plugins: [],
};
