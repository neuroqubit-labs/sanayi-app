import { BrandWaitState } from "@naro/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Clock } from "lucide-react-native";

import { useShellConfig } from "@/features/shell/useShellConfig";
import { useAuthStore } from "@/services/auth/store";

export default function PendingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const shell = useShellConfig();

  // Pending ekranı iki durumu kapsar:
  //   1. Profile + tüm zorunlu cert'ler var, admin onayı bekleniyor
  //      → required_onboarding_steps boş, sadece bekle/yenile CTA
  //   2. Eksik belge/adım var (revision_needed veya bootstrap yarım kaldı)
  //      → required_onboarding_steps dolu, kullanıcıyı uygun ekrana yönlendir
  const hasMissingSteps = shell.required_onboarding_steps.length > 0;

  async function onLogout() {
    await clear();
    router.replace("/(auth)/login");
  }

  function onRefresh() {
    // Hydrate query'lerini invalidate — useTechnicianProfileHydrator
    // root shell'de yeniden fetch eder, store yeni cert/approval status
    // ile güncellenir.
    queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
    queryClient.invalidateQueries({ queryKey: ["shell-config"] });
  }

  return (
    <BrandWaitState
      mode="pending"
      title={hasMissingSteps ? "Eksikler tamamlanmalı" : "Hesabın inceleniyor"}
      description={
        hasMissingSteps
          ? "Başvurunda eksik kalan belgeler var. Tamamladığında onay sürecine geçeriz."
          : "Usta başvurunu aldık. Belge doğrulama ve onay süreci tamamlandıktan sonra hesabın aktif hale gelecek ve iş tekliflerini görmeye başlayacaksın."
      }
      contextIcon={Clock}
      eyebrow={hasMissingSteps ? "Başvuru yarım kaldı" : "Başvuru sırada"}
      note={
        hasMissingSteps
          ? `${shell.required_onboarding_steps.length} adım tamamlanmalı.`
          : "Bu süreç genellikle 1-2 iş günü sürer. Onay SMS ile bildirilecek."
      }
      progressLabel={
        hasMissingSteps
          ? "Eksikleri tamamla, sonra Naro ekibi inceler"
          : "Naro ekibi belgelerini kontrol ediyor"
      }
      primaryAction={
        hasMissingSteps
          ? {
              label: "Eksikleri tamamla",
              onPress: () => router.push("/(onboarding)/provider-type"),
            }
          : {
              label: "Yenile",
              onPress: onRefresh,
            }
      }
      secondaryAction={{
        label: "Çıkış Yap",
        onPress: onLogout,
        variant: "outline",
      }}
    />
  );
}
