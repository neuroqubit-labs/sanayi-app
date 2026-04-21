import { BrandWaitState } from "@naro/ui";
import { useRouter } from "expo-router";
import { Clock } from "lucide-react-native";

import { useAuthStore } from "@/services/auth/store";

export default function PendingScreen() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  async function onLogout() {
    await clear();
    router.replace("/(auth)/login");
  }

  return (
    <BrandWaitState
      mode="pending"
      title="Hesabın inceleniyor"
      description="Usta başvurunu aldık. Belge doğrulama ve onay süreci tamamlandıktan sonra hesabın aktif hale gelecek ve iş tekliflerini görmeye başlayacaksın."
      contextIcon={Clock}
      eyebrow="Başvuru sırada"
      note="Bu süreç genellikle 1-2 iş günü sürer. Onay SMS ile bildirilecek."
      progressLabel="Naro ekibi belgelerini kontrol ediyor"
      primaryAction={{
        label: "Başvurumu tamamla",
        onPress: () => router.push("/(onboarding)/provider-type"),
      }}
      secondaryAction={{
        label: "Çıkış Yap",
        onPress: onLogout,
        variant: "outline",
      }}
    />
  );
}
