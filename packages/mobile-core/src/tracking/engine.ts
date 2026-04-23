import type {
  Appointment,
  AppointmentSlot,
  CaseActionType,
  CaseActor,
  CaseApproval,
  CaseAttachment,
  CaseAttachmentKind,
  CaseDelta,
  CaseDocument,
  CaseEvidenceItem,
  CaseMilestone,
  CaseMilestoneStatus,
  CaseNotificationIntent,
  CaseNotificationIntentType,
  CaseOffer,
  CaseOfferStatus,
  CaseServiceSnapshot,
  CaseTask,
  CaseTaskKind,
  CaseTaskStatus,
  CaseTone,
  CaseWaitState,
  InsuranceClaim,
  ServiceCase,
  ServiceCaseStatus,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";

import {
  getTrackingServiceSnapshot,
  getTrackingTechnicianName,
  getTrackingVehicleMeta,
} from "./directory";
import { syncTowTrackingCase } from "./tow-engine";

type TrackingTone = "accent" | "neutral" | "success" | "warning" | "critical" | "info";

export type TaskDeeplinkIntent = {
  route: string;
  label: string;
  emphasis: "primary" | "secondary";
};

export type TrackingTaskView = {
  id: string;
  kind: CaseTaskKind;
  title: string;
  description: string;
  ctaLabel: string;
  helperLabel?: string;
  status: CaseTaskStatus;
  urgency: CaseTask["urgency"];
  route: string;
};

export type TrackingMilestoneView = {
  id: string;
  title: string;
  description: string;
  status: CaseMilestoneStatus;
  badgeLabel?: string;
  tone: TrackingTone;
};

export type TrackingEvidenceView = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  kind: CaseAttachmentKind;
  tone: TrackingTone;
};

export type TrackingStageState =
  | "completed_compact"
  | "active_expanded"
  | "upcoming_visible"
  | "blocked"
  | "waiting_counterparty";

export type TrackingStageEvidencePreview = TrackingEvidenceView & {
  isNew?: boolean;
};

export type TrackingStageAction = {
  id: string;
  label: string;
  route?: string;
  emphasis: "primary" | "secondary";
  helperLabel?: string;
};

export type TrackingHeaderSummary = {
  eyebrow: string;
  title: string;
  subtitle: string;
  summaryTitle: string;
  summaryDescription: string;
  statusLabel: string;
  statusTone: TrackingTone;
  waitLabel: string;
  nextLabel: string;
  updatedAtLabel: string;
  totalLabel: string | null;
  estimateLabel: string | null;
};

export type TrackingUtilityPreviewKind =
  | "offers"
  | "documents"
  | "messages"
  | "service_profile"
  | "approvals"
  | "customer";

export type TrackingUtilityPreview = {
  id: string;
  kind: TrackingUtilityPreviewKind;
  title: string;
  subtitle: string;
  meta?: string;
  badgeLabel?: string;
  badgeTone?: TrackingTone;
  route?: string;
};

export type TrackingStage = {
  id: string;
  title: string;
  subtitle: string;
  actor: CaseActor;
  state: TrackingStageState;
  timeLabel: string;
  statusLabel: string;
  evidencePreview: TrackingStageEvidencePreview[];
  costImpact: string | null;
  waitLabel?: string;
  primaryAction: TrackingStageAction | null;
  secondaryAction: TrackingStageAction | null;
  drilldownRoute?: string;
  isNew?: boolean;
};

export type CustomerTrackingView = {
  caseId: string;
  statusLabel: string;
  statusTone: TrackingTone;
  progressValue: number;
  header: TrackingHeaderSummary;
  stages: TrackingStage[];
  primaryAction: TrackingStageAction | null;
  utilityPreviews: TrackingUtilityPreview[];
  waitState: CaseWaitState;
  vehicle: {
    plate: string;
    vehicleLabel: string;
    note?: string;
  } | null;
  focusWindow: {
    eyebrow: string;
    title: string;
    description: string;
    summary: string;
    updatedAtLabel: string;
    totalLabel: string | null;
    estimateLabel: string | null;
  };
  pastSpine: TrackingMilestoneView[];
  horizon: TrackingMilestoneView[];
  recentProof: TrackingEvidenceView[];
  delta: CaseDelta[];
  primaryTask: TrackingTaskView | null;
  secondaryTask: TrackingTaskView | null;
  serviceSummary: CaseServiceSnapshot | null;
  auditSpine: Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    tone: TrackingTone;
  }>;
  threadPreview: Array<{
    id: string;
    author: string;
    role: "customer" | "technician" | "system";
    body: string;
    meta: string;
  }>;
  notificationQueue: CaseNotificationIntent[];
};

export type TechnicianTrackingView = {
  caseId: string;
  statusLabel: string;
  statusTone: TrackingTone;
  progressValue: number;
  header: TrackingHeaderSummary;
  stages: TrackingStage[];
  primaryAction: TrackingStageAction | null;
  utilityPreviews: TrackingUtilityPreview[];
  waitState: CaseWaitState;
  customerName: string;
  vehicle: {
    plate: string;
    vehicleLabel: string;
    note?: string;
  } | null;
  focusWindow: {
    eyebrow: string;
    title: string;
    description: string;
    updatedAtLabel: string;
  };
  pastSpine: TrackingMilestoneView[];
  horizon: TrackingMilestoneView[];
  recentProof: TrackingEvidenceView[];
  delta: CaseDelta[];
  primaryTask: TrackingTaskView | null;
  commandStrip: TrackingTaskView[];
  waitingCustomerTasks: TrackingTaskView[];
  auditSpine: Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    tone: TrackingTone;
  }>;
  notificationQueue: CaseNotificationIntent[];
};

const STATUS_META: Record<
  ServiceCaseStatus,
  {
    label: string;
    tone: TrackingTone;
    progress: number;
  }
> = {
  matching: {
    label: "Eslesme suruyor",
    tone: "info",
    progress: 16,
  },
  offers_ready: {
    label: "Teklif hazir",
    tone: "accent",
    progress: 34,
  },
  appointment_pending: {
    label: "Randevu onayı bekleniyor",
    tone: "warning",
    progress: 42,
  },
  scheduled: {
    label: "Randevu hazir",
    tone: "info",
    progress: 48,
  },
  service_in_progress: {
    label: "Servis suruyor",
    tone: "success",
    progress: 68,
  },
  parts_approval: {
    label: "Parca onayi",
    tone: "warning",
    progress: 82,
  },
  invoice_approval: {
    label: "Fatura / teslim",
    tone: "critical",
    progress: 92,
  },
  completed: {
    label: "Tamamlandi",
    tone: "success",
    progress: 100,
  },
  archived: {
    label: "Arsiv",
    tone: "neutral",
    progress: 100,
  },
  cancelled: {
    label: "Iptal",
    tone: "critical",
    progress: 0,
  },
};

function toTitleCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function routeForActor(caseId: string, taskId: string, actor: CaseActor) {
  if (actor === "technician") {
    return `/is/${caseId}/gorev/${taskId}`;
  }

  return `/vaka/${caseId}/gorev/${taskId}`;
}

function mapTone(tone: CaseTone): TrackingTone {
  return tone === "neutral" ? "info" : tone;
}

function nextActionForStatus(status: ServiceCaseStatus, caseItem: ServiceCase) {
  switch (status) {
    case "matching":
      return {
        title: "Eslesme sahnesi acik",
        description:
          "Yakin servisler, teslim modu ve ilk kapsam birlikte taraniyor.",
        primary: "Durumu yenile",
        secondary: "Ustalari ac",
      };
    case "offers_ready":
      return {
        title: "Karar penceresi acik",
        description:
          "Fiyat, sure, guvence ve teslim modu ayni ritimde karsilastirilmaya hazir.",
        primary: "Teklifleri incele",
        secondary: caseItem.assigned_service ? "Servise yaz" : null,
      };
    case "appointment_pending":
      return {
        title: "Randevu onayı bekleniyor",
        description:
          "Randevu talebi ustaya iletildi. 24 saat içinde onay veya red bekleniyor.",
        primary: "Randevuyu iptal et",
        secondary: "Servise yaz",
      };
    case "scheduled":
      return {
        title: "Randevu baglami netlesmeli",
        description:
          "Teslim saati, pickup modu ve ilk kabul notu son kez hizalaniyor.",
        primary: "Randevuyu onayla",
        secondary: "Servise yaz",
      };
    case "service_in_progress":
      return {
        title: "Surec canli akiyor",
        description:
          "Usta kanit, not ve ilerleme bilgisini yuklemeye devam ediyor.",
        primary: "Sureci gor",
        secondary: "Servise yaz",
      };
    case "parts_approval":
      return {
        title: "Parca ve kapsam karari bekleniyor",
        description:
          "Servis gerekceyi ve gorsel kaniti paylasti; akisin devami bu onaya bagli.",
        primary: "Parca onayini ver",
        secondary: "Servise yaz",
      };
    case "invoice_approval": {
      const hasCompletion = caseItem.pending_approvals.some(
        (approval) =>
          approval.kind === "completion" && approval.status === "pending",
      );

      return hasCompletion
        ? {
            title: "Teslim son dogrulamasi bekleniyor",
            description:
              "Son fotograflar ve teslim notlari hazir; son teyit ile vaka kapanacak.",
            primary: "Teslimi onayla",
            secondary: "Belgeyi gor",
          }
        : {
            title: "Fatura ve teslim ozeti hazir",
            description:
              "Maliyet ve son notlar net; onay geldikten sonra evrak izi tamamlanacak.",
            primary: "Faturayi onayla",
            secondary: "Belgeyi gor",
          };
    }
    case "completed":
      return {
        title: "Surec kayda alindi",
        description:
          "Garanti, evrak ve son mesajlar bu vakada denetim izi olarak saklaniyor.",
        primary: "Belgeleri ac",
        secondary: "Benzer talep baslat",
      };
    case "archived":
      return {
        title: "Arsiv kaydi",
        description:
          "Kararlar ve kanit izi arsivde duruyor; ayni senaryo icin yeniden talep acilabilir.",
        primary: "Belgeleri ac",
        secondary: "Benzer talep baslat",
      };
    case "cancelled":
      return {
        title: "Talep durduruldu",
        description:
          "Dilersen yeni bir kapsamla ayni arac icin yeniden akisa girebilirsin.",
        primary: "Yeni talep baslat",
        secondary: null,
      };
  }
}

function determineBlueprint(caseItem: ServiceCase) {
  if (caseItem.kind === "maintenance") {
    return (caseItem.request.mileage_km ?? 0) >= 70000
      ? "maintenance_major"
      : "maintenance_standard";
  }

  if (caseItem.kind === "accident" && caseItem.request.counterparty_note) {
    return "damage_insured";
  }

  return "damage_uninsured";
}

function createMilestone(
  caseId: string,
  key: string,
  sequence: number,
  title: string,
  description: string,
  actor: CaseActor,
  status: CaseMilestoneStatus,
  badgeLabel?: string,
  blockerReason?: string,
): CaseMilestone {
  return {
    id: `milestone-${caseId}-${key}`,
    key,
    title,
    description,
    actor,
    sequence,
    status,
    badge_label: badgeLabel,
    blocker_reason: blockerReason,
    related_task_ids: [],
  };
}

type MilestoneSeed = readonly [
  key: string,
  title: string,
  description: string,
  actor: CaseActor,
];

function buildMilestones(caseItem: ServiceCase): CaseMilestone[] {
  const blueprint = determineBlueprint(caseItem);
  const repairFlow: MilestoneSeed[] =
    blueprint === "damage_insured"
      ? [
          ["intake", "Giris ve guvenlik", "Ilk hasar alani, konum ve kabul bilgisi toplaniyor.", "system"],
          ["insurance", "Sigorta ve ekspertiz", "Dosya numarasi, eksper geri donusu ve kapsam netlesiyor.", "system"],
          ["approval", "Karar ve onay", "Teklif, parca veya kapsam karari bu kapida veriliyor.", "customer"],
          ["repair", "Onarim", "Servis kanit yukleyerek aktif islemi yurutu yor.", "technician"],
          ["delivery", "Teslim", "Son kontrol, fatura ve teslim kaniti kapanisi hazirliyor.", "customer"],
        ]
      : blueprint === "maintenance_standard"
        ? [
            ["intake", "Kabul", "Bakim brief'i ve kilometre baglami toplaniyor.", "system"],
            ["scope", "Bakim kapsami", "Degisecek kalemler ve zaman penceresi netlesiyor.", "customer"],
            ["service", "Bakim islemi", "Servis kontrol ve uygulama adimlarini paylasiyor.", "technician"],
            ["quality", "Son kontrol", "Fatura, test ve teslim hazirligi toparlaniyor.", "technician"],
            ["delivery", "Teslim", "Musteri son ozet ve evraklari goruyor.", "customer"],
          ]
        : blueprint === "maintenance_major"
          ? [
              ["intake", "Kabul", "Bakim brief'i ve kilometre baglami toplaniyor.", "system"],
              ["scope", "Genis bakim kapsami", "Ek kalemler ve olasi parca ihtiyaci netlesiyor.", "customer"],
              ["service", "Bakim islemi", "Servis kontrol ve uygulama adimlarini paylasiyor.", "technician"],
              ["quality", "Kalite ve fatura", "Ek kalemler, fatura ve test ozeti kapanisa yaklasiyor.", "technician"],
              ["delivery", "Teslim", "Musteri son ozet ve evraklari goruyor.", "customer"],
            ]
          : [
              ["intake", "Giris ve teshis", "Belirti, teslim modu ve ilk tani bilgisi toplaniyor.", "system"],
              ["diagnosis", "Teshis", "Kapsam ve riskler gorsel kanit ile netlestiriliyor.", "technician"],
              ["approval", "Karar ve onay", "Teklif, parca veya randevu karari bu kapida veriliyor.", "customer"],
              ["repair", "Onarim", "Servis kanit yukleyerek aktif islemi yurutu yor.", "technician"],
              ["delivery", "Teslim", "Son kontrol ve teslim kaniti kapanisi hazirliyor.", "customer"],
            ];

  const activeIndexByStatus: Record<ServiceCaseStatus, number> = {
    matching: 0,
    offers_ready: 2,
    appointment_pending: 2,
    scheduled: 2,
    service_in_progress: 3,
    parts_approval: 2,
    invoice_approval: 4,
    completed: repairFlow.length - 1,
    archived: repairFlow.length - 1,
    cancelled: 0,
  };

  const completedUntilByStatus: Record<ServiceCaseStatus, number> = {
    matching: -1,
    offers_ready: 1,
    appointment_pending: 1,
    scheduled: 1,
    service_in_progress: 2,
    parts_approval: 1,
    invoice_approval: 3,
    completed: repairFlow.length - 1,
    archived: repairFlow.length - 1,
    cancelled: -1,
  };

  return repairFlow.map(([key, title, description, actor], index) => {
    const status: CaseMilestoneStatus =
      caseItem.status === "cancelled"
        ? index === 0
          ? "blocked"
          : "upcoming"
        : index <= completedUntilByStatus[caseItem.status]
          ? "completed"
          : index === activeIndexByStatus[caseItem.status]
            ? "active"
            : caseItem.status === "parts_approval" && index === 3
              ? "blocked"
              : "upcoming";

    const blockerReason =
      caseItem.status === "parts_approval" && index === 3
        ? "Musteri onayi gelmeden iscilik ve parca akisinda ileri gecilmez."
        : undefined;

    const badgeLabel =
      status === "active"
        ? "Simdi"
        : status === "completed"
          ? "Tamamlandi"
          : status === "blocked"
            ? "Bekliyor"
            : undefined;

    return createMilestone(
      caseItem.id,
      key,
      index,
      title,
      description,
      actor,
      status,
      badgeLabel,
      blockerReason,
    );
  });
}

function createTask(
  caseId: string,
  milestoneId: string,
  key: string,
  actor: CaseActor,
  kind: CaseTaskKind,
  title: string,
  description: string,
  ctaLabel: string,
  status: CaseTaskStatus,
  urgency: CaseTask["urgency"],
  options: Partial<
    Pick<
      CaseTask,
      | "helper_label"
      | "blocker_reason"
      | "related_offer_ids"
      | "related_approval_id"
      | "related_document_ids"
      | "evidence_requirements"
    >
  > = {},
): CaseTask {
  return {
    id: `task-${caseId}-${key}`,
    kind,
    title,
    description,
    actor,
    milestone_id: milestoneId,
    status,
    urgency,
    cta_label: ctaLabel,
    helper_label: options.helper_label,
    blocker_reason: options.blocker_reason,
    related_offer_ids: options.related_offer_ids ?? [],
    related_approval_id: options.related_approval_id ?? null,
    related_document_ids: options.related_document_ids ?? [],
    evidence_requirements: options.evidence_requirements ?? [],
  };
}

function addMilestoneTask(milestones: CaseMilestone[], task: CaseTask) {
  const milestone = milestones.find((item) => item.id === task.milestone_id);

  if (milestone) {
    milestone.related_task_ids.push(task.id);
  }
}

function findPendingApproval(caseItem: ServiceCase, kind: CaseApproval["kind"]) {
  return (
    caseItem.pending_approvals.find(
      (approval) => approval.kind === kind && approval.status === "pending",
    ) ?? null
  );
}

function getMilestoneId(
  milestoneByKey: Record<string, string>,
  ...keys: string[]
) {
  for (const key of keys) {
    const milestoneId = milestoneByKey[key];

    if (milestoneId) {
      return milestoneId;
    }
  }

  throw new Error(`Missing milestone key(s): ${keys.join(", ")}`);
}

function buildTasks(caseItem: ServiceCase, milestones: CaseMilestone[]) {
  const milestoneByKey = Object.fromEntries(
    milestones.map((milestone) => [milestone.key, milestone.id]),
  ) as Record<string, string>;
  const tasks: CaseTask[] = [];

  const partsApproval = findPendingApproval(caseItem, "parts_request");
  const invoiceApproval = findPendingApproval(caseItem, "invoice");
  const completionApproval = findPendingApproval(caseItem, "completion");

  switch (caseItem.status) {
    case "matching":
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "intake"),
          "customer-refresh-matching",
          "customer",
          "refresh_matching",
          "Eslesmeyi tazele",
          "Sistemin topladigi yeni servis ve teslim modu sinyallerini guncelle.",
          "Durumu yenile",
          "active",
          "soon",
        ),
      );
      break;
    case "offers_ready":
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "approval", "scope"),
          "customer-review-offers",
          "customer",
          "review_offers",
          "Teklifleri karsilastir",
          "Kapsam, sure ve guvenceyi tek bir karar ekraninda oku.",
          "Teklifleri ac",
          "active",
          "now",
          {
            related_offer_ids: caseItem.offers
              .filter((offer) => offer.status !== "rejected")
              .map((offer) => offer.id),
          },
        ),
      );
      break;
    case "scheduled":
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "approval", "scope"),
          "customer-confirm-appointment",
          "customer",
          "confirm_appointment",
          "Randevu ve teslim modunu teyit et",
          "Pickup saati, teslim beklentisi ve ilk kabul notunu netlestir.",
          "Randevuyu onayla",
          "active",
          "now",
        ),
      );
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "repair", "service"),
          "technician-intake-proof",
          "technician",
          "upload_intake_proof",
          "Ilk kabul kanitini yukle",
          "Arac teslim alindiginda ilk gorseller ve kabul notu sisteme dussun.",
          "Gorsel yukle",
          "active",
          "now",
          {
            evidence_requirements: [
              {
                id: `evidence-${caseItem.id}-intake-photo`,
                title: "Ilk kabul fotografi",
                kind: "photo",
                required: true,
                hint: "Kaporta / genel durum gorunsun.",
              },
            ],
          },
        ),
      );
      break;
    case "service_in_progress":
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "repair", "service"),
          "customer-review-progress",
          "customer",
          "review_progress",
          "Canli sureci oku",
          "En son eklenen kanit, not ve sonraki esigi tek yerde gor.",
          "Sureci gor",
          "active",
          "soon",
        ),
      );
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "repair", "service"),
          "technician-progress-proof",
          "technician",
          "upload_progress_proof",
          "Ilerleme kaniti yukle",
          "Yapilan islemi once / sonra mantigiyla gorsellestir.",
          "Gorsel yukle",
          "active",
          "now",
          {
            evidence_requirements: [
              {
                id: `evidence-${caseItem.id}-progress-photo`,
                title: "Ilerleme fotografi",
                kind: "photo",
                required: true,
                hint: "Mudahale edilen alan net gorunsun.",
              },
              {
                id: `evidence-${caseItem.id}-progress-video`,
                title: "Kisa video / ses",
                kind: "video",
                required: false,
                hint: "Ses, titresim veya test anini goster.",
              },
            ],
          },
        ),
      );
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "repair", "service"),
          "technician-status-update",
          "technician",
          "share_status_update",
          "Durum notu ekle",
          "Musteri neden bu noktada oldugunuzu bir cümlede anlasin.",
          "Not ekle",
          "pending",
          "soon",
        ),
      );
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "approval", "scope"),
          "technician-parts-request",
          "technician",
          "request_parts_approval",
          "Parca veya ek kapsam iste",
          "Gerekirse maliyet etkisini ve gorsel kaniti ekleyerek yeni bir onay cikar.",
          "Parca talebi ac",
          caseItem.kind === "maintenance" ? "blocked" : "pending",
          caseItem.kind === "maintenance" ? "background" : "soon",
          {
            blocker_reason:
              caseItem.kind === "maintenance"
                ? "Bu bakım akisi ek parca onayi yerine kalite ve fatura adimina yakindir."
                : undefined,
          },
        ),
      );
      break;
    case "parts_approval":
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "approval", "scope"),
          "customer-approve-parts",
          "customer",
          "approve_parts",
          "Parca kararini ver",
          "Gerekce, kanit ve maliyet etkisini okuyup akisi serbest birak.",
          "Parca onayini ver",
          "active",
          "now",
          {
            related_approval_id: partsApproval?.id ?? null,
            related_document_ids: partsApproval?.evidence_document_ids ?? [],
          },
        ),
      );
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "approval", "scope"),
          "technician-parts-update",
          "technician",
          "share_status_update",
          "Parca gerekcesini guclendir",
          "Musteri beklerken ek not, video veya yakin plan gorsel ekleyebilirsin.",
          "Not ekle",
          "active",
          "soon",
        ),
      );
      break;
    case "invoice_approval":
      if (completionApproval) {
        tasks.push(
          createTask(
            caseItem.id,
            getMilestoneId(milestoneByKey, "delivery"),
            "customer-confirm-completion",
            "customer",
            "confirm_completion",
            "Teslimi dogrula",
            "Son gorseller ve teslim notu beklendigi gibiyse vakayi kapat.",
            "Teslimi onayla",
            "active",
            "now",
            {
              related_approval_id: completionApproval.id,
              related_document_ids: completionApproval.evidence_document_ids,
            },
          ),
        );
      } else {
        tasks.push(
          createTask(
            caseItem.id,
            getMilestoneId(milestoneByKey, "delivery"),
            "customer-approve-invoice",
            "customer",
            "approve_invoice",
            "Faturayi ve teslim ozetini onayla",
            "Maliyet kalemleri ve son notlar beklendigi gibiyse surec kapanisa gecer.",
            "Faturayi onayla",
            "active",
            "now",
            {
              related_approval_id: invoiceApproval?.id ?? null,
              related_document_ids: invoiceApproval?.evidence_document_ids ?? [],
            },
          ),
        );
      }

      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "delivery"),
          "technician-delivery-proof",
          "technician",
          "upload_delivery_proof",
          "Teslim oncesi son kaniti yukle",
          "Arac teslimden once son fotograflari ve notu sisteme koy.",
          "Son gorseli ekle",
          "active",
          "soon",
          {
            evidence_requirements: [
              {
                id: `evidence-${caseItem.id}-delivery-photo`,
                title: "Son durum fotografi",
                kind: "photo",
                required: true,
                hint: "Teslimde gorulecek genel durum.",
              },
            ],
          },
        ),
      );
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "delivery"),
          "technician-ready-for-delivery",
          "technician",
          "mark_ready_for_delivery",
          "Teslime hazir durumuna gec",
          "Son kanit yuklendikten sonra teslim teyidini beklemeye al.",
          "Teslime hazir yap",
          completionApproval ? "completed" : "pending",
          "soon",
        ),
      );
      break;
    case "completed":
    case "archived":
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "delivery"),
          "customer-open-documents",
          "customer",
          "open_documents",
          "Evrak ve garanti izini ac",
          "Surecin sonunda biriken kanit ve belgeleri tek yerde incele.",
          "Belgeleri ac",
          "active",
          "background",
        ),
      );
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "delivery"),
          "customer-start-similar",
          "customer",
          "start_similar_request",
          "Benzer talep baslat",
          "Ayni aracta yeni bir bakim veya hasar brief'ini hizli baslat.",
          "Yeni talep baslat",
          "pending",
          "background",
        ),
      );
      break;
    case "cancelled":
      tasks.push(
        createTask(
          caseItem.id,
          getMilestoneId(milestoneByKey, "intake"),
          "customer-restart",
          "customer",
          "start_similar_request",
          "Yeni akisi yeniden kur",
          "Bu vaka durduruldu; istersen ayni aracta taze brief ile yeniden basla.",
          "Yeni talep baslat",
          "active",
          "background",
        ),
      );
      break;
  }

  for (const task of tasks) {
    addMilestoneTask(milestones, task);
  }

  return tasks;
}

function buildBaseEvidenceFeed(caseItem: ServiceCase) {
  const fromAttachments: CaseEvidenceItem[] = caseItem.attachments.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    kind: item.kind,
    actor: "customer",
    source_label: "Talep eki",
    status_label: item.statusLabel ?? "Hazir",
    created_at: caseItem.created_at,
    created_at_label: caseItem.created_at_label,
    task_id: null,
    milestone_id: null,
    is_new: false,
    asset: item.asset ?? null,
  }));

  const fromDocuments: CaseEvidenceItem[] = caseItem.documents.map((item) => ({
    id: `evidence-${item.id}`,
    title: item.title,
    subtitle: item.subtitle,
    kind: item.kind,
    actor: item.source_label.toLowerCase().includes("servis")
      ? "technician"
      : "system",
    source_label: item.source_label,
    status_label: item.status_label,
    created_at: item.created_at,
    created_at_label: item.created_at_label,
    task_id: null,
    milestone_id: null,
    is_new: false,
    asset: item.asset ?? null,
  }));

  const keyed = new Map<string, CaseEvidenceItem>();

  for (const item of [...fromAttachments, ...fromDocuments, ...caseItem.evidence_feed]) {
    keyed.set(item.id, item);
  }

  return [...keyed.values()].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

function buildWaitState(caseItem: ServiceCase): CaseWaitState {
  switch (caseItem.status) {
    case "matching":
      return {
        actor: "system",
        label: "Platform tarama yapiyor",
        description: "Uygun servisler ve teslim modu birlikte esitleniyor.",
      };
    case "offers_ready":
      return {
        actor: "customer",
        label: "Karar sende",
        description: "Tekliflerden birini secmeden akisin sonraki esigi acilmaz.",
      };
    case "appointment_pending":
      return {
        actor: "technician",
        label: "Usta yanıtı bekleniyor",
        description: "Randevu talebi ustaya iletildi. 24 saat içinde onay beklenir.",
      };
    case "scheduled":
      return {
        actor: "customer",
        label: "Randevu teyidi bekleniyor",
        description: "Pickup / kabul saati netlestiginde servis hazirlik yapacak.",
      };
    case "service_in_progress":
      return {
        actor: "technician",
        label: "Usta sahnede",
        description: "Kanıt, not ve teknik ilerleme su an servis tarafindan besleniyor.",
      };
    case "parts_approval":
      return {
        actor: "customer",
        label: "Musteri onayi bekleniyor",
        description: "Parca ve maliyet gerekcesi paylasildi; onay geldiginde onarim serbest kalacak.",
      };
    case "invoice_approval":
      return {
        actor: "customer",
        label: "Musteri son teyidi bekleniyor",
        description: "Fatura veya teslim teyidi geldikten sonra vaka kapanisa gecer.",
      };
    case "completed":
    case "archived":
      return {
        actor: "none",
        label: "Bekleyen taraf yok",
        description: "Surec kapandi; evrak ve garanti izi okunabilir.",
      };
    case "cancelled":
      return {
        actor: "none",
        label: "Surec durduruldu",
        description: "Yeni bir brief acilana kadar bekleyen bir taraf yok.",
      };
  }
}

function allowedActionsForStatus(
  status: ServiceCaseStatus,
  hasAssignedService: boolean,
): CaseActionType[] {
  switch (status) {
    case "matching":
      return ["refresh_matching", "change_service_preference", "cancel_case"];
    case "offers_ready":
      return hasAssignedService
        ? ["open_offers", "message_service", "cancel_case"]
        : ["open_offers", "cancel_case"];
    case "appointment_pending":
      return ["cancel_appointment", "message_service", "cancel_case"];
    case "scheduled":
      return [
        "confirm_appointment",
        "message_service",
        "open_documents",
        "cancel_case",
      ];
    case "service_in_progress":
      return ["open_documents", "message_service", "cancel_case"];
    case "parts_approval":
      return [
        "approve_parts",
        "message_service",
        "open_documents",
        "cancel_case",
      ];
    case "invoice_approval":
      return [
        "approve_invoice",
        "confirm_completion",
        "message_service",
        "open_documents",
        "cancel_case",
      ];
    case "completed":
    case "archived":
      return ["open_documents", "start_similar_request"];
    case "cancelled":
      return ["start_similar_request"];
  }
}

function taskPriority(task: CaseTask) {
  const statusRank: Record<CaseTaskStatus, number> = {
    active: 0,
    pending: 1,
    blocked: 2,
    completed: 3,
  };
  const urgencyRank: Record<CaseTask["urgency"], number> = {
    now: 0,
    soon: 1,
    background: 2,
  };

  return statusRank[task.status] * 10 + urgencyRank[task.urgency];
}

export function getPrimaryTask(caseItem: ServiceCase, actor: CaseActor) {
  return (
    [...caseItem.tasks]
      .filter((task) => task.actor === actor && task.status !== "completed")
      .sort((left, right) => taskPriority(left) - taskPriority(right))[0] ?? null
  );
}

function notificationTypeForTask(task: CaseTask): CaseNotificationIntentType {
  switch (task.kind) {
    case "review_offers":
      return "quote_ready";
    case "confirm_appointment":
      return "appointment_confirmation";
    case "approve_parts":
    case "confirm_completion":
      return "customer_approval_needed";
    case "approve_invoice":
      return "payment_review";
    case "upload_intake_proof":
    case "upload_progress_proof":
    case "upload_delivery_proof":
      return "evidence_missing";
    case "share_status_update":
    case "request_parts_approval":
    case "share_invoice":
    case "mark_ready_for_delivery":
      return "status_update_required";
    default:
      return "delivery_ready";
  }
}

function buildNotificationIntents(caseItem: ServiceCase) {
  return caseItem.tasks
    .filter((task) => task.status === "active")
    .map((task) => ({
      id: `intent-${caseItem.id}-${task.id}`,
      type: notificationTypeForTask(task),
      actor: task.actor,
      title: task.title,
      body: task.description,
      task_id: task.id,
      route_hint: routeForActor(caseItem.id, task.id, task.actor),
      is_new: false,
    }));
}

function buildNextActionFields(caseItem: ServiceCase) {
  const next = nextActionForStatus(caseItem.status, caseItem);
  return {
    next_action_title: next.title,
    next_action_description: next.description,
    next_action_primary_label: next.primary,
    next_action_secondary_label: next.secondary,
  };
}

export function getTrackingStatusLabel(status: ServiceCaseStatus) {
  return STATUS_META[status].label;
}

export function getTrackingStatusTone(status: ServiceCaseStatus) {
  return STATUS_META[status].tone;
}

export function getTrackingProgressValue(status: ServiceCaseStatus) {
  return STATUS_META[status].progress;
}

export function getProcessHorizon(caseItem: ServiceCase) {
  const completed = caseItem.milestones
    .filter((milestone) => milestone.status === "completed")
    .slice(-2);
  const active =
    caseItem.milestones.find((milestone) => milestone.status === "active") ??
    null;
  const upcoming = caseItem.milestones
    .filter(
      (milestone) =>
        milestone.status === "upcoming" || milestone.status === "blocked",
    )
    .slice(0, 3);

  return {
    completed,
    active,
    upcoming,
  };
}

export function getRecentProof(caseItem: ServiceCase) {
  return caseItem.evidence_feed.slice(0, 4);
}

export function getSinceLastSeenDelta(
  caseItem: ServiceCase,
  actor: "customer" | "technician",
) {
  const seenAt = caseItem.last_seen_by_actor[actor];
  const eventDeltas: CaseDelta[] = caseItem.events.map((event) => ({
    id: `delta-${event.id}`,
    kind: event.type === "message" ? "message" : "status",
    title: event.title,
    body: event.body,
    created_at: event.created_at,
    created_at_label: event.created_at_label,
    tone: event.tone,
  }));
  const evidenceDeltas: CaseDelta[] = caseItem.evidence_feed.map((item) => ({
    id: `delta-${item.id}`,
    kind: "evidence",
    title: item.title,
    body: `${item.source_label} · ${item.status_label}`,
    created_at: item.created_at,
    created_at_label: item.created_at_label,
    tone: item.actor === "technician" ? "info" : "accent",
  }));
  const approvalDeltas: CaseDelta[] = caseItem.pending_approvals.map((approval) => ({
    id: `delta-${approval.id}`,
    kind: "approval",
    title: approval.title,
    body: approval.description,
    created_at: approval.requested_at,
    created_at_label: approval.requested_at_label,
    tone: approval.kind === "invoice" ? "critical" : "warning",
  }));

  const merged = [...eventDeltas, ...evidenceDeltas, ...approvalDeltas].sort(
    (left, right) => right.created_at.localeCompare(left.created_at),
  );

  if (!seenAt) {
    return merged.slice(0, 3);
  }

  return merged.filter((item) => item.created_at > seenAt).slice(0, 4);
}

export function getTaskDeeplinkIntent(
  caseItem: ServiceCase,
  task: CaseTask,
  actor: CaseActor,
): TaskDeeplinkIntent {
  const route = routeForActor(caseItem.id, task.id, actor);
  return {
    route,
    label: task.cta_label,
    emphasis: task.urgency === "now" ? "primary" : "secondary",
  };
}

export function syncTrackingCase(caseItem: ServiceCase): ServiceCase {
  // F-P1-1 (2026-04-23): kind dispatch. Tow case stage-first engine'i
  // kullanır; generic shell-first derivation mock-ServiceCase'in tow
  // aşamalarını "service_in_progress"a sıkıştırıyordu. Canonical
  // adapter subtype.tow_stage'i ServiceCase.tow_stage'e projekte eder.
  if (caseItem.kind === "towing" && caseItem.tow_stage) {
    return syncTowTrackingCase(caseItem);
  }
  const workflowBlueprint = determineBlueprint(caseItem);
  const milestones = buildMilestones(caseItem);
  const tasks = buildTasks(caseItem, milestones);
  const evidenceFeed = buildBaseEvidenceFeed(caseItem);
  const waitState = buildWaitState(caseItem);
  const hasAssignedService = Boolean(
    caseItem.assigned_technician_id || caseItem.preferred_technician_id,
  );
  const assignedService =
    caseItem.assigned_service ??
    getTrackingServiceSnapshot(
      caseItem.assigned_technician_id ?? caseItem.preferred_technician_id,
      caseItem.assigned_technician_id
        ? "Aktif servis"
        : caseItem.preferred_technician_id
          ? "Shortlist'teki servis"
          : undefined,
    );
  const nextAction = buildNextActionFields(caseItem);
  const technicianName =
    assignedService?.name ??
    getTrackingTechnicianName(caseItem.assigned_technician_id);

  const baseSummary =
    technicianName && caseItem.status !== "matching"
      ? `${technicianName} ile ilerleyen surec. ${nextAction.next_action_description}`
      : caseItem.summary;

  const notificationIntents = buildNotificationIntents({
    ...caseItem,
    milestones,
    tasks,
    evidence_feed: evidenceFeed,
    wait_state: waitState,
  });

  return {
    ...caseItem,
    workflow_blueprint: workflowBlueprint,
    milestones,
    tasks,
    evidence_feed: evidenceFeed,
    wait_state: waitState,
    notification_intents: notificationIntents,
    assigned_service: assignedService,
    allowed_actions: allowedActionsForStatus(caseItem.status, hasAssignedService),
    summary: baseSummary,
    subtitle: nextAction.next_action_description,
    ...nextAction,
  };
}

function createTaskView(caseItem: ServiceCase, task: CaseTask): TrackingTaskView {
  return {
    id: task.id,
    kind: task.kind,
    title: task.title,
    description: task.description,
    ctaLabel: task.cta_label,
    helperLabel: task.helper_label,
    status: task.status,
    urgency: task.urgency,
    route: routeForActor(caseItem.id, task.id, task.actor),
  };
}

function toMilestoneView(milestone: CaseMilestone): TrackingMilestoneView {
  const tone =
    milestone.status === "completed"
      ? "success"
      : milestone.status === "active"
        ? "accent"
        : milestone.status === "blocked"
          ? "warning"
          : "neutral";

  return {
    id: milestone.id,
    title: milestone.title,
    description: milestone.blocker_reason ?? milestone.description,
    status: milestone.status,
    badgeLabel: milestone.badge_label,
    tone,
  };
}

function toEvidenceView(item: CaseEvidenceItem): TrackingEvidenceView {
  return {
    id: item.id,
    title: item.title,
    subtitle: `${item.source_label} · ${item.status_label}${item.subtitle ? ` · ${item.subtitle}` : ""}`,
    meta: item.created_at_label,
    kind: item.kind,
    tone:
      item.actor === "technician"
        ? "info"
        : item.actor === "customer"
          ? "accent"
          : "neutral",
  };
}

function waitTone(actor: CaseWaitState["actor"]): TrackingTone {
  if (actor === "customer") {
    return "warning";
  }

  if (actor === "technician") {
    return "accent";
  }

  return "info";
}

function buildFocusEyebrow(caseItem: ServiceCase) {
  switch (caseItem.status) {
    case "matching":
      return "Teklif aranıyor";
    case "offers_ready":
      return "Karar senin";
    case "appointment_pending":
      return "Usta yanıtı bekleniyor";
    case "scheduled":
      return "Randevu yakın";
    case "service_in_progress":
      return "Usta sahada";
    case "parts_approval":
      return "Parça onayın bekleniyor";
    case "invoice_approval":
      return "Teslime yakın";
    case "completed":
    case "archived":
      return "Tamamlandı";
    case "cancelled":
      return "İptal edildi";
  }
}

function buildStageAction(
  caseItem: ServiceCase,
  task: CaseTask,
  emphasis: "primary" | "secondary",
): TrackingStageAction {
  return {
    id: task.id,
    label: task.cta_label,
    route: routeForActor(caseItem.id, task.id, task.actor),
    emphasis,
    helperLabel: task.helper_label,
  };
}

function approvalRoute(caseItem: ServiceCase, approvalId: string) {
  return `/vaka/${caseItem.id}/onay/${approvalId}`;
}

function offersRoute(caseItem: ServiceCase) {
  return `/vaka/${caseItem.id}/teklifler`;
}

function documentsRoute(caseItem: ServiceCase) {
  return `/vaka/${caseItem.id}/belgeler`;
}

function messagesRoute(caseItem: ServiceCase) {
  return `/vaka/${caseItem.id}/mesajlar`;
}

function primaryViewerLabel(actor: "customer" | "technician") {
  return actor === "customer" ? "Karar sende" : "Sira sende";
}

function viewerTasksForMilestone(
  caseItem: ServiceCase,
  milestone: CaseMilestone,
  actor?: "customer" | "technician",
) {
  return caseItem.tasks
    .filter(
      (task) =>
        task.milestone_id === milestone.id &&
        (actor ? task.actor === actor : true) &&
        task.status !== "completed",
    )
    .sort((left, right) => taskPriority(left) - taskPriority(right));
}

function approvalsForMilestone(caseItem: ServiceCase, tasks: CaseTask[]) {
  const approvalIds = new Set(
    tasks
      .map((task) => task.related_approval_id)
      .filter((approvalId): approvalId is string => Boolean(approvalId)),
  );

  if (approvalIds.size > 0) {
    return caseItem.pending_approvals.filter((approval) => approvalIds.has(approval.id));
  }

  const milestoneId = tasks[0]?.milestone_id ?? "";
  const milestone = caseItem.milestones.find((item) => item.id === milestoneId);

  if (!milestone) {
    return [];
  }

  if (["approval", "scope"].includes(milestone.key)) {
    return caseItem.pending_approvals.filter(
      (approval) =>
        approval.status === "pending" && approval.kind === "parts_request",
    );
  }

  if (milestone.key === "delivery") {
    return caseItem.pending_approvals.filter(
      (approval) =>
        approval.status === "pending" &&
        (approval.kind === "invoice" || approval.kind === "completion"),
    );
  }

  return [];
}

function documentsForMilestone(
  caseItem: ServiceCase,
  milestone: CaseMilestone,
  tasks: CaseTask[],
  approvals: CaseApproval[],
) {
  const documentIds = new Set<string>();

  for (const task of tasks) {
    task.related_document_ids.forEach((id) => documentIds.add(id));
  }

  for (const approval of approvals) {
    approval.evidence_document_ids.forEach((id) => documentIds.add(id));
  }

  let documents = caseItem.documents.filter((documentItem) =>
    documentIds.has(documentItem.id),
  );

  if (milestone.key === "intake") {
    documents = [
      ...documents,
      ...caseItem.documents.filter(
        (documentItem) =>
          documentItem.source_label.toLowerCase().includes("platform") ||
          documentItem.source_label.toLowerCase().includes("talep") ||
          documentItem.title.toLowerCase().includes("kabul"),
      ),
    ];
  }

  if (milestone.key === "delivery") {
    documents = [
      ...documents,
      ...caseItem.documents.filter(
        (documentItem) =>
          documentItem.kind === "invoice" ||
          documentItem.title.toLowerCase().includes("teslim") ||
          documentItem.title.toLowerCase().includes("fatura"),
      ),
    ];
  }

  return [...new Map(documents.map((item) => [item.id, item])).values()];
}

function evidencePreviewFromDocument(
  documentItem: CaseDocument,
  seenAt: string | null,
): TrackingStageEvidencePreview {
  return {
    id: documentItem.id,
    title: documentItem.title,
    subtitle: `${documentItem.source_label} · ${documentItem.status_label}${documentItem.subtitle ? ` · ${documentItem.subtitle}` : ""}`,
    meta: documentItem.created_at_label,
    kind: documentItem.kind,
    tone: documentItem.source_label.toLowerCase().includes("servis")
      ? "info"
      : "neutral",
    isNew: Boolean(seenAt && documentItem.created_at > seenAt),
  };
}

function evidencePreviewFromEvidence(
  item: CaseEvidenceItem,
  seenAt: string | null,
): TrackingStageEvidencePreview {
  return {
    ...toEvidenceView(item),
    isNew: Boolean(seenAt && item.created_at > seenAt),
  };
}

function evidencePreviewForMilestone(
  caseItem: ServiceCase,
  milestone: CaseMilestone,
  tasks: CaseTask[],
  approvals: CaseApproval[],
  actor: "customer" | "technician",
) {
  const seenAt = caseItem.last_seen_by_actor[actor];
  const taskIds = new Set(tasks.map((task) => task.id));
  let evidence = caseItem.evidence_feed.filter(
    (item) =>
      item.milestone_id === milestone.id ||
      (item.task_id ? taskIds.has(item.task_id) : false),
  );

  if (!evidence.length && milestone.key === "intake") {
    evidence = caseItem.evidence_feed.filter(
      (item) =>
        item.source_label.toLowerCase().includes("talep") ||
        item.source_label.toLowerCase().includes("kabul"),
    );
  }

  if (
    !evidence.length &&
    ["repair", "service", "quality"].includes(milestone.key)
  ) {
    evidence = caseItem.evidence_feed.filter((item) => item.actor === "technician");
  }

  const documents = documentsForMilestone(caseItem, milestone, tasks, approvals);
  const previews = [
    ...evidence.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      preview: evidencePreviewFromEvidence(item, seenAt),
    })),
    ...documents.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      preview: evidencePreviewFromDocument(item, seenAt),
    })),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .filter(
      (item, index, collection) =>
        collection.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .slice(0, 2)
    .map((item) => item.preview);

  return previews;
}

function mostRelevantMilestoneAction(
  caseItem: ServiceCase,
  tasks: CaseTask[],
  actor: "customer" | "technician",
) {
  const actorTasks = tasks.filter((task) => task.actor === actor);

  return {
    primary: actorTasks[0] ? buildStageAction(caseItem, actorTasks[0], "primary") : null,
    secondary: actorTasks[1]
      ? buildStageAction(caseItem, actorTasks[1], "secondary")
      : null,
  };
}

function stageStateForMilestone(
  milestone: CaseMilestone,
  waitState: CaseWaitState,
  actor: "customer" | "technician",
): TrackingStageState {
  if (milestone.status === "completed") {
    return "completed_compact";
  }

  if (milestone.status === "blocked") {
    return waitState.actor !== actor && waitState.actor !== "none"
      ? "waiting_counterparty"
      : "blocked";
  }

  if (milestone.status === "active") {
    return waitState.actor === actor || waitState.actor === "system"
      ? "active_expanded"
      : "waiting_counterparty";
  }

  return "upcoming_visible";
}

function stageStatusLabel(
  state: TrackingStageState,
  waitState: CaseWaitState,
  actor: "customer" | "technician",
) {
  switch (state) {
    case "completed_compact":
      return "Tamamlandi";
    case "active_expanded":
      return waitState.actor === actor ? primaryViewerLabel(actor) : "Aktif";
    case "blocked":
      return "Beklemede";
    case "waiting_counterparty":
      return waitState.label;
    case "upcoming_visible":
      return "Siradaki";
  }
}

function stageSubtitle(
  milestone: CaseMilestone,
  approvals: CaseApproval[],
  tasks: CaseTask[],
  evidencePreview: TrackingStageEvidencePreview[],
  state: TrackingStageState,
) {
  if (approvals[0]) {
    return approvals[0].description;
  }

  if (state === "active_expanded" && tasks[0]) {
    return tasks[0].description;
  }

  if (state === "waiting_counterparty" && tasks[0]) {
    return tasks[0].description;
  }

  if (milestone.blocker_reason) {
    return milestone.blocker_reason;
  }

  if (state === "completed_compact" && evidencePreview[0]) {
    return `${milestone.description} · ${evidencePreview[0].title}`;
  }

  return milestone.description;
}

function stageCostImpact(
  caseItem: ServiceCase,
  milestone: CaseMilestone,
  approvals: CaseApproval[],
) {
  if (approvals[0]?.amount_label) {
    return approvals[0].amount_label;
  }

  if (
    ["approval", "scope", "delivery", "quality"].includes(milestone.key) &&
    caseItem.total_label
  ) {
    return caseItem.total_label;
  }

  return null;
}

function stageTimeLabel(
  caseItem: ServiceCase,
  evidencePreview: TrackingStageEvidencePreview[],
  approvals: CaseApproval[],
  state: TrackingStageState,
) {
  if (evidencePreview[0]) {
    return evidencePreview[0].meta;
  }

  if (approvals[0]) {
    return approvals[0].requested_at_label;
  }

  return state === "upcoming_visible"
    ? caseItem.estimate_label ?? "Sirada"
    : caseItem.updated_at_label;
}

function stageDrilldownRoute(
  caseItem: ServiceCase,
  milestone: CaseMilestone,
  approvals: CaseApproval[],
  actions: {
    primary: TrackingStageAction | null;
    secondary: TrackingStageAction | null;
  },
  actor: "customer" | "technician",
  hasDocuments: boolean,
) {
  if (actions.primary?.route) {
    return actions.primary.route;
  }

  if (actions.secondary?.route) {
    return actions.secondary.route;
  }

  if (actor === "customer" && approvals[0]) {
    return approvalRoute(caseItem, approvals[0].id);
  }

  if (
    actor === "customer" &&
    ["approval", "scope"].includes(milestone.key) &&
    caseItem.offers.length
  ) {
    return offersRoute(caseItem);
  }

  if (actor === "customer" && hasDocuments) {
    return documentsRoute(caseItem);
  }

  return undefined;
}

function buildTrackingStages(
  caseItem: ServiceCase,
  actor: "customer" | "technician",
) {
  return caseItem.milestones.map((milestone) => {
    const tasks = viewerTasksForMilestone(caseItem, milestone);
    const approvals = approvalsForMilestone(caseItem, tasks);
    const evidencePreview = evidencePreviewForMilestone(
      caseItem,
      milestone,
      tasks,
      approvals,
      actor,
    );
    const state = stageStateForMilestone(milestone, caseItem.wait_state, actor);
    const actions = mostRelevantMilestoneAction(caseItem, tasks, actor);
    const isNew =
      evidencePreview.some((item) => item.isNew) ||
      approvals.some(
        (approval) =>
          Boolean(
            caseItem.last_seen_by_actor[actor] &&
              approval.requested_at > caseItem.last_seen_by_actor[actor]!,
          ),
      );

    return {
      id: milestone.id,
      title: milestone.title,
      subtitle: stageSubtitle(milestone, approvals, tasks, evidencePreview, state),
      actor: milestone.actor,
      state,
      timeLabel: stageTimeLabel(caseItem, evidencePreview, approvals, state),
      statusLabel: stageStatusLabel(state, caseItem.wait_state, actor),
      evidencePreview,
      costImpact: stageCostImpact(caseItem, milestone, approvals),
      waitLabel:
        state === "waiting_counterparty" || state === "blocked"
          ? caseItem.wait_state.label
          : undefined,
      primaryAction: actions.primary,
      secondaryAction: actions.secondary,
      drilldownRoute: stageDrilldownRoute(
        caseItem,
        milestone,
        approvals,
        actions,
        actor,
        evidencePreview.length > 0,
      ),
      isNew,
    } satisfies TrackingStage;
  });
}

function nextStageLabel(stages: TrackingStage[], fallback: string) {
  const nextStage = stages.find((stage) => stage.state === "upcoming_visible");
  return nextStage?.title ?? fallback;
}

function buildCustomerUtilityPreviews(
  caseItem: ServiceCase,
): TrackingUtilityPreview[] {
  const utilities: TrackingUtilityPreview[] = [];

  if (caseItem.assigned_service) {
    utilities.push({
      id: `utility-service-${caseItem.id}`,
      kind: "service_profile",
      title: caseItem.assigned_service.name,
      subtitle: caseItem.assigned_service.tagline,
      meta: caseItem.assigned_service.reason,
      badgeLabel: "Servis profili",
      badgeTone: "success",
      route: `/usta/${caseItem.assigned_service.id}`,
    });
  }

  if (caseItem.offers.length) {
    const liveOffers = caseItem.offers.filter((offer) => offer.status !== "rejected");
    utilities.push({
      id: `utility-offers-${caseItem.id}`,
      kind: "offers",
      title: "Teklifler",
      subtitle:
        caseItem.offers.some((offer) => offer.status === "accepted")
          ? "Secili teklif ve alternatifler burada."
          : `${liveOffers.length} teklif ayni karar ekraninda hazir.`,
      meta: caseItem.total_label ?? undefined,
      badgeLabel: `${liveOffers.length}`,
      badgeTone: "accent",
      route: offersRoute(caseItem),
    });
  }

  utilities.push({
    id: `utility-documents-${caseItem.id}`,
    kind: "documents",
    title: "Belgeler",
    subtitle:
      caseItem.documents.length > 0
        ? `${caseItem.documents.length} evrak ve kanit izi kayitli.`
        : "Belge ve kanit izleri burada toplanir.",
    meta: caseItem.documents[0]?.created_at_label,
    badgeLabel: caseItem.documents.length ? `${caseItem.documents.length}` : undefined,
    badgeTone: "info",
    route: documentsRoute(caseItem),
  });

  utilities.push({
    id: `utility-messages-${caseItem.id}`,
    kind: "messages",
    title: "Mesajlar",
    subtitle: caseItem.thread.preview,
    meta: caseItem.thread.messages.slice(-1)[0]?.created_at_label,
    badgeLabel:
      caseItem.thread.unread_count > 0 ? `${caseItem.thread.unread_count} yeni` : undefined,
    badgeTone: "warning",
    route: messagesRoute(caseItem),
  });

  return utilities;
}

function buildTechnicianUtilityPreviews(
  caseItem: ServiceCase,
  customerName: string,
): TrackingUtilityPreview[] {
  return [
    {
      id: `utility-customer-${caseItem.id}`,
      kind: "customer",
      title: customerName,
      subtitle: caseItem.title,
      meta: caseItem.wait_state.description,
      badgeLabel: caseItem.wait_state.label,
      badgeTone: waitTone(caseItem.wait_state.actor),
    },
    {
      id: `utility-documents-${caseItem.id}`,
      kind: "documents",
      title: "Belge ve kanit izi",
      subtitle:
        caseItem.documents.length > 0
          ? `${caseItem.documents.length} belge operasyon boyunca kayitli.`
          : "Yeni evrak ve kanit ekleri burada toplanir.",
      meta: caseItem.documents[0]?.created_at_label,
      badgeLabel: caseItem.documents.length ? `${caseItem.documents.length}` : undefined,
      badgeTone: "info",
    },
    {
      id: `utility-approvals-${caseItem.id}`,
      kind: "approvals",
      title: "Bekleyen musteri kararlari",
      subtitle:
        caseItem.pending_approvals.length > 0
          ? `${caseItem.pending_approvals.length} onay karari sureci etkiliyor.`
          : "Acil bekleyen musteri karari yok.",
      meta: caseItem.pending_approvals[0]?.requested_at_label,
      badgeLabel:
        caseItem.pending_approvals.length > 0
          ? `${caseItem.pending_approvals.length} bekliyor`
          : undefined,
      badgeTone: "warning",
    },
  ];
}

export function buildCustomerTrackingView(caseItem: ServiceCase): CustomerTrackingView {
  const horizon = getProcessHorizon(caseItem);
  const primaryTask = getPrimaryTask(caseItem, "customer");
  const secondaryTask =
    [...caseItem.tasks]
      .filter(
        (task) =>
          task.actor === "customer" &&
          task.id !== primaryTask?.id &&
          task.status !== "completed",
      )
      .sort((left, right) => taskPriority(left) - taskPriority(right))[0] ?? null;
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  const stages = buildTrackingStages(caseItem, "customer");
  const primaryAction = primaryTask ? buildStageAction(caseItem, primaryTask, "primary") : null;
  const header = {
    eyebrow: buildFocusEyebrow(caseItem),
    title: caseItem.title,
    subtitle: vehicle
      ? `${vehicle.plate} · ${vehicle.vehicleLabel}`
      : getTrackingStatusLabel(caseItem.status),
    summaryTitle: caseItem.next_action_title,
    summaryDescription: caseItem.next_action_description,
    statusLabel: getTrackingStatusLabel(caseItem.status),
    statusTone: getTrackingStatusTone(caseItem.status),
    waitLabel: caseItem.wait_state.label,
    nextLabel: nextStageLabel(stages, caseItem.next_action_title),
    updatedAtLabel: caseItem.updated_at_label,
    totalLabel: caseItem.total_label,
    estimateLabel: caseItem.estimate_label,
  } satisfies TrackingHeaderSummary;

  return {
    caseId: caseItem.id,
    statusLabel: getTrackingStatusLabel(caseItem.status),
    statusTone: getTrackingStatusTone(caseItem.status),
    progressValue: getTrackingProgressValue(caseItem.status),
    header,
    stages,
    primaryAction,
    utilityPreviews: buildCustomerUtilityPreviews(caseItem),
    waitState: caseItem.wait_state,
    vehicle: vehicle
      ? {
          plate: vehicle.plate,
          vehicleLabel: vehicle.vehicleLabel,
          note: vehicle.note,
        }
      : null,
    focusWindow: {
      eyebrow: buildFocusEyebrow(caseItem),
      title: caseItem.next_action_title,
      description: caseItem.next_action_description,
      summary: caseItem.summary,
      updatedAtLabel: caseItem.updated_at_label,
      totalLabel: caseItem.total_label,
      estimateLabel: caseItem.estimate_label,
    },
    pastSpine: horizon.completed.map(toMilestoneView),
    horizon: [
      ...(horizon.active ? [toMilestoneView(horizon.active)] : []),
      ...horizon.upcoming.map(toMilestoneView),
    ],
    recentProof: getRecentProof(caseItem).map(toEvidenceView),
    delta: getSinceLastSeenDelta(caseItem, "customer"),
    primaryTask: primaryTask ? createTaskView(caseItem, primaryTask) : null,
    secondaryTask: secondaryTask ? createTaskView(caseItem, secondaryTask) : null,
    serviceSummary: caseItem.assigned_service,
    auditSpine: caseItem.events.slice(0, 6).map((event) => ({
      id: event.id,
      title: event.title,
      subtitle: event.body,
      meta: event.created_at_label,
      tone: mapTone(event.tone),
    })),
    threadPreview: caseItem.thread.messages.slice(-2).map((message) => ({
      id: message.id,
      author: message.author_name,
      role: message.author_role,
      body: message.body,
      meta: message.created_at_label,
    })),
    notificationQueue: caseItem.notification_intents.filter(
      (intent) => intent.actor === "customer",
    ),
  };
}

export function buildTechnicianTrackingView(
  caseItem: ServiceCase,
): TechnicianTrackingView {
  const horizon = getProcessHorizon(caseItem);
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  const technicianTasks = caseItem.tasks
    .filter((task) => task.actor === "technician" && task.status !== "completed")
    .sort((left, right) => taskPriority(left) - taskPriority(right));
  const primaryTask = technicianTasks[0] ?? null;
  const stages = buildTrackingStages(caseItem, "technician");
  const primaryAction = primaryTask
    ? buildStageAction(caseItem, primaryTask, "primary")
    : null;
  const customerName = vehicle?.customerName ?? "Naro Musterisi";
  const header = {
    eyebrow:
      caseItem.wait_state.actor === "technician"
        ? "Sira sende"
        : caseItem.wait_state.actor === "customer"
          ? "Musteri bekleniyor"
          : buildFocusEyebrow(caseItem),
    title: customerName,
    subtitle: vehicle
      ? `${vehicle.plate} · ${vehicle.vehicleLabel}`
      : getTrackingStatusLabel(caseItem.status),
    summaryTitle:
      primaryTask?.title ??
      `${toTitleCase(getTrackingStatusLabel(caseItem.status))} sahnesi`,
    summaryDescription: primaryTask?.description ?? caseItem.next_action_description,
    statusLabel: getTrackingStatusLabel(caseItem.status),
    statusTone: getTrackingStatusTone(caseItem.status),
    waitLabel: caseItem.wait_state.label,
    nextLabel: nextStageLabel(stages, caseItem.next_action_title),
    updatedAtLabel: caseItem.updated_at_label,
    totalLabel: caseItem.total_label,
    estimateLabel: caseItem.estimate_label,
  } satisfies TrackingHeaderSummary;

  return {
    caseId: caseItem.id,
    statusLabel: getTrackingStatusLabel(caseItem.status),
    statusTone: getTrackingStatusTone(caseItem.status),
    progressValue: getTrackingProgressValue(caseItem.status),
    header,
    stages,
    primaryAction,
    utilityPreviews: buildTechnicianUtilityPreviews(caseItem, customerName),
    waitState: caseItem.wait_state,
    customerName,
    vehicle: vehicle
      ? {
          plate: vehicle.plate,
          vehicleLabel: vehicle.vehicleLabel,
          note: vehicle.note,
        }
      : null,
    focusWindow: {
      eyebrow:
        caseItem.wait_state.actor === "technician"
          ? "Sira sende"
          : caseItem.wait_state.actor === "customer"
            ? "Musteri bekleniyor"
            : buildFocusEyebrow(caseItem),
      title:
        primaryTask?.title ??
        `${toTitleCase(getTrackingStatusLabel(caseItem.status))} sahnesi`,
      description:
        primaryTask?.description ?? caseItem.next_action_description,
      updatedAtLabel: caseItem.updated_at_label,
    },
    pastSpine: horizon.completed.map(toMilestoneView),
    horizon: [
      ...(horizon.active ? [toMilestoneView(horizon.active)] : []),
      ...horizon.upcoming.map(toMilestoneView),
    ],
    recentProof: getRecentProof(caseItem).map(toEvidenceView),
    delta: getSinceLastSeenDelta(caseItem, "technician"),
    primaryTask: primaryTask ? createTaskView(caseItem, primaryTask) : null,
    commandStrip: technicianTasks.slice(0, 4).map((task) => createTaskView(caseItem, task)),
    waitingCustomerTasks: caseItem.tasks
      .filter(
        (task) => task.actor === "customer" && task.status !== "completed",
      )
      .slice(0, 2)
      .map((task) => createTaskView(caseItem, task)),
    auditSpine: caseItem.events.slice(0, 6).map((event) => ({
      id: event.id,
      title: event.title,
      subtitle: event.body,
      meta: event.created_at_label,
      tone: mapTone(event.tone),
    })),
    notificationQueue: caseItem.notification_intents.filter(
      (intent) => intent.actor === "technician",
    ),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function nowLabel() {
  return "Az once";
}

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function serviceDocument(
  kind: CaseAttachmentKind,
  title: string,
  subtitle: string,
  sourceLabel: string,
  asset: CaseAttachment["asset"] = null,
): CaseDocument {
  return {
    id: nextId("doc"),
    kind,
    title,
    subtitle,
    source_label: sourceLabel,
    status_label: "Yeni",
    created_at: nowIso(),
    created_at_label: nowLabel(),
    asset,
  };
}

function serviceEvidence(
  caseId: string,
  kind: CaseAttachmentKind,
  title: string,
  subtitle: string,
  taskId: string | null,
  asset: CaseAttachment["asset"] = null,
): CaseEvidenceItem {
  return {
    id: nextId("evidence"),
    title,
    subtitle,
    kind,
    actor: "technician",
    source_label: "Servis guncellemesi",
    status_label: "Yeni",
    created_at: nowIso(),
    created_at_label: nowLabel(),
    task_id: taskId,
    milestone_id: null,
    is_new: true,
    asset,
  };
}

function appendEvent(
  caseItem: ServiceCase,
  title: string,
  body: string,
  tone: CaseTone,
  type: ServiceCase["events"][number]["type"] = "status_update",
) {
  return [
    {
      id: nextId("event"),
      type,
      title,
      body,
      created_at: nowIso(),
      created_at_label: nowLabel(),
      tone,
    },
    ...caseItem.events,
  ];
}

function appendThreadMessage(
  caseItem: ServiceCase,
  author_name: string,
  author_role: ServiceCase["thread"]["messages"][number]["author_role"],
  body: string,
  attachments: CaseAttachment[] = [],
) {
  return {
    ...caseItem.thread,
    preview: body,
    messages: [
      ...caseItem.thread.messages,
      {
        id: nextId("message"),
        author_name,
        author_role,
        body,
        created_at: nowIso(),
        created_at_label: nowLabel(),
        attachments,
      },
    ],
  };
}

export function markCaseSeen(caseItem: ServiceCase, actor: "customer" | "technician") {
  return syncTrackingCase({
    ...caseItem,
    last_seen_by_actor: {
      ...caseItem.last_seen_by_actor,
      [actor]: nowIso(),
    },
  });
}

export function refreshMatchingCase(caseItem: ServiceCase) {
  if (caseItem.status !== "matching") {
    return syncTrackingCase(caseItem);
  }

  return syncTrackingCase({
    ...caseItem,
    status: "offers_ready",
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Teklifler hazir",
      "Eslesme tamamlandi; karar penceresi simdi acik.",
      "success",
      "offer_received",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      "Uygun servisler hazir. Fiyat ve sure karsilastirmasi icin vaka ekranini acabilirsin.",
    ),
  });
}

export function selectOfferForCase(caseItem: ServiceCase, offerId: string) {
  if (caseItem.status !== "offers_ready") {
    return syncTrackingCase(caseItem);
  }

  const acceptedOffer = caseItem.offers.find((offer) => offer.id === offerId);

  if (!acceptedOffer) {
    return syncTrackingCase(caseItem);
  }

  return syncTrackingCase({
    ...caseItem,
    status: "scheduled",
    assigned_technician_id: acceptedOffer.technician_id,
    preferred_technician_id: acceptedOffer.technician_id,
    total_label: acceptedOffer.price_label,
    estimate_label: acceptedOffer.eta_label,
    assigned_service: getTrackingServiceSnapshot(
      acceptedOffer.technician_id,
      "Bu vaka icin secilen servis",
    ),
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    offers: caseItem.offers.map((offer) => ({
      ...offer,
      status: offer.id === offerId ? "accepted" : "rejected",
      available_at_label:
        offer.id === offerId ? "Kabul edildi" : offer.available_at_label,
    })),
    events: appendEvent(
      caseItem,
      "Teklif kabul edildi",
      `${
        getTrackingTechnicianName(acceptedOffer.technician_id) ?? "Servis"
      } ile randevu baglami olustu.`,
      "success",
      "technician_selected",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      "Teklif kabul edildi. Pickup ve ilk kabul hazirliklari icin randevu sahnesine gecildi.",
    ),
  });
}

export function shortlistOfferForCase(caseItem: ServiceCase, offerId: string) {
  if (caseItem.status !== "offers_ready") {
    return syncTrackingCase(caseItem);
  }

  const shortlistedOffer = caseItem.offers.find((offer) => offer.id === offerId);

  if (!shortlistedOffer) {
    return syncTrackingCase(caseItem);
  }

  return syncTrackingCase({
    ...caseItem,
    preferred_technician_id: shortlistedOffer.technician_id,
    assigned_service: getTrackingServiceSnapshot(
      shortlistedOffer.technician_id,
      "Bu servis karar listesinde one cikiyor",
    ),
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    offers: caseItem.offers.map((offer) => ({
      ...offer,
      status:
        offer.id === offerId
          ? "shortlisted"
          : offer.status === "shortlisted"
            ? "pending"
            : offer.status,
    })),
    events: appendEvent(
      caseItem,
      "Servis shortlist'e alindi",
      `${
        getTrackingTechnicianName(shortlistedOffer.technician_id) ?? "Servis"
      } karar listesinde one cikarildi.`,
      "accent",
      "technician_selected",
    ),
  });
}

export function rejectOfferForCase(caseItem: ServiceCase, offerId: string) {
  if (caseItem.status !== "offers_ready") {
    return syncTrackingCase(caseItem);
  }

  return syncTrackingCase({
    ...caseItem,
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    offers: caseItem.offers.map((offer) =>
      offer.id === offerId ? { ...offer, status: "rejected" } : offer,
    ),
    events: appendEvent(
      caseItem,
      "Teklif elendi",
      "Bu teklif karar masasindan cikartildi.",
      "warning",
    ),
  });
}

export function confirmCaseAppointment(caseItem: ServiceCase) {
  if (caseItem.status !== "scheduled") {
    return syncTrackingCase(caseItem);
  }

  return syncTrackingCase({
    ...caseItem,
    status: "service_in_progress",
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    documents: [
      serviceDocument(
        "document",
        "Randevu ve kabul notu",
        "Pickup saati ve ilk kabul beklentisi netlesti.",
        "Platform ozeti",
      ),
      ...caseItem.documents,
    ],
    events: appendEvent(
      caseItem,
      "Randevu onaylandi",
      "Servis artik kabul, gorsel kanit ve canli ilerleme moduna gecti.",
      "info",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      "Randevu onaylandi. Usta ilk kabul kanitini ve sonraki teknik notlari paylasacak.",
    ),
  });
}

const APPOINTMENT_TTL_MS = 24 * 60 * 60 * 1000;

function describeSlot(slot: AppointmentSlot): string {
  switch (slot.kind) {
    case "today":
      return "Bugün";
    case "tomorrow":
      return "Yarın";
    case "custom":
      return slot.dateLabel ?? "Seçili gün";
    case "flexible":
      return "Esnek · usta önerisine açık";
  }
}

export type AppointmentRequestPayload = {
  technician_id: string;
  offer_id: string | null;
  slot: AppointmentSlot;
  note?: string;
};

export function requestAppointmentForCase(
  caseItem: ServiceCase,
  payload: AppointmentRequestPayload,
): ServiceCase {
  if (
    caseItem.status !== "matching" &&
    caseItem.status !== "offers_ready"
  ) {
    return syncTrackingCase(caseItem);
  }

  const appointment: Appointment = {
    id: nextId("appt"),
    case_id: caseItem.id,
    technician_id: payload.technician_id,
    offer_id: payload.offer_id,
    slot: payload.slot,
    note: payload.note ?? "",
    status: "pending",
    requested_at: nowIso(),
    expires_at: new Date(Date.now() + APPOINTMENT_TTL_MS).toISOString(),
    responded_at: null,
    decline_reason: null,
  };

  const offers = payload.offer_id
    ? caseItem.offers.map((offer) => ({
        ...offer,
        status:
          offer.id === payload.offer_id
            ? ("accepted" as const)
            : ("rejected" as const),
      }))
    : caseItem.offers;

  const technicianName =
    getTrackingTechnicianName(payload.technician_id) ?? "Usta";
  const slotLabel = describeSlot(payload.slot);

  return syncTrackingCase({
    ...caseItem,
    status: "appointment_pending",
    preferred_technician_id: payload.technician_id,
    assigned_service: getTrackingServiceSnapshot(
      payload.technician_id,
      "Randevu onayı bekleniyor",
    ),
    offers,
    appointment,
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Randevu talebi gönderildi",
      `${technicianName} için ${slotLabel} talebi iletildi. Usta onayı bekleniyor.`,
      "accent",
      "status_update",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      `Randevu talebin ${technicianName}'ya iletildi. 24 saat içinde onay beklenir.`,
    ),
  });
}

export function approveAppointmentForCase(caseItem: ServiceCase): ServiceCase {
  if (caseItem.status !== "appointment_pending" || !caseItem.appointment) {
    return syncTrackingCase(caseItem);
  }

  const { appointment, offers } = caseItem;
  const acceptedOffer = appointment.offer_id
    ? offers.find((offer) => offer.id === appointment.offer_id)
    : null;
  const technicianName =
    getTrackingTechnicianName(appointment.technician_id) ?? "Usta";
  const slotLabel = describeSlot(appointment.slot);

  return syncTrackingCase({
    ...caseItem,
    status: "scheduled",
    assigned_technician_id: appointment.technician_id,
    preferred_technician_id: appointment.technician_id,
    total_label: acceptedOffer?.price_label ?? caseItem.total_label,
    estimate_label: acceptedOffer?.eta_label ?? caseItem.estimate_label,
    assigned_service: getTrackingServiceSnapshot(
      appointment.technician_id,
      "Bu vaka için seçilen servis",
    ),
    appointment: {
      ...appointment,
      status: "approved",
      responded_at: nowIso(),
    },
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Usta randevuyu onayladı",
      `${technicianName} randevunu kabul etti · ${slotLabel}.`,
      "success",
      "technician_selected",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      `${technicianName} randevu talebini onayladı. Süreç başlıyor — pickup ve ilk kabul hazırlıkları açılıyor.`,
    ),
  });
}

export function declineAppointmentForCase(
  caseItem: ServiceCase,
  reason?: string,
): ServiceCase {
  if (caseItem.status !== "appointment_pending" || !caseItem.appointment) {
    return syncTrackingCase(caseItem);
  }

  const { appointment } = caseItem;
  const wasOfferBased = Boolean(appointment.offer_id);
  const technicianName =
    getTrackingTechnicianName(appointment.technician_id) ?? "Usta";

  const offers = wasOfferBased
    ? caseItem.offers.map((offer) =>
        offer.id === appointment.offer_id
          ? { ...offer, status: "rejected" as const }
          : offer,
      )
    : caseItem.offers;

  return syncTrackingCase({
    ...caseItem,
    status: wasOfferBased ? "offers_ready" : "matching",
    preferred_technician_id: null,
    assigned_service: null,
    offers,
    appointment: {
      ...appointment,
      status: "declined",
      responded_at: nowIso(),
      decline_reason: reason ?? null,
    },
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Usta randevuyu reddetti",
      reason
        ? `${technicianName}: ${reason}`
        : `${technicianName} şu an uygun değil. Alternatif ustalar hazırlanıyor.`,
      "warning",
      "status_update",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      `${technicianName} randevuyu reddetti. Başka alternatiflere geçebilirsin.`,
    ),
  });
}

export function expireAppointmentForCase(caseItem: ServiceCase): ServiceCase {
  if (caseItem.status !== "appointment_pending" || !caseItem.appointment) {
    return syncTrackingCase(caseItem);
  }

  const { appointment } = caseItem;
  const wasOfferBased = Boolean(appointment.offer_id);

  const offers = wasOfferBased
    ? caseItem.offers.map((offer) =>
        offer.id === appointment.offer_id
          ? { ...offer, status: "pending" as const }
          : offer,
      )
    : caseItem.offers;

  return syncTrackingCase({
    ...caseItem,
    status: wasOfferBased ? "offers_ready" : "matching",
    preferred_technician_id: null,
    assigned_service: null,
    offers,
    appointment: {
      ...appointment,
      status: "expired",
      responded_at: nowIso(),
    },
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Randevu süresi doldu",
      "Usta 24 saat içinde yanıt vermedi. Yeniden dene veya alternatif seç.",
      "warning",
      "status_update",
    ),
  });
}

export function cancelCaseByCustomer(
  caseItem: ServiceCase,
  reason?: string,
): ServiceCase {
  if (
    caseItem.status === "completed" ||
    caseItem.status === "archived" ||
    caseItem.status === "cancelled"
  ) {
    return syncTrackingCase(caseItem);
  }

  const wasAppointmentPending =
    caseItem.status === "appointment_pending" &&
    caseItem.appointment?.status === "pending";

  const reasonText = reason ?? "Müşteri vakayı iptal etti";

  return syncTrackingCase({
    ...caseItem,
    status: "cancelled",
    assigned_technician_id: null,
    preferred_technician_id: null,
    assigned_service: null,
    appointment: wasAppointmentPending && caseItem.appointment
      ? {
          ...caseItem.appointment,
          status: "cancelled",
          responded_at: nowIso(),
        }
      : caseItem.appointment,
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Vaka iptal edildi",
      reasonText,
      "critical",
      "status_update",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      `Vaka iptal edildi — ${reasonText}`,
    ),
  });
}

export function appendCaseAttachment(
  caseItem: ServiceCase,
  attachment: CaseAttachment,
): ServiceCase {
  const document: CaseDocument = {
    id: nextId("doc"),
    kind: attachment.kind,
    title: attachment.title,
    subtitle: attachment.subtitle,
    source_label: "Müşteri yükledi",
    status_label: attachment.statusLabel ?? "Yeni",
    created_at: nowIso(),
    created_at_label: nowLabel(),
    asset: attachment.asset ?? null,
  };

  return syncTrackingCase({
    ...caseItem,
    attachments: [attachment, ...caseItem.attachments],
    documents: [document, ...caseItem.documents],
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Müşteri dosya ekledi",
      attachment.title,
      "info",
      "status_update",
    ),
  });
}

export function updateCaseNotes(
  caseItem: ServiceCase,
  patch: { summary?: string; notes?: string },
): ServiceCase {
  const nextSummary =
    patch.summary !== undefined ? patch.summary : caseItem.summary;
  const nextNotes =
    patch.notes !== undefined ? patch.notes : caseItem.request.notes;

  return syncTrackingCase({
    ...caseItem,
    summary: nextSummary,
    request: {
      ...caseItem.request,
      notes: nextNotes,
    },
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Vaka notları güncellendi",
      "Müşteri özet veya ek notları düzenledi.",
      "neutral",
      "status_update",
    ),
  });
}

export function cancelAppointmentForCase(caseItem: ServiceCase): ServiceCase {
  if (caseItem.status !== "appointment_pending" || !caseItem.appointment) {
    return syncTrackingCase(caseItem);
  }

  const { appointment } = caseItem;
  const wasOfferBased = Boolean(appointment.offer_id);

  const offers = wasOfferBased
    ? caseItem.offers.map((offer) =>
        offer.id === appointment.offer_id
          ? { ...offer, status: "pending" as const }
          : offer,
      )
    : caseItem.offers;

  return syncTrackingCase({
    ...caseItem,
    status: wasOfferBased ? "offers_ready" : "matching",
    preferred_technician_id: null,
    assigned_service: null,
    offers,
    appointment: {
      ...appointment,
      status: "cancelled",
      responded_at: nowIso(),
    },
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Randevu talebi iptal edildi",
      "Randevu talebi senin tarafından iptal edildi.",
      "neutral",
      "status_update",
    ),
  });
}

export type OfferSubmissionPayload = {
  technician_id: string;
  headline: string;
  description: string;
  amount: number;
  eta_minutes: number;
  eta_label: string;
  delivery_mode: string;
  warranty_label: string;
  available_at_label?: string;
  badges?: string[];
};

export function submitOfferForCase(
  caseItem: ServiceCase,
  payload: OfferSubmissionPayload,
): ServiceCase {
  if (caseItem.status !== "matching" && caseItem.status !== "offers_ready") {
    return syncTrackingCase(caseItem);
  }

  const existing = caseItem.offers.find(
    (offer) => offer.technician_id === payload.technician_id,
  );
  if (existing) {
    return syncTrackingCase(caseItem);
  }

  const newOffer: CaseOffer = {
    id: nextId("offer"),
    technician_id: payload.technician_id,
    headline: payload.headline,
    description: payload.description,
    amount: payload.amount,
    currency: "TRY",
    price_label: `₺${payload.amount.toLocaleString("tr-TR")}`,
    eta_minutes: payload.eta_minutes,
    eta_label: payload.eta_label,
    available_at_label: payload.available_at_label ?? "Hazır",
    delivery_mode: payload.delivery_mode,
    warranty_label: payload.warranty_label,
    status: "pending" as CaseOfferStatus,
    badges: payload.badges ?? [],
  };

  const technicianName =
    getTrackingTechnicianName(payload.technician_id) ?? "Servis";

  return syncTrackingCase({
    ...caseItem,
    status: "offers_ready",
    offers: [...caseItem.offers, newOffer],
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(
      caseItem,
      "Yeni teklif geldi",
      `${technicianName} ${newOffer.price_label} · ${newOffer.eta_label} teklifi gönderdi.`,
      "accent",
      "offer_received",
    ),
  });
}

export type TechnicianInsuranceCasePayload = {
  technician_id: string;
  vehicle_id: string;
  vehicle_label: string;
  plate: string;
  damage_area: string;
  summary: string;
  insurance_claim: InsuranceClaim;
  location_label?: string;
  attachments?: CaseAttachment[];
  counterparty_note?: string;
  counterparty_vehicle_count?: number | null;
  vehicle_drivable?: boolean | null;
  report_method?: "e_devlet" | "paper" | "police" | null;
  ambulance_contacted?: boolean;
  towing_required?: boolean;
  notes?: string;
};

export function createTechnicianInsuranceCase(
  payload: TechnicianInsuranceCasePayload,
): ServiceCase {
  const caseId = nextId("case");
  const draft: ServiceRequestDraft = {
    kind: "accident" satisfies ServiceRequestKind,
    vehicle_id: payload.vehicle_id,
    urgency: "planned",
    summary: payload.summary,
    location_label: payload.location_label ?? "Usta tarafından açıldı",
    notes: payload.notes,
    attachments: payload.attachments ?? [],
    symptoms: [],
    maintenance_items: [],
    vehicle_drivable: payload.vehicle_drivable ?? null,
    towing_required: payload.towing_required ?? false,
    pickup_preference: null,
    mileage_km: null,
    preferred_technician_id: payload.technician_id,
    counterparty_note: payload.counterparty_note,
    counterparty_vehicle_count: payload.counterparty_vehicle_count ?? null,
    damage_area: payload.damage_area,
    valet_requested: false,
    report_method: payload.report_method ?? null,
    kasko_selected: payload.insurance_claim.coverage_kind === "kasko",
    kasko_brand:
      payload.insurance_claim.coverage_kind === "kasko"
        ? payload.insurance_claim.insurer
        : undefined,
    sigorta_selected: payload.insurance_claim.coverage_kind === "trafik",
    sigorta_brand:
      payload.insurance_claim.coverage_kind === "trafik"
        ? payload.insurance_claim.insurer
        : undefined,
    ambulance_contacted: payload.ambulance_contacted ?? false,
    emergency_acknowledged: true,
    breakdown_category: null,
    on_site_repair: false,
    price_preference: null,
    maintenance_category: null,
  };

  const technicianName =
    getTrackingTechnicianName(payload.technician_id) ?? "Servis";

  return syncTrackingCase({
    id: caseId,
    vehicle_id: payload.vehicle_id,
    kind: "accident",
    status: "scheduled",
    title: `Sigorta dosyası · ${payload.damage_area}`,
    subtitle: payload.vehicle_label,
    summary: payload.summary,
    created_at: nowIso(),
    created_at_label: nowLabel(),
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    request: draft,
    assigned_technician_id: payload.technician_id,
    preferred_technician_id: payload.technician_id,
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: payload.insurance_claim.claim_amount_estimate
      ? `₺${payload.insurance_claim.claim_amount_estimate.toLocaleString("tr-TR")}`
      : null,
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: getTrackingServiceSnapshot(
      payload.technician_id,
      "Sigorta dosyasını açan usta",
    ),
    documents: [],
    offers: [],
    attachments: payload.attachments ?? [],
    events: [
      {
        id: nextId("event"),
        type: "submitted",
        title: "Sigorta dosyası açıldı",
        body: `${technicianName} sigorta dosyasını hazırladı. ${payload.insurance_claim.insurer} · Poliçe: ${payload.insurance_claim.policy_number}`,
        created_at: nowIso(),
        created_at_label: nowLabel(),
        tone: "info",
      },
    ],
    thread: {
      id: nextId("thread"),
      case_id: caseId,
      preview: "Sigorta dosyası açıldı.",
      unread_count: 0,
      messages: [
        {
          id: nextId("message"),
          author_name: "Naro",
          author_role: "system",
          body: `Sigorta dosyası hazırlandı — ${payload.insurance_claim.insurer}. Belge ve fotoğraflar sigorta şirketine iletilmek üzere dosyada tutulur.`,
          created_at: nowIso(),
          created_at_label: nowLabel(),
          attachments: [],
        },
      ],
    },
    workflow_blueprint: "damage_insured",
    milestones: [],
    tasks: [],
    evidence_feed: [],
    wait_state: {
      actor: "technician",
      label: "Servis sahnede",
      description: "Usta sigorta dosyasını ilerletiyor.",
    },
    last_seen_by_actor: {
      customer: null,
      technician: nowIso(),
    },
    notification_intents: [],
    appointment: null,
    origin: "technician",
    insurance_claim: payload.insurance_claim,
  });
}

export function approveCaseParts(caseItem: ServiceCase, approvalId: string) {
  if (caseItem.status !== "parts_approval") {
    return syncTrackingCase(caseItem);
  }

  const approval = caseItem.pending_approvals.find(
    (item) => item.id === approvalId && item.kind === "parts_request",
  );

  if (!approval) {
    return syncTrackingCase(caseItem);
  }

  const invoicePreviewId = nextId("doc");

  return syncTrackingCase({
    ...caseItem,
    status: "invoice_approval",
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    pending_approvals: [
      {
        id: nextId("approval"),
        kind: "invoice",
        status: "pending",
        title: "Fatura ve teslim ozeti",
        description:
          "Parca karari alindi; servis son maliyet ve teslim notunu paylasti.",
        requested_by: caseItem.assigned_service?.name ?? "Servis",
        requested_at: nowIso(),
        requested_at_label: nowLabel(),
        amount_label: caseItem.total_label,
        action_label: "Faturayi onayla",
        service_comment:
          "Kalemler beklendigi gibiyse onay verdiginde evrak izi tamamlanacak.",
        line_items: approval.line_items,
        evidence_document_ids: [...approval.evidence_document_ids, invoicePreviewId],
      },
    ],
    documents: [
      {
        id: invoicePreviewId,
        kind: "invoice",
        title: "Servis faturasi taslagi",
        subtitle: caseItem.total_label ?? "Tutar hazir",
        source_label: "Servis faturasi",
        status_label: "Onay bekliyor",
        created_at: nowIso(),
        created_at_label: nowLabel(),
        asset: null,
      },
      ...caseItem.documents,
    ],
    events: appendEvent(
      caseItem,
      "Parca onayi alindi",
      "Parca karari verildi; fatura ve teslim ozeti hazirlandi.",
      "success",
      "invoice_shared",
    ),
    thread: appendThreadMessage(
      caseItem,
      caseItem.assigned_service?.name ?? "Servis",
      "technician",
      "Parca onayiniz icin tesekkurler. Fatura ve teslim ozeti sisteme yansitildi.",
    ),
  });
}

export function approveCaseInvoice(caseItem: ServiceCase, approvalId: string) {
  if (caseItem.status !== "invoice_approval") {
    return syncTrackingCase(caseItem);
  }

  const approval = caseItem.pending_approvals.find(
    (item) => item.id === approvalId && item.kind === "invoice",
  );

  if (!approval) {
    return syncTrackingCase(caseItem);
  }

  return syncTrackingCase({
    ...caseItem,
    status: "completed",
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    pending_approvals: [],
    documents: caseItem.documents.map((document) =>
      approval.evidence_document_ids.includes(document.id)
        ? { ...document, status_label: "Onaylandi" }
        : document,
    ),
    events: appendEvent(
      caseItem,
      "Fatura onaylandi",
      "Surec kapandi; garanti ve denetim izi kayda alindi.",
      "success",
      "completed",
    ),
    thread: appendThreadMessage(
      caseItem,
      "Naro",
      "system",
      "Fatura onaylandi. Vaka tamamlandi ve belgeler kayitlara tasindi.",
    ),
  });
}

export function confirmCaseCompletion(caseItem: ServiceCase, approvalId: string) {
  if (caseItem.status !== "invoice_approval") {
    return syncTrackingCase(caseItem);
  }

  const approval = caseItem.pending_approvals.find(
    (item) => item.id === approvalId && item.kind === "completion",
  );

  if (!approval) {
    return syncTrackingCase(caseItem);
  }

  return syncTrackingCase({
    ...caseItem,
    status: "completed",
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    pending_approvals: [],
    events: appendEvent(
      caseItem,
      "Teslim teyidi alindi",
      "Musteri son kontrolu onayladi ve vaka kapandi.",
      "success",
      "completed",
    ),
  });
}

export function sendCaseMessage(
  caseItem: ServiceCase,
  actor: "customer" | "technician",
  body: string,
  attachments: CaseAttachment[] = [],
) {
  const authorName =
    actor === "customer"
      ? "Sen"
      : caseItem.assigned_service?.name ?? "Servis";

  return syncTrackingCase({
    ...caseItem,
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    events: appendEvent(caseItem, "Yeni mesaj", body, "accent", "message"),
    thread: appendThreadMessage(
      caseItem,
      authorName,
      actor,
      body,
      attachments,
    ),
  });
}

export function attachTechnicianToTrackingCase(
  caseItem: ServiceCase,
  technicianId: string,
) {
  const hasOffer = caseItem.offers.some(
    (offer) => offer.technician_id === technicianId,
  );

  const addedOffer: CaseOffer = {
    id: nextId("offer"),
    technician_id: technicianId,
    headline: "Bu servis aktif vakaya eklendi",
    description:
      "Karar masasi icinde bu servis artik shortlist baglaminda gorunuyor.",
    amount: 2200,
    currency: "TRY",
    price_label: "₺2.200",
    eta_minutes: 90,
    eta_label: "~1.5 sa",
    available_at_label: "Hazir",
    delivery_mode: "Atolye + pickup",
    warranty_label: "Yazili garanti",
    status: "shortlisted",
    badges: ["Vakaya eklendi"],
  };

  return syncTrackingCase({
    ...caseItem,
    preferred_technician_id: technicianId,
    assigned_service: getTrackingServiceSnapshot(technicianId, "Aktif vakaya eklendi"),
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    offers: hasOffer
      ? caseItem.offers.map((offer) => ({
          ...offer,
          status:
            offer.technician_id === technicianId
              ? "shortlisted"
              : offer.status === "shortlisted"
                ? "pending"
                : offer.status,
        }))
      : [addedOffer, ...caseItem.offers],
    events: appendEvent(
      caseItem,
      "Servis vakaya eklendi",
      `${
        getTrackingTechnicianName(technicianId) ?? "Servis"
      } bu vaka icin shortlist'e alindi.`,
      "accent",
      "technician_selected",
    ),
  });
}

export function addTechnicianEvidenceToCase(
  caseItem: ServiceCase,
  taskId: string,
  attachment: CaseAttachment,
  note?: string,
) {
  const task = caseItem.tasks.find((item) => item.id === taskId);
  const title =
    attachment.title ||
    (attachment.kind === "video"
      ? "Kisa servis videosu"
      : attachment.kind === "photo"
        ? "Servis fotograflari"
        : "Servis eki");
  const subtitle =
    note?.trim() ||
    attachment.subtitle ||
    (attachment.kind === "video"
      ? "Ses ve hareket kontrolu kayda alindi."
      : "Mudahale edilen alan gorsellestirildi.");
  const body =
    note?.trim() || `${title} paylasildi. Dosya ve vaka izi guncellendi.`;
  const nextAttachment: CaseAttachment = {
    ...attachment,
    title,
    subtitle,
    statusLabel: attachment.statusLabel ?? "Yuklendi",
    asset: attachment.asset ?? null,
  };

  return syncTrackingCase({
    ...caseItem,
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    documents: [
      serviceDocument(
        nextAttachment.kind,
        title,
        subtitle,
        "Servis guncellemesi",
        nextAttachment.asset ?? null,
      ),
      ...caseItem.documents,
    ],
    evidence_feed: [
      serviceEvidence(
        caseItem.id,
        nextAttachment.kind,
        title,
        subtitle,
        task?.id ?? null,
        nextAttachment.asset ?? null,
      ),
      ...caseItem.evidence_feed,
    ],
    events: appendEvent(
      caseItem,
      "Yeni servis kaniti yüklendi",
      subtitle,
      "info",
    ),
    thread: appendThreadMessage(
      caseItem,
      caseItem.assigned_service?.name ?? "Servis",
      "technician",
      body,
      [nextAttachment],
    ),
  });
}

export function shareTechnicianStatusUpdate(
  caseItem: ServiceCase,
  note: string,
) {
  return syncTrackingCase({
    ...caseItem,
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    evidence_feed: [
      serviceEvidence(
        caseItem.id,
        "document",
        "Servis durum notu",
        note,
        null,
      ),
      ...caseItem.evidence_feed,
    ],
    events: appendEvent(caseItem, "Servis durum notu", note, "accent"),
    thread: appendThreadMessage(
      caseItem,
      caseItem.assigned_service?.name ?? "Servis",
      "technician",
      note,
    ),
  });
}

export function requestTechnicianPartsApproval(caseItem: ServiceCase) {
  if (caseItem.status !== "service_in_progress") {
    return syncTrackingCase(caseItem);
  }

  const proofDocId = nextId("doc");

  return syncTrackingCase({
    ...caseItem,
    status: "parts_approval",
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    pending_approvals: [
      {
        id: nextId("approval"),
        kind: "parts_request",
        status: "pending",
        title: "Parca ve ek kapsam onayi",
        description:
          "Servis ilave bir parca ve iscilik adimini gerekceli sekilde paylasti.",
        requested_by: caseItem.assigned_service?.name ?? "Servis",
        requested_at: nowIso(),
        requested_at_label: nowLabel(),
        amount_label: caseItem.total_label,
        action_label: "Parca onayini ver",
        service_comment:
          "Asinma nedeni ve alternatifler fotograf kaniti ile eklendi.",
        line_items: [
          {
            id: nextId("line"),
            label: "Parca ve iscilik etkisi",
            value: "+₺1.250",
            note: "Zincir gergisi ve tamamlayici iscilik.",
          },
        ],
        evidence_document_ids: [proofDocId],
      },
    ],
    documents: [
      {
        id: proofDocId,
        kind: "photo",
        title: "Parca gerekce gorseli",
        subtitle: "Asinma noktasi ve risk alani isaretlendi.",
        source_label: "Servis kaniti",
        status_label: "Onay bekliyor",
        created_at: nowIso(),
        created_at_label: nowLabel(),
        asset: null,
      },
      ...caseItem.documents,
    ],
    evidence_feed: [
      serviceEvidence(
        caseItem.id,
        "photo",
        "Parca gerekce fotografi",
        "Asinma alani ve risk notu eklendi.",
        null,
      ),
      ...caseItem.evidence_feed,
    ],
    events: appendEvent(
      caseItem,
      "Parca onayi istendi",
      "Maliyet etkisi ve gorsel kanit musterinin kararina sunuldu.",
      "warning",
      "parts_requested",
    ),
    thread: appendThreadMessage(
      caseItem,
      caseItem.assigned_service?.name ?? "Servis",
      "technician",
      "Parca ve ek kapsam ihtiyacini gerekcesiyle paylastik. Incelemenizi bekliyoruz.",
    ),
  });
}

export function shareTechnicianInvoice(caseItem: ServiceCase) {
  if (
    caseItem.status !== "service_in_progress" &&
    caseItem.status !== "parts_approval"
  ) {
    return syncTrackingCase(caseItem);
  }

  const invoiceDocId = nextId("doc");

  return syncTrackingCase({
    ...caseItem,
    status: "invoice_approval",
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    pending_approvals: [
      {
        id: nextId("approval"),
        kind: "invoice",
        status: "pending",
        title: "Fatura ve teslim ozeti",
        description:
          "Servis final maliyet ve teslim notunu paylasti; son onay bekleniyor.",
        requested_by: caseItem.assigned_service?.name ?? "Servis",
        requested_at: nowIso(),
        requested_at_label: nowLabel(),
        amount_label: caseItem.total_label ?? "₺3.450",
        action_label: "Faturayi onayla",
        service_comment: "Kalemler final teslim ve garanti izine gore donduruldu.",
        line_items: [
          {
            id: nextId("line"),
            label: "Toplam servis tutari",
            value: caseItem.total_label ?? "₺3.450",
          },
        ],
        evidence_document_ids: [invoiceDocId],
      },
    ],
    documents: [
      {
        id: invoiceDocId,
        kind: "invoice",
        title: "Servis faturasi",
        subtitle: "Final maliyet ve teslim notu",
        source_label: "Servis faturasi",
        status_label: "Onay bekliyor",
        created_at: nowIso(),
        created_at_label: nowLabel(),
        asset: null,
      },
      ...caseItem.documents,
    ],
    events: appendEvent(
      caseItem,
      "Fatura paylasildi",
      "Final maliyet ve teslim ozetini musteri incelemesine actin.",
      "critical",
      "invoice_shared",
    ),
  });
}

export function markCaseReadyForDelivery(caseItem: ServiceCase) {
  if (caseItem.status !== "invoice_approval") {
    return syncTrackingCase(caseItem);
  }

  const proofDocId = nextId("doc");

  return syncTrackingCase({
    ...caseItem,
    updated_at: nowIso(),
    updated_at_label: nowLabel(),
    pending_approvals: [
      ...caseItem.pending_approvals.filter((approval) => approval.kind !== "completion"),
      {
        id: nextId("approval"),
        kind: "completion",
        status: "pending",
        title: "Teslim teyidi",
        description:
          "Son fotograflar ve teslim hazir notu yuklendi; musteri son teyidi verebilir.",
        requested_by: caseItem.assigned_service?.name ?? "Servis",
        requested_at: nowIso(),
        requested_at_label: nowLabel(),
        amount_label: null,
        action_label: "Teslimi onayla",
        service_comment:
          "Arac temizlendi, final kontrol tamamlandi, teslime hazir.",
        line_items: [],
        evidence_document_ids: [proofDocId],
      },
    ],
    documents: [
      {
        id: proofDocId,
        kind: "photo",
        title: "Teslim oncesi son fotograf",
        subtitle: "Genel durum ve hazirlik notu",
        source_label: "Servis teslim kaydi",
        status_label: "Yeni",
        created_at: nowIso(),
        asset: null,
        created_at_label: nowLabel(),
      },
      ...caseItem.documents,
    ],
    evidence_feed: [
      serviceEvidence(
        caseItem.id,
        "photo",
        "Teslim fotografi",
        "Son durum ve teslim hazirlik notu eklendi.",
        null,
      ),
      ...caseItem.evidence_feed,
    ],
    events: appendEvent(
      caseItem,
      "Teslime hazir",
      "Son kanit yuklendi; musteri teslim teyidi bekleniyor.",
      "success",
    ),
  });
}
