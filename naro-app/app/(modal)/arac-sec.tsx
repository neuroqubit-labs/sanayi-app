import { Car } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export default function AracSecModal() {
  return (
    <PlaceholderFlow
      icon={Car}
      title="Araç Seç"
      description="Kayıtlı araçların arasından seçim yap veya yeni araç ekle."
      showBack
    />
  );
}
