import { Megaphone } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export function CampaignsListScreen() {
  return (
    <PlaceholderFlow
      icon={Megaphone}
      title="Kampanyalarım"
      description="Aktif ve geçmiş kampanyaların, performans metrikleriyle birlikte burada listelenecek."
      showBack
    />
  );
}
