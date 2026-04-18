import { Sparkles } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export function CreateCampaignScreen() {
  return (
    <PlaceholderFlow
      icon={Sparkles}
      title="Yeni Kampanya"
      description="Paket adı, kategori, fiyatlandırma ve dahil hizmetler buradan tanımlanacak."
      showBack
    />
  );
}
