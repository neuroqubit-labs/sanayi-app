const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const exclusionList = require("metro-config/src/defaults/exclusionList");

module.exports = function createExpoMetroConfig(projectRoot, options = {}) {
  const { nativeWindInput = "./global.css" } = options;
  const config = getDefaultConfig(projectRoot);

  config.resolver.unstable_enablePackageExports = true;

  // Monorepo: kardeş app'lerin route/app dizinlerini bu projenin bundle'ına dahil etme.
  const workspaceRoot = path.resolve(projectRoot, "..");
  const siblingApps = ["naro-app", "naro-service-app"].filter(
    (name) => path.resolve(workspaceRoot, name) !== projectRoot,
  );
  const blockPatterns = siblingApps.map(
    (name) =>
      new RegExp(
        `${path
          .resolve(workspaceRoot, name)
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/.*`,
      ),
  );
  if (blockPatterns.length > 0) {
    config.resolver.blockList = exclusionList(blockPatterns);
  }

  return withNativeWind(config, { input: nativeWindInput });
};
