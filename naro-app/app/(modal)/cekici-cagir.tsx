import { Truck } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export default function CekiciCagirModal() {
  return (
    <PlaceholderFlow
      icon={Truck}
      title="Çekici Çağır"
      description="Konum seçimi, hemen/randevu tercihi ve not eklemek buradan yapılacak."
      showBack
    />
  );
}
