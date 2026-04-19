module.exports = function createTailwindConfig(options) {
  const { brandColors } = options;

  return {
    content: [
      "./app/**/*.{js,jsx,ts,tsx}",
      "./src/**/*.{js,jsx,ts,tsx}",
      "../packages/ui/src/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("./tailwind.preset")],
    theme: {
      extend: {
        colors: {
          brand: brandColors,
        },
      },
    },
    plugins: [],
  };
};
