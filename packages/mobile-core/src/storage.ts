export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clearSession(): Promise<void>;
}

type WebStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type StorageAdapterOptions = {
  namespace: string;
  sessionKeys?: string[];
};

function createKeyPrefix(namespace: string) {
  return namespace ? `${namespace}.` : "";
}

export function createMemoryStorageAdapter(options: StorageAdapterOptions): StorageAdapter {
  const { namespace, sessionKeys = [] } = options;
  const store = new Map<string, string>();
  const prefix = createKeyPrefix(namespace);

  async function removeScopedKey(key: string) {
    store.delete(`${prefix}${key}`);
  }

  return {
    get: async (key) => store.get(`${prefix}${key}`) ?? null,
    set: async (key, value) => {
      store.set(`${prefix}${key}`, value);
    },
    remove: removeScopedKey,
    clearSession: async () => {
      await Promise.all(sessionKeys.map((key) => removeScopedKey(key)));
    },
  };
}

export function createWebStorageAdapter(
  options: StorageAdapterOptions & { storage?: WebStorageLike },
): StorageAdapter {
  const { namespace, sessionKeys = [] } = options;
  const memoryFallback = createMemoryStorageAdapter({ namespace, sessionKeys });
  const prefix = createKeyPrefix(namespace);

  // Web storage'ı her çağrıda resolve et. Önceki davranışta adapter
  // module init anında `globalThis.window?.localStorage`'a bakıyordu;
  // Expo Router web + statik/SSR benzeri erken render noktalarında
  // `window` henüz tanımlı değil → storage null kalıyor → hydrate
  // sonrası bile memoryFallback'e düşüyor (token yazılıyormuş gibi ama
  // reload'da kaybolur). Smoke report BUG 2 (2026-04-23).
  function resolveStorage(): WebStorageLike | undefined {
    if (options.storage) return options.storage;
    try {
      const webWindow = (
        globalThis as typeof globalThis & {
          window?: { localStorage?: WebStorageLike };
        }
      ).window;
      return webWindow?.localStorage;
    } catch {
      return undefined;
    }
  }

  async function removeScopedKey(key: string) {
    const storage = resolveStorage();
    if (!storage) {
      await memoryFallback.remove(key);
      return;
    }

    try {
      storage.removeItem(`${prefix}${key}`);
    } catch {
      await memoryFallback.remove(key);
    }
  }

  return {
    get: async (key) => {
      const storage = resolveStorage();
      if (!storage) {
        return memoryFallback.get(key);
      }

      try {
        return storage.getItem(`${prefix}${key}`);
      } catch {
        return memoryFallback.get(key);
      }
    },
    set: async (key, value) => {
      const storage = resolveStorage();
      if (!storage) {
        await memoryFallback.set(key, value);
        return;
      }

      try {
        storage.setItem(`${prefix}${key}`, value);
      } catch {
        await memoryFallback.set(key, value);
      }
    },
    remove: removeScopedKey,
    clearSession: async () => {
      await Promise.all(sessionKeys.map((key) => removeScopedKey(key)));
    },
  };
}
