import { Fragment } from "react";
import { View } from "react-native";

import {
  resolveVisibleCards,
  type CaseCard,
  type CaseProfileContext,
} from "./cards/types";

type Props = CaseProfileContext & {
  cards: readonly CaseCard[];
};

/**
 * Vaka profili composer — kart registry'sini alır, görünenleri filtreler
 * + priority'ye göre sıralar + tek `gap-4` stack içinde render eder.
 *
 * Her kartın `id`'si unique olmalı; aynı id iki kez registry'de olursa ilk
 * görünen kazanır (React key collision).
 */
export function CaseProfileComposer({ cards, ...context }: Props) {
  const visible = resolveVisibleCards(cards, context);
  return (
    <View className="gap-4">
      {visible.map((card) => (
        <Fragment key={card.id}>{card.render(context)}</Fragment>
      ))}
    </View>
  );
}
