import { AlertTriangle } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export default function KazaBildirModal() {
  return (
    <PlaceholderFlow
      icon={AlertTriangle}
      title="Kaza Bildir"
      description="Acil eylem, kaza bilgileri, fotoğraflar, tutanak ve evraklar — bu akış adım adım burada yer alacak."
      showBack
    />
  );
}
