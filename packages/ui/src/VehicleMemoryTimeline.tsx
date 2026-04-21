import { View } from "react-native";
import {
  AlertTriangle,
  BadgeCheck,
  FileText,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";
import type { StatusChipTone } from "./StatusChip";

export type VehicleMemoryEventKind =
  | "maintenance"
  | "repair"
  | "damage"
  | "warranty"
  | "document";

export type VehicleMemoryEvent = {
  id: string;
  kind: VehicleMemoryEventKind;
  title: string;
  subtitle?: string;
  dateLabel: string;
  badgeLabel?: string;
  badgeTone?: StatusChipTone;
};

const KIND_ICON: Record<VehicleMemoryEventKind, LucideIcon> = {
  maintenance: Wrench,
  repair: Wrench,
  damage: AlertTriangle,
  warranty: BadgeCheck,
  document: FileText,
};

const KIND_ICON_COLOR: Record<VehicleMemoryEventKind, string> = {
  maintenance: "#2dd28d",
  repair: "#83a7ff",
  damage: "#ff6b6b",
  warranty: "#0ea5e9",
  document: "#f5f7ff",
};

export type VehicleMemoryTimelineProps = {
  events: VehicleMemoryEvent[];
  emptyText?: string;
  className?: string;
};

export function VehicleMemoryTimeline({
  events,
  emptyText = "Bu araç için henüz kayıtlı işlem yok.",
  className,
}: VehicleMemoryTimelineProps) {
  if (events.length === 0) {
    return (
      <View
        className={[
          "items-center justify-center rounded-[22px] border border-app-outline bg-app-surface px-4 py-8",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Text tone="muted" className="text-app-text-muted text-center">
          {emptyText}
        </Text>
      </View>
    );
  }

  return (
    <View className={["gap-3", className ?? ""].filter(Boolean).join(" ")}>
      {events.map((event, index) => {
        const IconComp = KIND_ICON[event.kind];
        const isLast = index === events.length - 1;

        return (
          <View key={event.id} className="flex-row gap-3">
            <View className="items-center">
              <View className="h-10 w-10 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                <Icon icon={IconComp} size={16} color={KIND_ICON_COLOR[event.kind]} />
              </View>
              {isLast ? null : (
                <View className="mt-1 w-px flex-1 bg-app-outline" />
              )}
            </View>
            <View className="flex-1 gap-1 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
              <View className="flex-row items-center justify-between gap-3">
                <Text variant="label" tone="inverse" className="flex-1">
                  {event.title}
                </Text>
                <Text variant="caption" tone="subtle">
                  {event.dateLabel}
                </Text>
              </View>
              {event.subtitle ? (
                <Text variant="caption" tone="muted" className="text-app-text-muted">
                  {event.subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
