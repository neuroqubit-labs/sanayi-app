import type { CaseMessage } from "@naro/domain";
import { Text } from "@naro/ui";
import { View } from "react-native";

type MessageBubbleProps = {
  message: CaseMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isCustomer = message.author_role === "customer";
  const isSystem = message.author_role === "system";

  return (
    <View
      className={[
        "gap-2 rounded-[24px] px-4 py-3",
        isSystem
          ? "border border-app-outline bg-app-surface"
          : isCustomer
            ? "self-end bg-brand-500"
            : "self-start border border-app-outline bg-app-surface-2",
      ].join(" ")}
      style={{ maxWidth: "88%" }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="label"
          tone={isCustomer ? "inverse" : isSystem ? "subtle" : "accent"}
        >
          {message.author_name}
        </Text>
        <Text
          variant="caption"
          tone={isCustomer ? "inverse" : "subtle"}
          className={isCustomer ? "opacity-80" : ""}
        >
          {message.created_at_label}
        </Text>
      </View>
      <Text
        tone={isCustomer ? "inverse" : "muted"}
        className={isCustomer ? "" : "text-app-text-muted"}
      >
        {message.body}
      </Text>
      {message.attachments.length ? (
        <View className="gap-2">
          {message.attachments.map((attachment) => (
            <View
              key={attachment.id}
              className={[
                "rounded-[18px] border px-3 py-2",
                isCustomer
                  ? "border-white/20 bg-white/10"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              <Text variant="label" tone={isCustomer ? "inverse" : "inverse"}>
                {attachment.title}
              </Text>
              {attachment.subtitle ? (
                <Text
                  variant="caption"
                  tone={isCustomer ? "inverse" : "subtle"}
                  className={isCustomer ? "opacity-80" : ""}
                >
                  {attachment.subtitle}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
