/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Service tarafı için ayrı palette — brand tutarlı, aksan farklı
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
