import type { User, UserRole } from "@naro/domain";
import { create } from "zustand";

/**
 * Kullanıcının kimlik bilgilerini (read + optimistic edit) tutar.
 * Hydrate kaynağı: `useMe()` hook'u `/users/me` sonucunu buraya yazar.
 *
 * Register akışı gelince (docs/audits/2026-04-24-register-login-schema-alignment.md)
 * `setField` çağrısı ardı sıra PATCH /users/me'ye dönüştürülür — hook bunu
 * `useUpdateMe` mutation'ı üzerinden halleder.
 */

export type UserProfileField = "fullName" | "phone" | "email";

type UserProfileState = {
  id: string | null;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole | null;
  locale: string;
  avatarAssetId: string | null;
  hydrated: boolean;
  setField: (key: UserProfileField, value: string) => void;
  hydrate: (user: User) => void;
  reset: () => void;
};

const INITIAL: Omit<UserProfileState, "setField" | "hydrate" | "reset"> = {
  id: null,
  fullName: "",
  phone: "",
  email: "",
  role: null,
  locale: "tr-TR",
  avatarAssetId: null,
  hydrated: false,
};

export const useUserProfileStore = create<UserProfileState>((set) => ({
  ...INITIAL,
  setField: (key, value) =>
    set((state) => ({ ...state, [key]: value })),
  hydrate: (user) =>
    set({
      id: user.id,
      fullName: user.full_name ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      role: user.role,
      locale: user.locale,
      avatarAssetId: user.avatar_asset_id ?? null,
      hydrated: true,
    }),
  reset: () => set({ ...INITIAL }),
}));
