const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;

const exclusionList = require("metro-config/src/defaults/exclusionList");
config.resolver.blockList = exclusionList([
  /.*\/naro-backend\/.*/,
  /.*\/legacy\/.*/,
  /.*\/docs\/.*/,
  /.*\/favicon_io\/.*/,
]);

module.exports = withNativeWind(config, { input: "./global.css" });
