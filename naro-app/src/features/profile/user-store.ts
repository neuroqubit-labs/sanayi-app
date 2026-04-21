import { create } from "zustand";

export type UserProfileField = "name" | "phone" | "email";

type UserProfileState = {
  name: string;
  phone: string;
  email: string;
  setField: (key: UserProfileField, value: string) => void;
};

export const useUserProfileStore = create<UserProfileState>((set) => ({
  name: "Alfonso Rivera",
  phone: "+90 532 000 00 00",
  email: "alfonso@naro.app",
  setField: (key, value) => set({ [key]: value } as Pick<UserProfileState, UserProfileField>),
}));
