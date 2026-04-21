import type { LucideIcon } from "lucide-react-native";

export type BreakdownCondition = {
  questionId: string;
  includesAny: string[];
};

export type BreakdownChipQuestion = {
  kind: "chips";
  id: string;
  title: string;
  subtitle?: string;
  multi?: boolean;
  options: string[];
  showIf?: BreakdownCondition;
};

export type BreakdownIconGridItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type BreakdownIconGridQuestion = {
  kind: "icon_grid";
  id: string;
  title: string;
  subtitle?: string;
  multi?: boolean;
  items: BreakdownIconGridItem[];
  showIf?: BreakdownCondition;
};

export type BreakdownShortTextQuestion = {
  kind: "short_text";
  id: string;
  title: string;
  placeholder: string;
  showIf?: BreakdownCondition;
};

export type BreakdownQuestion =
  | BreakdownChipQuestion
  | BreakdownIconGridQuestion
  | BreakdownShortTextQuestion;

export function shouldShowQuestion(
  question: BreakdownQuestion,
  symptoms: string[],
): boolean {
  if (!question.showIf) return true;
  const { questionId, includesAny } = question.showIf;
  return includesAny.some((option) =>
    symptoms.includes(`${questionId}:${option}`),
  );
}

export function selectionsFor(
  questionId: string,
  symptoms: string[],
): string[] {
  const prefix = `${questionId}:`;
  return symptoms
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => entry.slice(prefix.length));
}

export function toggleSymptom(
  symptoms: string[],
  questionId: string,
  value: string,
  multi: boolean,
): string[] {
  const key = `${questionId}:${value}`;
  const without = multi
    ? symptoms.filter((entry) => entry !== key)
    : symptoms.filter((entry) => !entry.startsWith(`${questionId}:`));
  if (symptoms.includes(key)) {
    return without;
  }
  return [...without, key];
}

export function setShortText(
  symptoms: string[],
  questionId: string,
  value: string,
): string[] {
  const prefix = `${questionId}:`;
  const without = symptoms.filter((entry) => !entry.startsWith(prefix));
  const trimmed = value.trim();
  if (!trimmed) return without;
  return [...without, `${prefix}${trimmed}`];
}

export function readShortText(
  questionId: string,
  symptoms: string[],
): string {
  return selectionsFor(questionId, symptoms)[0] ?? "";
}
