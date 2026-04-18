import { Wrench } from "lucide-react-native";

import { PlaceholderFlow } from "@/shared/components/PlaceholderFlow";

export default function ArizaBildirModal() {
  return (
    <PlaceholderFlow
      icon={Wrench}
      title="Arıza Bildir"
      description="Sürülebilir bir arıza için adım adım ses/titreşim tanımı, medya ve tercihler buradan alınacak."
      showBack
    />
  );
}
