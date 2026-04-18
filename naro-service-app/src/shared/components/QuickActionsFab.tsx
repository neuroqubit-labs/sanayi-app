import { Icon } from "@naro/ui";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable } from "react-native";

export function QuickActionsFab() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hızlı aksiyonlar"
      onPress={() => router.push("/(modal)/quick-actions")}
      className="absolute bottom-20 right-6 z-50 h-14 w-14 items-center justify-center rounded-full bg-brand-600 shadow-lg active:bg-brand-900"
    >
      <Icon icon={Plus} size={28} color="#ffffff" />
    </Pressable>
  );
}
