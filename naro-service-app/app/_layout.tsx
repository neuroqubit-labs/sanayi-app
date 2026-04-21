import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";

import { HasarSourceSheet } from "@/features/insurance-claim";
import { TechnicianEvidenceUploadSheet } from "@/features/jobs/components/TechnicianEvidenceUploadSheet";
import { OfferSubmissionSheet } from "@/features/pool";
import { useInitializeRuntime } from "@/runtime";
import { queryClient } from "@/shared/lib/query";

export default function RootLayout() {
  useInitializeRuntime();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
          <OfferSubmissionSheet />
          <TechnicianEvidenceUploadSheet />
          <HasarSourceSheet />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
