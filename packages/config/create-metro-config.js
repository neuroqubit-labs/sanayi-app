const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

module.exports = function createExpoMetroConfig(projectRoot, options = {}) {
  const { nativeWindInput = "./global.css" } = options;
  const config = getDefaultConfig(projectRoot);

  config.resolver.unstable_enablePackageExports = true;

  return withNativeWind(config, { input: nativeWindInput });
};
