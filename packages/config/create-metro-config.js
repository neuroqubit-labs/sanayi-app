const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const exclusionList = require("metro-config/src/defaults/exclusionList");
const FileStore = require("metro-cache/src/stores/FileStore");

module.exports = function createExpoMetroConfig(projectRoot, options = {}) {
  const { nativeWindInput = "./global.css" } = options;
  const config = getDefaultConfig(projectRoot);

  config.resolver.unstable_enablePackageExports = true;

  // Cache'i proje başına izole et. Önceki davranışta monorepo'da paralel
  // çalışan iki app (naro-app + naro-service-app) `/tmp/metro-cache`'i
  // paylaştığından, shared node_modules dosyaları (`@expo/metro-runtime`
  // içinde `process.env.EXPO_PROJECT_ROOT` inline edilir) ilk bundle'layanın
  // projectRoot'u ile babel-transform edilir; ikinci app cache'ten okurken
  // yanlış projectRoot alır → expo-router `app/` dizinini bulamaz →
  // default "Welcome to Expo" unmatched screen render edilir (smoke
  // report BUG 1, 2026-04-23).
  config.cacheStores = [
    new FileStore({
      root: path.join(projectRoot, "node_modules", ".cache", "metro"),
    }),
  ];

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
