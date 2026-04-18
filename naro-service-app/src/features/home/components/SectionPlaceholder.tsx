import { Text } from "@naro/ui";
import { View } from "react-native";

export type SectionPlaceholderProps = {
  title: string;
  hint?: string;
};

export function SectionPlaceholder({ title, hint }: SectionPlaceholderProps) {
  return (
    <View className="gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <Text variant="h3">{title}</Text>
      <Text tone="muted" variant="caption">
        {hint ?? "Yakında burada olacak."}
      </Text>
    </View>
  );
}
