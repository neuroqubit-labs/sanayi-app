import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";

import { HasarSourceSheet } from "@/features/insurance-claim";
import { TechnicianEvidenceUploadSheet } from "@/features/jobs/components/TechnicianEvidenceUploadSheet";
import { OfferSubmissionSheet } from "@/features/pool";
import { useDispatchTakeover } from "@/features/tow";
import { useInitializeRuntime } from "@/runtime";
import { queryClient } from "@/shared/lib/query";

function RootShellContent() {
  useInitializeRuntime();
  useDispatchTakeover();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
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
          <StatusBar style="auto" />
          <RootShellContent />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
