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
        // Naro müşteri brand palette — mavi
        brand: {
          50: "#f0f9ff",
          500: "#0ea5e9",
          600: "#0284c7",
          900: "#0c4a6e",
        },
      },
    },
  },
  plugins: [],
};
