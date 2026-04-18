import { ListChecks } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export function PoolScreen() {
  return (
    <PlaceholderFlow
      icon={ListChecks}
      title="İş Havuzu"
      description="Bölgende açılan tüm işler burada. Detayına bak, teklif ver."
    />
  );
}
