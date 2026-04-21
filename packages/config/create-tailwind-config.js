module.exports = function createTailwindConfig(options) {
  const { brandColors } = options;

  return {
    content: [
      "./app/**/*.{js,jsx,ts,tsx}",
      "./src/**/*.{js,jsx,ts,tsx}",
      "../packages/ui/src/**/*.{js,jsx,ts,tsx}",
    ],
    darkMode: "class",
    presets: [require("./tailwind.preset")],
    theme: {
      extend: {
        colors: {
          brand: brandColors,
          app: {
            bg: "#060915",
            "bg-muted": "#0d1324",
            surface: "#11182a",
            "surface-2": "#182138",
            "surface-3": "#223154",
            outline: "#26344f",
            "outline-strong": "#3a527d",
            text: "#f5f7ff",
            "text-muted": "#acb7d2",
            "text-subtle": "#6f7b97",
            success: "#2dd28d",
            "success-soft": "#143526",
            warning: "#f5b33f",
            "warning-soft": "#3f2b0b",
            critical: "#ff6b6b",
            "critical-soft": "#441a20",
            info: "#83a7ff",
            "info-soft": "#1b2850",
          },
        },
        boxShadow: {
          shell: "0px 24px 60px rgba(2, 8, 23, 0.42)",
          floating: "0px 16px 44px rgba(14, 165, 233, 0.28)",
          soft: "0px 10px 24px rgba(2, 8, 23, 0.24)",
        },
        transitionDuration: {
          120: "120ms",
          180: "180ms",
          240: "240ms",
          320: "320ms",
        },
      },
    },
    plugins: [],
  };
};
