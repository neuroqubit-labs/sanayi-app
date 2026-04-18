import { Redirect } from "expo-router";

import { useAuthStore } from "@/services/auth/store";

export default function Index() {
  const { accessToken, approvalStatus, hydrated } = useAuthStore();
  if (!hydrated) return null;
  if (!accessToken) return <Redirect href="/(auth)/login" />;
  if (approvalStatus === "pending") return <Redirect href="/(onboarding)/pending" />;
  return <Redirect href="/(tabs)" />;
}
