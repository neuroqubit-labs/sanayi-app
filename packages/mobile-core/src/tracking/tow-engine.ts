import type {
  CaseActor,
  CaseMilestone,
  CaseWaitState,
  ServiceCase,
} from "@naro/domain";

/**
 * F-P1-1 (2026-04-23 lifecycle audit L3-P1-1): tow stage-first
 * tracking derivation. Generic shell-driven engine tow case'i
 * SEARCHING/ACCEPTED/DELIVERED gibi stage'leri status-spine'a sıkıştırıyor;
 * TowCaseScreenLive stage-aware ama customer home + generic tracking
 * view'lar "Servis sürüyor" gibi genel bir şey gösteriyordu.
 *
 * Bu helper tow kind'ı için milestone + wait_state + progress_percent
 * sade stage-table'ından üretir. `syncTrackingCase` dispatch eder.
 *
 * Scope:
 * - Aktif pilot stage'ler: searching, accepted, en_route, nearby,
 *   arrived, loading, in_transit, delivered.
 * - Terminal: cancelled.
 * - Edge: timeout_converted_to_pool, scheduled_waiting, bidding_open,
 *   offer_accepted, preauth_failed, preauth_stale → "bekleme/retry"
 *   bucket'ına (dedicated milestone yok, generic "Sürece devam" label).
 */

type StageMeta = {
  key: string;
  title: string;
  description: string;
  actor: CaseActor;
};

// Mainline sekansta sıralı tow milestone'lar (8 stage).
const TOW_STAGE_ORDER: StageMeta[] = [
  {
    key: "tow:searching",
    title: "Çekici aranıyor",
    description: "Bölgendeki uygun çekicilere bildirim gidiyor.",
    actor: "system",
  },
  {
    key: "tow:accepted",
    title: "Çekici kabul etti",
    description: "Operatör talebi kabul etti, yola çıkmaya hazırlanıyor.",
    actor: "technician",
  },
  {
    key: "tow:en_route",
    title: "Yolda",
    description: "Operatör sana doğru geliyor.",
    actor: "technician",
  },
  {
    key: "tow:nearby",
    title: "Yakında",
    description: "Operatör yakındaki konumda; takip haritasından görebilirsin.",
    actor: "technician",
  },
  {
    key: "tow:arrived",
    title: "Yerinde",
    description: "Operatör belirttiğin noktaya ulaştı.",
    actor: "customer",
  },
  {
    key: "tow:loading",
    title: "Aracın yükleniyor",
    description: "Araç çekiciye yükleniyor.",
    actor: "technician",
  },
  {
    key: "tow:in_transit",
    title: "Taşınıyor",
    description: "Aracın varış noktasına taşınıyor.",
    actor: "technician",
  },
  {
    key: "tow:delivered",
    title: "Teslim edildi",
    description: "Araç teslim edildi, süreç tamamlandı.",
    actor: "system",
  },
];

const STAGE_TO_INDEX: Record<string, number> = {
  searching: 0,
  accepted: 1,
  en_route: 2,
  nearby: 3,
  arrived: 4,
  loading: 5,
  in_transit: 6,
  delivered: 7,
};

function stageIndex(stage: string | null | undefined): number {
  if (!stage) return 0;
  return STAGE_TO_INDEX[stage] ?? 0;
}

function towStageToProgress(stage: string | null | undefined): number {
  if (!stage) return 5;
  if (stage === "cancelled") return 0;
  const idx = STAGE_TO_INDEX[stage];
  if (idx === undefined) return 10;
  // 8 stage: 5, 15, 30, 45, 60, 75, 88, 100.
  const steps = [5, 15, 30, 45, 60, 75, 88, 100];
  return steps[idx] ?? 10;
}

export function deriveTowMilestones(
  caseItem: ServiceCase,
): CaseMilestone[] {
  const stage = caseItem.tow_stage;
  if (stage === "cancelled") {
    return [
      {
        id: `milestone-tow-cancelled-${caseItem.id}`,
        key: "tow:cancelled",
        title: "Çekici talebi iptal edildi",
        description: "Talep iptal alındı, süreç kapandı.",
        actor: "system",
        sequence: 0,
        status: "completed",
        related_task_ids: [],
      },
    ];
  }
  const activeIdx = stageIndex(stage);
  return TOW_STAGE_ORDER.map((meta, index) => {
    const status =
      index < activeIdx
        ? "completed"
        : index === activeIdx
          ? activeIdx === TOW_STAGE_ORDER.length - 1
            ? "completed"
            : "active"
          : "upcoming";
    return {
      id: `milestone-${caseItem.id}-${meta.key}`,
      key: meta.key,
      title: meta.title,
      description: meta.description,
      actor: meta.actor,
      sequence: index,
      status,
      related_task_ids: [],
    };
  });
}

export function deriveTowWaitState(
  caseItem: ServiceCase,
): CaseWaitState {
  const stage = caseItem.tow_stage;
  switch (stage) {
    case "searching":
      return {
        actor: "system",
        label: "Çekici aranıyor",
        description:
          "Bölgendeki uygun operatörlere bildirim gidiyor; en yakın olan kabul ettiğinde haber veriyoruz.",
      };
    case "accepted":
    case "en_route":
    case "nearby":
      return {
        actor: "technician",
        label: "Operatör yolda",
        description: "Operatör sana doğru ilerliyor; haritadan takip et.",
      };
    case "arrived":
      return {
        actor: "customer",
        label: "Operatör yerinde",
        description: "Araç tanışma kodunu operatöre ilet.",
      };
    case "loading":
    case "in_transit":
      return {
        actor: "technician",
        label: "Araç taşınıyor",
        description: "Hedef noktaya ulaşana kadar süreci takip edebilirsin.",
      };
    case "delivered":
      return {
        actor: "system",
        label: "Teslim edildi",
        description: "Süreç tamamlandı; puanlama ekranından deneyimini paylaşabilirsin.",
      };
    case "cancelled":
      return {
        actor: "system",
        label: "Talep iptal edildi",
        description: "Süreç kapandı.",
      };
    case "bidding_open":
    case "offer_accepted":
    case "scheduled_waiting":
      return {
        actor: "customer",
        label: "Teklifler bekleniyor",
        description: "Randevulu çekici akışında teklifler değerlendiriliyor.",
      };
    case "preauth_failed":
    case "preauth_stale":
      return {
        actor: "customer",
        label: "Ödeme yeniden başlatılmalı",
        description: "Farklı kartla tekrar dene.",
      };
    case "timeout_converted_to_pool":
      return {
        actor: "system",
        label: "Havuza düştü",
        description: "Kimse kabul etmediği için talep teklif havuzuna alındı.",
      };
    default:
      return {
        actor: "system",
        label: "Sürece devam",
        description: "Platform aşamayı güncelliyor.",
      };
  }
}

export function syncTowTrackingCase(
  caseItem: ServiceCase,
): ServiceCase {
  const milestones = deriveTowMilestones(caseItem);
  const waitState = deriveTowWaitState(caseItem);
  const progress = towStageToProgress(caseItem.tow_stage);
  const activeMilestone = milestones.find((m) => m.status === "active")
    ?? milestones[milestones.length - 1];

  return {
    ...caseItem,
    milestones,
    tasks: [],
    evidence_feed: [],
    wait_state: waitState,
    notification_intents: [],
    assigned_service: caseItem.assigned_service,
    allowed_actions: [],
    workflow_blueprint: "damage_uninsured",
    next_action_title: activeMilestone?.title ?? waitState.label,
    next_action_description:
      activeMilestone?.description ?? waitState.description,
    next_action_primary_label:
      waitState.actor === "customer" ? "Detayları aç" : "",
    next_action_secondary_label: "Süreci takip et",
    subtitle: waitState.description,
    total_label: caseItem.total_label,
    estimate_label: `%${progress} tamamlandı`,
  };
}
