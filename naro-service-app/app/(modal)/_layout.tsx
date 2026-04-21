import { Stack } from "expo-router";

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: "fullScreenModal",
        animation: "slide_from_bottom",
        headerShown: false,
        contentStyle: { backgroundColor: "#060915" },
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
