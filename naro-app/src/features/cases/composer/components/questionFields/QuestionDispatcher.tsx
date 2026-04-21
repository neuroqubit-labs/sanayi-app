import { ChipField } from "./ChipField";
import { IconGridField } from "./IconGridField";
import { ShortTextField } from "./ShortTextField";
import type { BreakdownQuestion } from "./types";
import { shouldShowQuestion } from "./types";

export type QuestionDispatcherProps = {
  question: BreakdownQuestion;
  symptoms: string[];
  onChange: (next: string[]) => void;
};

export function QuestionDispatcher({
  question,
  symptoms,
  onChange,
}: QuestionDispatcherProps) {
  if (!shouldShowQuestion(question, symptoms)) {
    return null;
  }

  switch (question.kind) {
    case "chips":
      return (
        <ChipField question={question} symptoms={symptoms} onChange={onChange} />
      );
    case "icon_grid":
      return (
        <IconGridField
          question={question}
          symptoms={symptoms}
          onChange={onChange}
        />
      );
    case "short_text":
      return (
        <ShortTextField
          question={question}
          symptoms={symptoms}
          onChange={onChange}
        />
      );
  }
}
