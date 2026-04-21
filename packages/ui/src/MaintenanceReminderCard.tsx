import { Pressable, View } from "react-native";
import { CalendarClock, ChevronRight } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { TrustBadge } from "./TrustBadge";
import type { StatusChipTone } from "./StatusChip";

export type MaintenanceReminderCardProps = {
  title: string;
  subtitle?: string;
  dueLabel: string;
  tone?: StatusChipTone;
  actionLabel?: string;
  onPress?: () => void;
  className?: string;
};

export function MaintenanceReminderCard({
  title,
  subtitle,
  dueLabel,
  tone = "warning",
  actionLabel = "Bakım planla",
  onPress,
  className,
}: MaintenanceReminderCardProps) {
  const Container: typeof Pressable | typeof View = onPress ? Pressable : View;

  return (
    <Container
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      className={[
        "gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4",
        onPress ? "active:bg-app-surface-2" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
          <Icon icon={CalendarClock} size={18} color="#f5b33f" />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="label" tone="inverse">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onPress ? <Icon icon={ChevronRight} size={18} color="#6f7b97" /> : null}
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <TrustBadge label={dueLabel} tone={tone} />
        {onPress ? (
          <Text variant="caption" tone="accent">
            {actionLabel}
          </Text>
        ) : null}
      </View>
    </Container>
  );
}
