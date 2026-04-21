import { Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  BarChart3,
  ChevronRight,
  MessageSquare,
  Receipt,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

type Tool = {
  id: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  route: string;
};

const TOOLS: Tool[] = [
  {
    id: "revenue",
    label: "Gelir özeti",
    subtitle: "Aylık kazanç + tahsilat",
    icon: BarChart3,
    route: "/(modal)/gelir-ozeti",
  },
  {
    id: "reviews",
    label: "Müşteri yorumları",
    subtitle: "Son puanlar + teşekkürler",
    icon: MessageSquare,
    route: "/(modal)/yorumlar",
  },
  {
    id: "invoices",
    label: "Faturalar",
    subtitle: "Düzenlenecek + teslim edilenler",
    icon: Receipt,
    route: "/(tabs)/islerim",
  },
];

export function OtherToolsList() {
  const router = useRouter();
  return (
    <View className="gap-2">
      {TOOLS.map((tool) => (
        <Pressable
          key={tool.id}
          accessibilityRole="button"
          onPress={() => router.push(tool.route as Href)}
          className="flex-row items-center gap-3 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={tool.icon} size={14} color="#83a7ff" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="inverse" className="text-[13px]">
              {tool.label}
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
              {tool.subtitle}
            </Text>
          </View>
          <Icon icon={ChevronRight} size={12} color="#83a7ff" />
        </Pressable>
      ))}
    </View>
  );
}
