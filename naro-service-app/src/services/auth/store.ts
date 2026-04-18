import { create } from "zustand";

import { IS_MOCK_AUTH, MOCK_APPROVAL } from "@/shared/lib/mock";
import { secureStorage } from "@/shared/lib/storage";

const ACCESS_KEY = "naro_service.access_token";
const REFRESH_KEY = "naro_service.refresh_token";

const MOCK_ACCESS_TOKEN = "mock-access-token-technician";
const MOCK_REFRESH_TOKEN = "mock-refresh-token-technician";

type ApprovalStatus = "pending" | "active" | "suspended";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  approvalStatus: ApprovalStatus | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setApprovalStatus: (status: ApprovalStatus) => void;
  clear: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  approvalStatus: null,
  hydrated: false,
  hydrate: async () => {
    const [access, refresh] = await Promise.all([
      secureStorage.get(ACCESS_KEY),
      secureStorage.get(REFRESH_KEY),
    ]);
    if (!access && !refresh && IS_MOCK_AUTH) {
      set({
        accessToken: MOCK_ACCESS_TOKEN,
        refreshToken: MOCK_REFRESH_TOKEN,
        approvalStatus: MOCK_APPROVAL,
        hydrated: true,
      });
      return;
    }
    set({ accessToken: access, refreshToken: refresh, hydrated: true });
  },
  setTokens: async (access, refresh) => {
    await Promise.all([
      secureStorage.set(ACCESS_KEY, access),
      secureStorage.set(REFRESH_KEY, refresh),
    ]);
    set({ accessToken: access, refreshToken: refresh });
  },
  setApprovalStatus: (status) => set({ approvalStatus: status }),
  clear: async () => {
    await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]);
    set({ accessToken: null, refreshToken: null, approvalStatus: null });
  },
}));
