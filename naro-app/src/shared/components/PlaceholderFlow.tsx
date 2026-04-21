import { BrandWaitState, type BrandWaitStateMode } from "@naro/ui";
import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";

export type PlaceholderFlowProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  showBack?: boolean;
  mode?: BrandWaitStateMode;
  note?: string;
};

export function PlaceholderFlow({
  title,
  description,
  icon,
  showBack = false,
  mode = "coming_soon",
  note,
}: PlaceholderFlowProps) {
  const router = useRouter();

  return (
    <BrandWaitState
      mode={mode}
      title={title}
      description={description}
      contextIcon={icon}
      showBack={showBack}
      onBack={showBack ? () => router.back() : undefined}
      note={
        note ??
        "Naro bu yüzeyi markalı ana deneyime taşıyor. Hazır olduğunda aynı dil içinde açılacak."
      }
      secondaryAction={
        showBack
          ? {
              label: "Geri Dön",
              onPress: () => router.back(),
              variant: "outline",
            }
          : undefined
      }
    />
  );
}
