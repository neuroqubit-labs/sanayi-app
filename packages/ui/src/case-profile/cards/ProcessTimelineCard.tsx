import type { ServiceCase } from "@naro/domain";
import { Circle, Clock3, History } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { Text } from "../../Text";
import { CollapsibleSection } from "../CollapsibleSection";

import type { CaseCard } from "./types";

type EventTone = "info" | "accent" | "success" | "warning" | "critical";

const EVENT_TONE_COLOR: Record<EventTone, string> = {
  info: "#83a7ff",
  accent: "#0ea5e9",
  success: "#2dd28d",
  warning: "#f5b33f",
  critical: "#ff7e7e",
};

const MAX_PREVIEW = 5;

export const processTimelineCard: CaseCard = {
  id: "process-timeline",
  appliesTo: "any",
  priority: 85,
  shouldShow: ({ caseItem }) => caseItem.events.length >= 2,
  render: ({ caseItem }) => {
    const events = [...caseItem.events]
      .slice(-MAX_PREVIEW)
      .reverse();
    const mostRecent = events[0];

    return (
      <CollapsibleSection
        title="Süreç"
        accent="#83a7ff"
        titleIcon={History}
        description="Son olaylar, zaman damgaları"
        preview={
          mostRecent ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px]"
              numberOfLines={1}
            >
              {mostRecent.title} · {mostRecent.created_at_label}
            </Text>
          ) : null
        }
      >
        <View className="gap-0">
          {events.map((event, index) => (
            <EventRow
              key={event.id}
              event={event}
              isLast={index === events.length - 1}
            />
          ))}
        </View>
      </CollapsibleSection>
    );
  },
};

function EventRow({
  event,
  isLast,
}: {
  event: ServiceCase["events"][number];
  isLast: boolean;
}) {
  const color = EVENT_TONE_COLOR[(event.tone ?? "info") as EventTone];
  return (
    <View className="flex-row gap-3">
      <View className="items-center pt-1">
        <View
          className="h-3 w-3 items-center justify-center rounded-full border-2 bg-app-bg"
          style={{ borderColor: color }}
        >
          <Icon icon={Circle} size={3} color={color} strokeWidth={3} />
        </View>
        {!isLast ? (
          <View
            className="w-[2px] flex-1"
            style={{ backgroundColor: `${color}33`, minHeight: 22 }}
          />
        ) : null}
      </View>
      <View className="flex-1 gap-0.5 pb-3">
        <View className="flex-row items-center gap-2">
          <Text variant="label" tone="inverse" className="flex-1 text-[13px]">
            {event.title}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon icon={Clock3} size={10} color="#6b7280" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[10px]"
            >
              {event.created_at_label}
            </Text>
          </View>
        </View>
        {event.body ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px] leading-[16px]"
            numberOfLines={2}
          >
            {event.body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
