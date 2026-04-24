import { useNaroTheme } from "@naro/ui";
import { Stack } from "expo-router";

export default function ModalLayout() {
  const { colors } = useNaroTheme();

  return (
    <Stack
      screenOptions={{
        presentation: "fullScreenModal",
        animation: "slide_from_bottom",
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="quick-actions"
        options={{
          presentation: "transparentModal",
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack>
  );
}
