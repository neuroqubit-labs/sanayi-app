import { FileText } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export function RecordsScreen() {
  return (
    <PlaceholderFlow
      icon={FileText}
      title="Kayıtlar"
      description="Talep ve vakalarının geçmişi burada listelenecek. İlk talebini Ana Sayfa'daki hızlı aksiyonlardan başlatabilirsin."
    />
  );
}
