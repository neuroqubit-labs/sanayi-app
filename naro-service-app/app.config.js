const androidGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? "";
const iosGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? "";

// iOS PrivacyManifest (iOS 17+ zorunlu).
// Required Reason API'ler — Apple "C&P" listesinden kullandığımız kategoriler.
// Her birinin "reasons" kodu Apple geliştirici dokümantasyonundan birebir
// alınır. Üçüncü taraf kütüphanelerin (Sentry, PostHog) kendi xcprivacy
// dosyaları zaten bundle içinde gelir; burası Naro app-level beyanıdır.
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
    name: "Naro Service",
    slug: "naro-service-app",
    scheme: "naroservice",
    version: "0.1.0",
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
      bundleIdentifier: "com.naro.service",
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
      package: "com.naro.service",
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
            "Naro Servis, iş kanıtı fotoğrafı yüklemek için galerinize erişir.",
          cameraPermission:
            "Naro Servis, iş kanıtı fotoğrafı çekmek için kamerayı kullanır.",
        },
      ],
      "expo-document-picker",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Naro Servis, çekici görevlerinde anlık konumunu paylaşmak için konumunu kullanır.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
