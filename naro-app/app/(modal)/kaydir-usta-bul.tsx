import { Sparkles } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export default function KaydirUstaBulModal() {
  return (
    <PlaceholderFlow
      icon={Sparkles}
      title="Kaydır ve Usta Bul"
      description="Aracına uygun ustaları kart kart keşfet, profili aç, teklif iste."
      showBack
    />
  );
}
