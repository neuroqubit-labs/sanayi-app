import { ToggleChip } from "@naro/ui";
import { View } from "react-native";

import { ComposerSection } from "../ComposerSection";

import type { BreakdownChipQuestion } from "./types";
import { selectionsFor, toggleSymptom } from "./types";

export type ChipFieldProps = {
  question: BreakdownChipQuestion;
  symptoms: string[];
  onChange: (next: string[]) => void;
};

export function ChipField({ question, symptoms, onChange }: ChipFieldProps) {
  const selections = selectionsFor(question.id, symptoms);
  const multi = question.multi ?? true;

  return (
    <ComposerSection title={question.title} description={question.subtitle}>
      <View className="flex-row flex-wrap gap-2">
        {question.options.map((option) => (
          <ToggleChip
            key={option}
            label={option}
            selected={selections.includes(option)}
            onPress={() =>
              onChange(toggleSymptom(symptoms, question.id, option, multi))
            }
          />
        ))}
      </View>
    </ComposerSection>
  );
}
