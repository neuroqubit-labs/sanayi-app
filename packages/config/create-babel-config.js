module.exports = function createExpoBabelConfig() {
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Reanimated requires its Babel plugin to run last so worklets and
      // logger globals are transformed consistently across platforms.
      "react-native-reanimated/plugin",
    ],
  };
};
