import { Briefcase } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export function JobsScreen() {
  return (
    <PlaceholderFlow
      icon={Briefcase}
      title="İşlerim"
      description="Aktif ve tamamlanan işlerin burada listelenecek, timeline ile durum takibi sağlanır."
    />
  );
}
