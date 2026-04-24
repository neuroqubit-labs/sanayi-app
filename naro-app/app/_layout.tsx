import { NaroThemeProvider, useNaroTheme } from "@naro/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";

import { UstaPreviewSheet } from "@/features/ustalar";
import { VehicleSwitcherSheet } from "@/features/vehicles";
import { useAuthStore, useInitializeRuntime } from "@/runtime";
import { queryClient } from "@/shared/lib/query";

/**
 * Global auth guard — token refresh fail sonrası `setSession({null,null})`
 * çağrıldığında bootstrapState "anonymous"a döner. Kullanıcı tabs veya
 * başka auth-gerektiren rotada ise login'e zorla yönlendirilir.
 *
 * Mevcut app/index.tsx yalnızca ilk mount'ta yönlendirir; token runtime'da
 * expire olursa app o ekrana kilitli kalırdı — bu bileşen bunu çözer.
 */
function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const bootstrapState = useAuthStore((s) => s.bootstrapState);

  useEffect(() => {
    if (bootstrapState !== "anonymous") return;
    const current = segments[0] ?? "";
    // (auth) altında değilse login'e zorla
    if (current === "(auth)") return;
    router.replace("/(auth)/login");
  }, [bootstrapState, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NaroThemeProvider>
            <RootShellContent />
          </NaroThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootShellContent() {
  useInitializeRuntime();
  const { colors } = useNaroTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <>
      <StatusBar style={colors.statusBarStyle} />
      <AuthGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <VehicleSwitcherSheet />
      <UstaPreviewSheet />
    </>
  );
}
