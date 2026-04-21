import {
  BrandWaitState,
  type BrandWaitStateAction,
  type BrandWaitStateMode,
} from "@naro/ui";
import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";

export type PlaceholderFlowProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  showBack?: boolean;
  mode?: BrandWaitStateMode;
  note?: string;
  primaryAction?: BrandWaitStateAction;
  secondaryAction?: BrandWaitStateAction;
};

export function PlaceholderFlow({
  title,
  description,
  icon,
  showBack = false,
  mode = "coming_soon",
  note,
  primaryAction,
  secondaryAction,
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
        "Naro servis deneyimi bu yüzeyi ortak marka sistemi altında topluyor. Akış hazır olduğunda doğrudan burada açılacak."
      }
      primaryAction={primaryAction}
      secondaryAction={
        secondaryAction ??
        (showBack
          ? {
              label: "Geri Dön",
              onPress: () => router.back(),
              variant: "outline",
            }
          : undefined)
      }
    />
  );
}
