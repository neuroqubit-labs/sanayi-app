import { Button, Icon, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

export type PlaceholderFlowProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  showBack?: boolean;
};

export function PlaceholderFlow({
  title,
  description,
  icon,
  showBack = false,
}: PlaceholderFlowProps) {
  const router = useRouter();

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-50">
          <Icon icon={icon} size={40} color="#0284c7" />
        </View>
        <Text variant="h1" className="text-center">
          {title}
        </Text>
        <Text tone="calm" className="text-center">
          {description}
        </Text>
        <Text tone="muted" variant="caption" className="text-center">
          Bu akış yakında burada olacak.
        </Text>
      </View>
      {showBack ? (
        <View className="pb-4">
          <Button
            label="Geri"
            variant="ghost"
            fullWidth
            size="lg"
            onPress={() => router.back()}
          />
        </View>
      ) : null}
    </Screen>
  );
}
