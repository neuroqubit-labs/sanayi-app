import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  className?: string;
  backgroundClassName?: string;
  /** SafeArea edge'leri. Default: top+bottom. */
  edges?: Array<"top" | "bottom" | "left" | "right">;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  className,
  backgroundClassName,
  edges = ["top", "bottom"],
}: ScreenProps) {
  const background = backgroundClassName ?? "bg-app-bg";
  const base = ["flex-1", background].filter(Boolean).join(" ");
  const padding = padded ? "px-6 pt-6" : "";
  const composed = [padding, className ?? ""].filter(Boolean).join(" ");

  if (scroll) {
    return (
      <SafeAreaView edges={edges} className={base}>
        <ScrollView
          contentContainerClassName={[padding, "gap-4", className ?? ""]
            .filter(Boolean)
            .join(" ")}
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
