import { NaroThemeProvider, useNaroTheme } from "@naro/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";

import { HasarSourceSheet } from "@/features/insurance-claim";
import { TechnicianEvidenceUploadSheet } from "@/features/jobs/components/TechnicianEvidenceUploadSheet";
import { OfferSubmissionSheet } from "@/features/pool";
import { useDispatchTakeover } from "@/features/tow";
import { useAuthStore, useInitializeRuntime } from "@/runtime";
import { queryClient } from "@/shared/lib/query";

/**
 * Global auth guard — refresh fail sonrası bootstrapState "anonymous"a
 * dönünce tech app kullanıcısını (auth) altına zorlar. Mevcut app/
 * index.tsx yalnız ilk mount'ta redirect eder; runtime token expire
 * için bu guard şart.
 */
function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const bootstrapState = useAuthStore((s) => s.bootstrapState);

  useEffect(() => {
    if (bootstrapState !== "anonymous") return;
    const current = segments[0] ?? "";
    if (current === "(auth)" || current === "(onboarding)") return;
    router.replace("/(auth)/login");
  }, [bootstrapState, segments, router]);

  return null;
}

function RootShellContent() {
  useInitializeRuntime();
  useDispatchTakeover();
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
      <OfferSubmissionSheet />
      <TechnicianEvidenceUploadSheet />
      <HasarSourceSheet />
    </>
  );
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
