import type { CaseMessage } from "@naro/domain";
import { Text } from "@naro/ui";
import { View } from "react-native";

type MessageBubbleProps = {
  message: CaseMessage;
};

/**
 * Usta tarafında: teknisyen kendi mesajları sağa hizalanır (self-end, brand bg),
 * müşteri mesajları sola hizalanır (outlined), sistem mesajları ortada neutral.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isTechnician = message.author_role === "technician";
  const isSystem = message.author_role === "system";

  return (
    <View
      className={[
        "gap-2 rounded-[24px] px-4 py-3",
        isSystem
          ? "border border-app-outline bg-app-surface"
          : isTechnician
            ? "self-end bg-brand-500"
            : "self-start border border-app-outline bg-app-surface-2",
      ].join(" ")}
      style={{ maxWidth: "88%" }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="label"
          tone={isTechnician ? "inverse" : isSystem ? "subtle" : "accent"}
        >
          {message.author_name}
        </Text>
        <Text
          variant="caption"
          tone={isTechnician ? "inverse" : "subtle"}
          className={isTechnician ? "opacity-80" : ""}
        >
          {message.created_at_label}
        </Text>
      </View>
      <Text
        tone={isTechnician ? "inverse" : "muted"}
        className={isTechnician ? "" : "text-app-text-muted"}
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
                isTechnician
                  ? "border-white/20 bg-white/10"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              <Text variant="label" tone="inverse">
                {attachment.title}
              </Text>
              {attachment.subtitle ? (
                <Text
                  variant="caption"
                  tone={isTechnician ? "inverse" : "subtle"}
                  className={isTechnician ? "opacity-80" : ""}
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
