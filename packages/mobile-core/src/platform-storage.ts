import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createWebStorageAdapter, type StorageAdapter } from "./storage";

type PlatformStorageOptions = {
  namespace: string;
  sessionKeys?: string[];
};

export function createPlatformStorageAdapter(options: PlatformStorageOptions): StorageAdapter {
  const { namespace, sessionKeys = [] } = options;

  if (Platform.OS === "web") {
    return createWebStorageAdapter({ namespace, sessionKeys });
  }

  const prefix = namespace ? `${namespace}.` : "";

  async function removeScopedKey(key: string) {
    await SecureStore.deleteItemAsync(`${prefix}${key}`);
  }

  return {
    get: (key) => SecureStore.getItemAsync(`${prefix}${key}`),
    set: (key, value) => SecureStore.setItemAsync(`${prefix}${key}`, value),
    remove: removeScopedKey,
    clearSession: async () => {
      await Promise.all(sessionKeys.map((key) => removeScopedKey(key)));
    },
  };
}
