import { create } from "zustand";

import { secureStorage } from "@/shared/lib/storage";

const ACCESS_KEY = "naro.access_token";
const REFRESH_KEY = "naro.refresh_token";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (access: string, refresh: string) => Promise<void>;
  clear: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  hydrate: async () => {
    const [access, refresh] = await Promise.all([
      secureStorage.get(ACCESS_KEY),
      secureStorage.get(REFRESH_KEY),
    ]);
    set({ accessToken: access, refreshToken: refresh, hydrated: true });
  },
  setTokens: async (access, refresh) => {
    await Promise.all([
      secureStorage.set(ACCESS_KEY, access),
      secureStorage.set(REFRESH_KEY, refresh),
    ]);
    set({ accessToken: access, refreshToken: refresh });
  },
  clear: async () => {
    await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]);
    set({ accessToken: null, refreshToken: null });
  },
}));
