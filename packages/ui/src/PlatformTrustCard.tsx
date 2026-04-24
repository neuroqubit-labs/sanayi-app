import { View } from "react-native";
import { FileCheck, ShieldCheck, Wallet } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type PlatformTrustCardProps = {
  className?: string;
};

const PILLARS = [
  {
    icon: Wallet,
    iconColor: "#2dd28d",
    title: "Koruma altında ödeme",
    description: "Ödeme, iş onaylanana kadar Naro güvencesinde tutulur.",
  },
  {
    icon: FileCheck,
    iconColor: "#83a7ff",
    title: "Garanti takibi",
    description: "Onarım sonrası garanti süresi ve kapsam burada kayıtlı.",
  },
  {
    icon: ShieldCheck,
    iconColor: "#0ea5e9",
    title: "Şeffaf kayıt",
    description: "Notlar, fotoğraflar ve faturalar kayıt altında; her iki taraf erişebilir.",
  },
] as const;

export function PlatformTrustCard({ className }: PlatformTrustCardProps) {
  return (
    <View
      className={[
        "gap-4 rounded-[26px] border border-app-outline bg-app-surface px-4 py-4",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View className="gap-1">
        <Text variant="eyebrow" tone="accent">
          Platform güvencesi
        </Text>
        <Text variant="h3" tone="inverse">
          Kayıtlar Naro'da şeffafça saklanır
        </Text>
      </View>

      <View className="gap-3">
        {PILLARS.map((pillar) => (
          <View key={pillar.title} className="flex-row items-start gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
              <Icon icon={pillar.icon} size={16} color={pillar.iconColor} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse">
                {pillar.title}
              </Text>
              <Text variant="caption" tone="muted" className="text-app-text-muted">
                {pillar.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
