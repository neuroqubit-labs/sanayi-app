import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  className?: string;
  /** SafeArea edge'leri. Default: top+bottom. */
  edges?: Array<"top" | "bottom" | "left" | "right">;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  className,
  edges = ["top", "bottom"],
}: ScreenProps) {
  const base = "flex-1 bg-white";
  const padding = padded ? "px-6 pt-6" : "";
  const composed = [base, padding, className ?? ""].filter(Boolean).join(" ");

  if (scroll) {
    return (
      <SafeAreaView edges={edges} className={base}>
        <ScrollView
          contentContainerClassName={[padding, "gap-4"].filter(Boolean).join(" ")}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} className={base}>
      <View className={composed}>{children}</View>
    </SafeAreaView>
  );
}
