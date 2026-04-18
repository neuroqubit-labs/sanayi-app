import { Heart } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export default function BakimTalebiModal() {
  return (
    <PlaceholderFlow
      icon={Heart}
      title="Bakım Talebi"
      description="Periyodik bakım, iş kalemleri seçimi ve tercih edilen tarih aralığı burada yer alacak."
      showBack
    />
  );
}
