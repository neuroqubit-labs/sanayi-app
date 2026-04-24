module.exports = function createTailwindConfig(options) {
  const { brandColors } = options;
  const appColor = (name) => `var(--${name})`;

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
            bg: appColor("app-bg"),
            "bg-muted": appColor("app-bg-muted"),
            surface: appColor("app-surface"),
            "surface-2": appColor("app-surface-2"),
            "surface-3": appColor("app-surface-3"),
            outline: appColor("app-outline"),
            "outline-strong": appColor("app-outline-strong"),
            text: appColor("app-text"),
            "text-muted": appColor("app-text-muted"),
            "text-subtle": appColor("app-text-subtle"),
            success: appColor("app-success"),
            "success-soft": appColor("app-success-soft"),
            warning: appColor("app-warning"),
            "warning-soft": appColor("app-warning-soft"),
            critical: appColor("app-critical"),
            "critical-soft": appColor("app-critical-soft"),
            info: appColor("app-info"),
            "info-soft": appColor("app-info-soft"),
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
