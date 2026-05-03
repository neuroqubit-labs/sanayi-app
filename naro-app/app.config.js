const androidGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? "";
const iosGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? "";

// iOS PrivacyManifest (iOS 17+ zorunlu).
// Required Reason API'ler — Apple "C&P" listesinden kullandığımız kategoriler.
// Üçüncü taraf kütüphanelerin (Sentry, PostHog, react-native-maps) kendi
// xcprivacy dosyaları zaten bundle içinde gelir; burası Naro app-level beyanı.
const privacyManifests = {
  NSPrivacyTracking: false,
  NSPrivacyTrackingDomains: [],
  NSPrivacyCollectedDataTypes: [],
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
      NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
    },
    {
      NSPrivacyAccessedAPIType:
        "NSPrivacyAccessedAPICategoryFileTimestamp",
      NSPrivacyAccessedAPITypeReasons: ["C617.1"],
    },
    {
      NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
      NSPrivacyAccessedAPITypeReasons: ["E174.1"],
    },
    {
      NSPrivacyAccessedAPIType:
        "NSPrivacyAccessedAPICategorySystemBootTime",
      NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
    },
  ],
};

module.exports = {
  expo: {
    name: "Naro",
    slug: "naro-app",
    scheme: "naro",
    version: "1.0.0",
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    icon: "./assets/app-icons/light/appstore.png",
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.naro.app",
      associatedDomains: ["applinks:naro.com.tr"],
      config: {
        googleMapsApiKey: iosGoogleMapsApiKey,
      },
      icon: {
        light: "./assets/app-icons/light/appstore.png",
        dark: "./assets/app-icons/appstore.png",
      },
      privacyManifests,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/app-icons/light/playstore.png",
        backgroundColor: "#ffffff",
      },
      config: {
        googleMaps: {
          apiKey: androidGoogleMapsApiKey,
        },
      },
      package: "com.naro.app",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "naro.com.tr",
              pathPrefix: "/billing/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Naro, araç fotoğrafı ve hasar bildirimi için galerinize erişir.",
          cameraPermission:
            "Naro, araç fotoğrafı ve hasar bildirimi için kamerayı kullanır.",
        },
      ],
      "expo-document-picker",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Naro, çekici çağırırken alım konumunu seçmek için konumunuzu kullanır.",
        },
      ],
      [
        "expo-notifications",
        {
          // Android channel auto-create + iOS background mode init.
          // icon ve color için ileride markalı asset eklenir; şu an
          // expo-notifications default'larını kullanır.
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
