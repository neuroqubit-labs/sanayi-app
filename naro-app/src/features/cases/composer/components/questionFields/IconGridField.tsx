import { GesturePressable as Pressable, Icon, Text } from "@naro/ui";
import { Check } from "lucide-react-native";
import { View } from "react-native";

import { ComposerSection } from "../ComposerSection";

import type { BreakdownIconGridQuestion } from "./types";
import { selectionsFor, toggleSymptom } from "./types";

export type IconGridFieldProps = {
  question: BreakdownIconGridQuestion;
  symptoms: string[];
  onChange: (next: string[]) => void;
};

export function IconGridField({
  question,
  symptoms,
  onChange,
}: IconGridFieldProps) {
  const selections = selectionsFor(question.id, symptoms);
  const multi = question.multi ?? true;

  return (
    <ComposerSection title={question.title} description={question.subtitle}>
      <View className="flex-row flex-wrap gap-2">
        {question.items.map((item) => {
          const isSelected = selections.includes(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole={multi ? "checkbox" : "radio"}
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={item.label}
              onPress={() =>
                onChange(toggleSymptom(symptoms, question.id, item.id, multi))
              }
              style={{ width: "31.5%" }}
              className={[
                "gap-2 rounded-[17px] border px-2.5 py-2.5 active:opacity-90",
                isSelected
                  ? "border-brand-500 bg-brand-500/15"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              <View className="flex-row items-start justify-between">
                <View
                  className={[
                    "h-9 w-9 items-center justify-center rounded-[13px] border",
                    isSelected
                      ? "border-brand-500/40 bg-brand-500/20"
                      : "border-app-outline bg-app-surface-2",
                  ].join(" ")}
                >
                  <Icon
                    icon={item.icon}
                    size={17}
                    color={isSelected ? "#0ea5e9" : "#83a7ff"}
                  />
                </View>
                {isSelected ? (
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-500">
                    <Icon icon={Check} size={10} color="#ffffff" />
                  </View>
                ) : null}
              </View>
              <Text
                variant="caption"
                tone="inverse"
                numberOfLines={2}
                className="text-[12px] leading-[14px]"
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ComposerSection>
  );
}
