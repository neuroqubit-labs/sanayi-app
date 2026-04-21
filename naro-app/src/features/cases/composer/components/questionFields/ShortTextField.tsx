import { TextInput } from "react-native";

import { ComposerSection } from "../ComposerSection";

import type { BreakdownShortTextQuestion } from "./types";
import { readShortText, setShortText } from "./types";

const INPUT_CLASS =
  "rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 text-base text-app-text min-h-[88px]";

export type ShortTextFieldProps = {
  question: BreakdownShortTextQuestion;
  symptoms: string[];
  onChange: (next: string[]) => void;
};

export function ShortTextField({
  question,
  symptoms,
  onChange,
}: ShortTextFieldProps) {
  const value = readShortText(question.id, symptoms);

  return (
    <ComposerSection title={question.title}>
      <TextInput
        value={value}
        onChangeText={(next) => onChange(setShortText(symptoms, question.id, next))}
        placeholder={question.placeholder}
        placeholderTextColor="#6f7b97"
        multiline
        textAlignVertical="top"
        className={INPUT_CLASS}
      />
    </ComposerSection>
  );
}
