import { Redirect } from "expo-router";

import { useAuthStore } from "@/services/auth/store";

export default function Index() {
  const { accessToken, hydrated } = useAuthStore();
  if (!hydrated) return null;
  return <Redirect href={accessToken ? "/(tabs)" : "/(auth)/login"} />;
}
