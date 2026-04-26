import type { ServiceCaseStatus } from "@naro/domain";

import type {
  CaseDetailResponse,
  CaseWaitActor,
} from "./schemas/case-create";

/**
 * F-P0-2 (2026-04-23 lifecycle integrity audit L3-P0-2 —
 * Codex ana bulgusu): useCanonicalCase adapter `next_action_*`
 * alanlarını hardcoded empty string döndürüyordu → kullanıcı
 * "şu an ne yapmalıyım?" sorusuna cevap alamıyordu.
 *
 * Bu helper role-aware next_action üretir:
 * - wait_state_actor === viewerRole → kullanıcı aksiyon almalı
 *   → primary CTA doldurulur (status + role → label)
 * - wait_state_actor !== viewerRole → başkası bekleniyor
 *   → passive label + secondary "Süreci takip et"
 * - Terminal status (completed/cancelled/archived) → aksiyon yok
 *
 * BE B-P2-1 shipped olunca wait_state_* doğrudan BE'den gelir;
 * o zamana kadar null → fallback status-based label.
 */

type ViewerRole = "customer" | "technician";

type NextActionPayload = {
  next_action_title: string;
  next_action_description: string;
  next_action_primary_label: string;
  next_action_secondary_label: string | null;
};

const TERMINAL_STATUSES = new Set<ServiceCaseStatus>([
  "completed",
  "cancelled",
  "archived",
]);

const ACTOR_LABEL: Record<CaseWaitActor, string> = {
  customer: "Müşteri",
  technician: "Usta",
  system: "Sistem",
  none: "—",
};

const EMPTY: NextActionPayload = {
  next_action_title: "",
  next_action_description: "",
  next_action_primary_label: "",
  next_action_secondary_label: null,
};

/**
 * Customer viewer için status'a göre primary CTA label.
 * Technician için ayrı tablo; service app'te paralel.
 */
function customerPrimaryLabel(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
      return "Havuzu gör";
    case "offers_ready":
      return "Teklifleri incele";
    case "appointment_pending":
      return "Randevuyu gör";
    case "scheduled":
      return "Süreci takip et";
    case "service_in_progress":
      return "Güncellemeleri gör";
    case "parts_approval":
      return "Parça talebini incele";
    case "invoice_approval":
      return "Faturayı onayla";
    default:
      return "Detayları aç";
  }
}

function technicianPrimaryLabel(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
    case "offers_ready":
      return "Teklif ver";
    case "appointment_pending":
      return "Randevuyu onayla";
    case "scheduled":
      return "İşe başla";
    case "service_in_progress":
      return "Durumu güncelle";
    case "parts_approval":
      return "Parça onayı bekleniyor";
    case "invoice_approval":
      return "Fatura bekleniyor";
    default:
      return "Vakayı aç";
  }
}

function fallbackCustomerTitle(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
      return "Teklifler toplanıyor";
    case "offers_ready":
      return "Sıra sende";
    case "appointment_pending":
      return "Randevu yanıtı bekleniyor";
    case "scheduled":
      return "Randevu planlandı";
    case "service_in_progress":
      return "İşlem sürüyor";
    case "parts_approval":
      return "Parça onayın bekleniyor";
    case "invoice_approval":
      return "Fatura onayın bekleniyor";
    default:
      return "Vaka güncellemesi";
  }
}

function fallbackCustomerDescription(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
      return "Bölgendeki ustalar teklif hazırlıyor.";
    case "offers_ready":
      return "Teklifleri karşılaştır ve uygunu seç.";
    case "appointment_pending":
      return "Usta randevu talebine yanıt verecek.";
    case "scheduled":
      return "Planlanan saatte işlem başlayacak.";
    case "service_in_progress":
      return "Usta iş sürecini paylaşıyor.";
    case "parts_approval":
      return "Usta kapsam değişikliği paylaştı, onay gerekiyor.";
    case "invoice_approval":
      return "Fatura paylaşıldı, onay gerekiyor.";
    default:
      return "Vaka akışında bir güncelleme var.";
  }
}

function fallbackTechnicianTitle(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
    case "offers_ready":
      return "Yeni müşteri havuzu";
    case "appointment_pending":
      return "Randevu teklifi geldi";
    case "scheduled":
      return "Planlanmış iş";
    case "service_in_progress":
      return "Aktif iş";
    case "parts_approval":
      return "Müşteri onayı bekleniyor";
    case "invoice_approval":
      return "Fatura onayı bekleniyor";
    default:
      return "Vaka güncellemesi";
  }
}

function fallbackTechnicianDescription(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
    case "offers_ready":
      return "Eşleşen havuzda teklif verebilirsin.";
    case "appointment_pending":
      return "Müşterinin önerdiği saati onayla veya karşı öner.";
    case "scheduled":
      return "Randevu saatinde iş başlat.";
    case "service_in_progress":
      return "Müşteriye süreç güncellemesi paylaş.";
    case "parts_approval":
      return "Müşteri parça talebine yanıt verecek.";
    case "invoice_approval":
      return "Müşteri faturayı onaylayacak.";
    default:
      return "Detaya geçerek durumu kontrol et.";
  }
}

export function deriveNextAction(
  detail: CaseDetailResponse,
  viewerRole: ViewerRole,
): NextActionPayload {
  const status = detail.status;
  if (TERMINAL_STATUSES.has(status)) return EMPTY;

  const waitActor = detail.wait_state_actor ?? null;
  const waitLabel = detail.wait_state_label;
  const waitDescription = detail.wait_state_description;

  // BE wait_state_actor henüz gelmiyorsa (B-P2-1 pending) status
  // bazlı fallback.
  const isWaitingOnMe =
    waitActor !== null
      ? waitActor === viewerRole
      : inferDefaultWaitOnViewer(status, viewerRole);

  if (isWaitingOnMe) {
    return {
      next_action_title:
        waitLabel ??
        (viewerRole === "customer"
          ? fallbackCustomerTitle(status)
          : fallbackTechnicianTitle(status)),
      next_action_description:
        waitDescription ??
        (viewerRole === "customer"
          ? fallbackCustomerDescription(status)
          : fallbackTechnicianDescription(status)),
      next_action_primary_label:
        viewerRole === "customer"
          ? customerPrimaryLabel(status)
          : technicianPrimaryLabel(status),
      next_action_secondary_label: "Detayları gör",
    };
  }

  // Başkası bekleniyor — pasif durum.
  const otherActor =
    waitActor && waitActor !== "none" ? ACTOR_LABEL[waitActor] : "Diğer taraf";
  return {
    next_action_title: `${otherActor} bekleniyor`,
    next_action_description:
      waitDescription ??
      (viewerRole === "customer"
        ? fallbackCustomerDescription(status)
        : fallbackTechnicianDescription(status)),
    next_action_primary_label: "",
    next_action_secondary_label: "Süreci takip et",
  };
}

/**
 * BE wait_state null iken status + role'den varsayılan çıkarım.
 * Customer için: offer_ready/approval status'larda sıra customer'da.
 * Technician için: matching/offers_ready/scheduled/service_in_progress
 * normalde ustanın sırası.
 */
function inferDefaultWaitOnViewer(
  status: ServiceCaseStatus,
  viewerRole: ViewerRole,
): boolean {
  const customerStatuses = new Set<ServiceCaseStatus>([
    "offers_ready",
    "parts_approval",
    "invoice_approval",
  ]);
  const technicianStatuses = new Set<ServiceCaseStatus>([
    "matching",
    "appointment_pending",
    "scheduled",
    "service_in_progress",
  ]);
  if (viewerRole === "customer") return customerStatuses.has(status);
  return technicianStatuses.has(status);
}
