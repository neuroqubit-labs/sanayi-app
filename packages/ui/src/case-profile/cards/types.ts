import type { ServiceCase } from "@naro/domain";
import type { ReactNode } from "react";

/**
 * Vaka profilini kim ve hangi bağlamda görüyor?
 * - actor: customer = araç sahibi; technician = usta
 * - contextState: pool (keşif/teklif verme), process (süreç yönetimi),
 *   archive (kapanmış dosya — kilitli read-only)
 */
export type CaseProfileActor = "customer" | "technician";
export type CaseProfileContextState = "pool" | "process" | "archive";

export type CaseProfileContext = {
  caseItem: ServiceCase;
  actor: CaseProfileActor;
  contextState: CaseProfileContextState;
  myTechnicianId?: string;
  /** Rakip teklifleri göster. technician + pool default true. */
  showCompetingOffers?: boolean;
};

/**
 * Kart sözleşmesi. Her kart kendi görünürlüğünü bilir.
 * - priority: artan sayı = daha üst. 10-100 arası dikey yerleşim için,
 *   >=900 footer ve altı için kullanılır.
 * - appliesTo: kart hangi kind'lerde candidate. "any" → tüm kind'ler.
 *   Dolu ama içinde kind yoksa asla gösterilmez.
 * - shouldShow: candidate durumundaki kart gerçekten render edilsin mi?
 *   (domain verisi yeterli mi, durum uygun mu, vs.)
 */
export type CaseCard = {
  id: string;
  appliesTo: ServiceCase["kind"][] | "any";
  priority: number;
  shouldShow: (ctx: CaseProfileContext) => boolean;
  render: (ctx: CaseProfileContext) => ReactNode;
};

/** Kart listesini filtrele + sırala. Saf helper — test kolay. */
export function resolveVisibleCards(
  cards: readonly CaseCard[],
  ctx: CaseProfileContext,
): CaseCard[] {
  return cards
    .filter((card) => {
      if (card.appliesTo !== "any" && !card.appliesTo.includes(ctx.caseItem.kind)) {
        return false;
      }
      return card.shouldShow(ctx);
    })
    .sort((a, b) => a.priority - b.priority);
}
