import { MessageCircle, MessageSquare } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { StatusChip } from "../../StatusChip";
import { Text } from "../../Text";
import { CollapsibleSection } from "../CollapsibleSection";

import type { CaseCard } from "./types";

const ROLE_LABEL: Record<string, string> = {
  customer: "Müşteri",
  technician: "Usta",
  system: "Naro",
};

export const messagingCard: CaseCard = {
  id: "messaging",
  appliesTo: "any",
  priority: 90,
  shouldShow: ({ caseItem }) => caseItem.thread.messages.length >= 1,
  render: ({ caseItem, actor }) => {
    const thread = caseItem.thread;
    const lastMessage = thread.messages[thread.messages.length - 1];
    const unread = actor === "customer" ? thread.unread_count : 0;

    return (
      <CollapsibleSection
        title="Mesajlaşma"
        accent="#0ea5e9"
        titleIcon={MessageCircle}
        description="Müşteri ↔ usta thread özet"
        preview={
          <View className="flex-row items-center gap-2">
            {unread > 0 ? (
              <StatusChip label={`${unread} yeni`} tone="critical" />
            ) : null}
            {lastMessage ? (
              <Text
                variant="caption"
                tone="muted"
                className="flex-1 text-app-text-muted text-[12px]"
                numberOfLines={1}
              >
                {lastMessage.author_name}: {lastMessage.body}
              </Text>
            ) : null}
          </View>
        }
      >
        <View className="gap-2">
          <View className="flex-row items-start gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
              <Icon icon={MessageSquare} size={14} color="#0ea5e9" />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text variant="label" tone="inverse" className="text-[13px]">
                  {lastMessage?.author_name ?? "Naro"}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-subtle text-[10px]"
                >
                  {ROLE_LABEL[lastMessage?.author_role ?? "system"] ?? "Naro"}
                </Text>
                <View className="flex-1" />
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-subtle text-[10px]"
                >
                  {lastMessage?.created_at_label ?? ""}
                </Text>
              </View>
              {lastMessage ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px] leading-[17px]"
                  numberOfLines={3}
                >
                  {lastMessage.body}
                </Text>
              ) : null}
            </View>
          </View>
          {thread.messages.length > 1 ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              +{thread.messages.length - 1} önceki mesaj · tam akışı vaka
              mesajlar sekmesinde gör
            </Text>
          ) : null}
        </View>
      </CollapsibleSection>
    );
  },
};
