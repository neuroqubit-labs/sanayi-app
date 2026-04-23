import { Text } from "@naro/ui";
import { View } from "react-native";

import type { ThreadMessageResponse } from "../schemas/thread";

type LiveMessageBubbleProps = {
  message: ThreadMessageResponse;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Canonical wire mesaj (`sender_role` / `content`) üstünde sade baloncuk.
 * V1: system mesaj yok (BE yalnız customer/technician döndürür); attach
 * bu endpointte exposed değil. V2'de thread attachments + PII mask ayrı
 * brief (backlog).
 */
export function LiveMessageBubble({ message }: LiveMessageBubbleProps) {
  const isCustomer = message.sender_role === "customer";
  const label = isCustomer ? "Sen" : "Usta";

  return (
    <View
      className={[
        "gap-2 rounded-[24px] px-4 py-3",
        isCustomer
          ? "self-end bg-brand-500"
          : "self-start border border-app-outline bg-app-surface-2",
      ].join(" ")}
      style={{ maxWidth: "88%" }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="label" tone={isCustomer ? "inverse" : "accent"}>
          {label}
        </Text>
        <Text
          variant="caption"
          tone={isCustomer ? "inverse" : "subtle"}
          className={isCustomer ? "opacity-80" : ""}
        >
          {formatTime(message.created_at)}
        </Text>
      </View>
      <Text
        tone={isCustomer ? "inverse" : "muted"}
        className={isCustomer ? "" : "text-app-text-muted"}
      >
        {message.content}
      </Text>
    </View>
  );
}
