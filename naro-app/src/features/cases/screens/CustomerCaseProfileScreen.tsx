import type {
  CaseAttachment,
  CaseDossierResponse,
  KindDetailSection,
  OfferSummary,
} from "@naro/domain";
import { useCaseDossier } from "@naro/mobile-core";
import {
  BackButton,
  Button,
  CASE_KIND_META,
  Icon,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  Car,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  Fuel,
  Gauge,
  type LucideIcon,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Shield,
  Star,
  Truck,
  User,
  Wrench,
  XCircle,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useCancelAppointment } from "@/features/appointments";
import {
  BillingSummaryCard,
  CancellationSheet,
  CompletionApprovalSheet,
  InvoiceApprovalSheet,
  PartsApprovalSheet,
  type CaseBillingStage,
} from "@/features/billing";
import {
  useAddCaseAttachment,
  useCaseDetailLive,
  useCaseThreadLive,
  useNotifyCaseToTechnician,
  useUpdateCaseNotes,
  useUpdateCaseNotesLive,
} from "@/features/cases/api";
import { AddAttachmentSheet } from "@/features/cases/components/AddAttachmentSheet";
import { EditCaseNotesSheet } from "@/features/cases/components/EditCaseNotesSheet";
import { useTowEntryRoute } from "@/features/tow/entry";
import { apiClient } from "@/runtime";

/* ────────────────────────────────────────────────────────────
 * Utility helpers
 * ──────────────────────────────────────────────────────────── */

type StickyVariant =
  | { kind: "offers" }
  | { kind: "appointment" }
  | { kind: "process" }
  | { kind: "none" };

const INACTIVE_STATUSES = new Set(["completed", "archived", "cancelled"]);

function deriveBillingStage(
  status: CaseDossierResponse["shell"]["status"],
): CaseBillingStage {
  switch (status) {
    case "matching":
    case "offers_ready":
      return "pre_preauth";
    case "appointment_pending":
    case "scheduled":
      return "scheduled_before_start";
    case "service_in_progress":
    case "parts_approval":
      return "service_in_progress";
    case "invoice_approval":
      return "invoice_approval";
    case "completed":
    case "cancelled":
    case "archived":
      return "completed";
    default:
      return "pre_preauth";
  }
}

function statusBadge(status: CaseDossierResponse["shell"]["status"]): {
  label: string;
  tone: "success" | "warning" | "info" | "neutral" | "accent";
} | null {
  switch (status) {
    case "completed":
      return { label: "Tamamlandı", tone: "success" };
    case "archived":
      return { label: "Arşiv", tone: "neutral" };
    case "cancelled":
      return { label: "İptal edildi", tone: "neutral" };
    case "matching":
      return { label: "Teklif bekleniyor", tone: "info" };
    case "offers_ready":
      return { label: "Teklifler geldi", tone: "accent" };
    case "appointment_pending":
      return { label: "Randevu yanıtı", tone: "warning" };
    case "scheduled":
      return { label: "Planlandı", tone: "info" };
    case "service_in_progress":
      return { label: "Servis sürüyor", tone: "success" };
    case "parts_approval":
      return { label: "Parça onayın bekliyor", tone: "warning" };
    case "invoice_approval":
      return { label: "Fatura onayın bekliyor", tone: "warning" };
    default:
      return null;
  }
}

function deriveSticky(dossier: CaseDossierResponse): StickyVariant {
  const status = dossier.shell.status;
  if (status === "matching" || status === "offers_ready") {
    return { kind: "offers" };
  }
  if (status === "appointment_pending" && dossier.appointment) {
    return { kind: "appointment" };
  }
  if (
    status === "scheduled" ||
    status === "service_in_progress" ||
    status === "parts_approval" ||
    status === "invoice_approval"
  ) {
    return { kind: "process" };
  }
  return { kind: "none" };
}

function formatMoney(amount: string | number | null | undefined): string | null {
  if (amount == null) return null;
  const parsed =
    typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return null;
  return `₺${parsed.toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
  })}`;
}

function offerStatusLabel(status: OfferSummary["status"]): {
  label: string;
  tone: "success" | "warning" | "info" | "neutral" | "accent";
} {
  switch (status) {
    case "pending":
      return { label: "Bekliyor", tone: "info" };
    case "shortlisted":
      return { label: "Favorilere alındı", tone: "accent" };
    case "accepted":
      return { label: "Kabul edildi", tone: "success" };
    case "rejected":
      return { label: "Reddedildi", tone: "neutral" };
    case "expired":
      return { label: "Süresi doldu", tone: "neutral" };
    case "withdrawn":
      return { label: "Geri çekildi", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

function providerTypeLabel(providerType: string | null | undefined): string | null {
  switch (providerType) {
    case "usta":
      return "Servis";
    case "oto_aksesuar":
      return "Oto aksesuar";
    case "oto_elektrik":
      return "Oto elektrik";
    case "kaporta_boya":
      return "Kaporta boya";
    case "lastik":
      return "Lastik";
    case "cekici":
      return "Çekici";
    default:
      return null;
  }
}

function notifyCtaLabel(
  state: CaseDossierResponse["matches"][number]["notify_state"],
) {
  switch (state) {
    case "available":
      return "Vakayı bildir";
    case "already_notified":
      return "Bildirildi";
    case "has_offer":
      return "Teklif geldi";
    case "limit_reached":
      return "Bildirim limiti doldu";
    default:
      return "Uygun değil";
  }
}

function kindDetailRows(
  detail: KindDetailSection,
): { label: string; value: string }[] {
  switch (detail.kind) {
    case "accident":
      return [
        { label: "Hasar bölgesi", value: detail.damage_area ?? "Belirtilmedi" },
        {
          label: "Hasar şiddeti",
          value: detail.damage_severity ?? "Belirtilmedi",
        },
        {
          label: "Kasko / trafik",
          value:
            detail.kasko_selected || detail.sigorta_selected
              ? [
                detail.kasko_selected ? "Kasko" : null,
                detail.sigorta_selected ? "Trafik" : null,
              ]
                .filter(Boolean)
                .join(" + ")
              : "Seçilmedi",
        },
      ];
    case "breakdown":
      return [
        { label: "Arıza konusu", value: detail.breakdown_category },
        { label: "Belirtiler", value: detail.symptoms ?? "Belirtilmedi" },
        {
          label: "Araç yürür durumda mı",
          value:
            detail.vehicle_drivable == null
              ? "Belirtilmedi"
              : detail.vehicle_drivable
                ? "Evet"
                : "Hayır",
        },
      ];
    case "maintenance":
      return [
        { label: "Bakım türü", value: detail.maintenance_category },
        {
          label: "Bakım seviyesi",
          value: detail.maintenance_tier ?? "Belirtilmedi",
        },
        {
          label: "Kilometre",
          value: detail.mileage_km
            ? `${detail.mileage_km.toLocaleString("tr-TR")} km`
            : "Belirtilmedi",
        },
      ];
    case "towing":
      return [
        { label: "Çekici modu", value: detail.tow_mode },
        { label: "Aşama", value: detail.tow_stage },
        { label: "Alış", value: detail.pickup_label ?? "Belirtilmedi" },
        { label: "Bırakış", value: detail.dropoff_label ?? "Belirtilmedi" },
      ];
    default:
      return [];
  }
}

/* ────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────── */

function DossierSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View className="gap-3">
      <Text
        variant="eyebrow"
        tone="subtle"
        className="pl-1 text-[11px] uppercase tracking-[1.2px]"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Premium araç profili kartı */
function VehicleHeroCard({
  vehicle,
}: {
  vehicle: CaseDossierResponse["vehicle"];
}) {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const yearLabel = vehicle.year ? `${vehicle.year}` : null;
  const fuelLabel = vehicle.fuel_type ?? null;
  const kmLabel = vehicle.current_km
    ? `${vehicle.current_km.toLocaleString("tr-TR")} km`
    : null;

  return (
    <View className="overflow-hidden rounded-[24px] border border-brand-500/20 bg-brand-500/10">
      {/* Top: araç icon + plaka hero */}
      <View className="flex-row items-center gap-4 px-5 pb-3 pt-5">
        <View className="h-14 w-14 items-center justify-center rounded-[18px] border border-brand-500/30 bg-brand-500/15">
          <Icon icon={Car} size={26} color="#0ea5e9" />
        </View>
        <View className="flex-1 gap-1">
          <Text
            variant="display"
            tone="inverse"
            className="text-[24px] font-bold leading-[28px] tracking-[1px]"
          >
            {vehicle.plate}
          </Text>
          {makeModel ? (
            <Text
              variant="body"
              tone="muted"
              className="text-app-text-muted text-[14px] leading-[18px]"
            >
              {makeModel}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Bottom: araç detayları — badges */}
      <View className="flex-row flex-wrap gap-2 border-t border-brand-500/10 px-5 pb-4 pt-3">
        {yearLabel ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-app-surface/80 px-3 py-1.5">
            <Icon icon={Shield} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-[11px] font-medium"
            >
              {yearLabel}
            </Text>
          </View>
        ) : null}
        {fuelLabel ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-app-surface/80 px-3 py-1.5">
            <Icon icon={Fuel} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-[11px] font-medium"
            >
              {fuelLabel}
            </Text>
          </View>
        ) : null}
        {kmLabel ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-app-surface/80 px-3 py-1.5">
            <Icon icon={Gauge} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-[11px] font-medium"
            >
              {kmLabel}
            </Text>
          </View>
        ) : null}
        {vehicle.vin ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-app-surface/80 px-3 py-1.5">
            <Icon icon={FileText} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-[10px] font-medium"
            >
              VIN …{vehicle.vin.slice(-6)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Offer card — prominent pricing display */
function OfferCard({ offer }: { offer: OfferSummary }) {
  const money = formatMoney(offer.amount);
  const statusInfo = offerStatusLabel(offer.status);

  return (
    <View className="gap-2.5 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
            <Icon icon={User} size={18} color="#83a7ff" />
          </View>
          <Text variant="label" tone="inverse" className="text-[14px]">
            {offer.technician_display_label ?? "Servis teklifi"}
          </Text>
        </View>
        <StatusChip label={statusInfo.label} tone={statusInfo.tone} />
      </View>
      <View className="flex-row items-end justify-between border-t border-app-outline/50 pt-2.5">
        <Text
          variant="display"
          tone="inverse"
          className="text-[26px] font-bold leading-[30px]"
        >
          {money ?? "Tutar bekleniyor"}
        </Text>
        <Icon icon={ChevronRight} size={18} color="#83a7ff" />
      </View>
    </View>
  );
}

/** Match card — score visualization */
function MatchCard({
  match,
  notifyPending,
  onNotify,
}: {
  match: CaseDossierResponse["matches"][number];
  notifyPending: boolean;
  onNotify: (match: CaseDossierResponse["matches"][number]) => void;
}) {
  const scoreNum =
    typeof match.score === "number"
      ? match.score
      : Number.parseFloat(match.score);
  const scorePercent = Number.isFinite(scoreNum) ? Math.round(scoreNum) : null;
  const providerLabel = providerTypeLabel(match.provider_type);
  const canNotify = match.can_notify && Boolean(match.technician_profile_id);
  const ctaLabel = notifyCtaLabel(match.notify_state);

  return (
    <View className="gap-3 rounded-[20px] border border-app-success/25 bg-app-success-soft px-4 py-3.5">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2 pr-2">
          <View className="h-10 w-10 items-center justify-center rounded-full border border-app-success/20 bg-app-success/10">
            <Icon icon={Wrench} size={18} color="#2dd28d" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="inverse" className="text-[14px]">
              {match.display_name ?? "Uygun servis"}
            </Text>
            {match.tagline || providerLabel || match.area_label ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
                numberOfLines={1}
              >
                {[match.tagline, providerLabel, match.area_label]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        </View>
        {scorePercent !== null ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-app-success/15 px-2.5 py-1">
            <Icon icon={Star} size={11} color="#2dd28d" />
            <Text
              variant="caption"
              tone="success"
              className="text-[11px] font-semibold"
            >
              %{scorePercent}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <TrustBadge
          label={match.match_badge ?? "Bu vakaya uygun"}
          tone="success"
        />
        {match.verified_level ? (
          <TrustBadge
            label={
              match.verified_level === "premium"
                ? "Premium"
                : match.verified_level === "verified"
                  ? "Doğrulanmış"
                  : "Temel kayıt"
            }
            tone="info"
          />
        ) : null}
      </View>
      <Text variant="caption" tone="muted" className="text-app-text-muted">
        {match.reason_label}
      </Text>
      <Button
        label={ctaLabel}
        variant={canNotify ? "primary" : "outline"}
        disabled={!canNotify}
        loading={notifyPending && canNotify}
        onPress={() => onNotify(match)}
        fullWidth
      />
      {!canNotify && match.notify_disabled_reason ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-center text-[11px]"
        >
          {match.notify_disabled_reason === "case_notification_limit_reached"
            ? "Bu vaka için bildirim limiti doldu."
            : match.notify_disabled_reason === "already_notified"
              ? "Bu servis zaten bilgilendirildi."
              : match.notify_disabled_reason === "has_offer"
                ? "Bu servisten teklif geldi."
                : "Bu kart şu an bildirim alamıyor."}
        </Text>
      ) : null}
    </View>
  );
}

/** Milestone card with status indicator */
function MilestoneCard({
  milestone,
}: {
  milestone: CaseDossierResponse["milestones"][number];
}) {
  const statusColor =
    milestone.status === "completed"
      ? "#2dd28d"
      : milestone.status === "active"
        ? "#0ea5e9"
        : milestone.status === "blocked"
          ? "#ef4444"
          : "#525e81";

  const StatusIcon =
    milestone.status === "completed" ? CheckCircle : Clock;

  return (
    <View className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-3.5 py-3">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={StatusIcon} size={16} color={statusColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {milestone.title}
        </Text>
        {milestone.description ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px]"
          >
            {milestone.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Timeline event row */
function TimelineRow({
  event,
}: {
  event: CaseDossierResponse["timeline_summary"][number];
}) {
  const dateStr = new Date(event.occurred_at).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View className="flex-row gap-3 border-t border-app-outline/40 pt-2.5">
      <View className="mt-0.5 h-2 w-2 rounded-full bg-brand-500/60" />
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[12px]">
          {event.title}
        </Text>
        {event.context_summary ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px] leading-[15px]"
          >
            {event.context_summary}
          </Text>
        ) : null}
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[10px]"
        >
          {dateStr}
        </Text>
      </View>
    </View>
  );
}

function ProfileActionRow({
  description,
  icon,
  iconColor = "#83a7ff",
  label,
  onPress,
}: {
  description?: string | null;
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={icon} size={16} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[14px]">
          {label}
        </Text>
        {description ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
            numberOfLines={1}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <Icon icon={ChevronRight} size={16} color="#83a7ff" />
    </Pressable>
  );
}

/* ────────────────────────────────────────────────────────────
 * Main Screen
 * ──────────────────────────────────────────────────────────── */

export function CustomerCaseProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";
  const dossierQuery = useCaseDossier(caseId, { apiClient });
  const detailQuery = useCaseDetailLive(caseId);
  const threadQuery = useCaseThreadLive(caseId);
  const dossier = dossierQuery.data;
  const cancelAppointment = useCancelAppointment(
    dossier?.appointment?.id ?? "",
    caseId,
  );
  const addAttachment = useAddCaseAttachment();
  const updateNotes = useUpdateCaseNotes();
  const updateNotesLive = useUpdateCaseNotesLive(caseId);
  const notifyCase = useNotifyCaseToTechnician();
  const towEntry = useTowEntryRoute({
    vehicleId: detailQuery.data?.vehicle_id,
    fallback: `/(modal)/talep/towing?parentCaseId=${caseId}` as Href,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [openApproval, setOpenApproval] = useState<{
    id: string;
    kind: "parts_request" | "invoice" | "completion";
  } | null>(null);

  if (!dossier) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            {dossierQuery.isPending ? "Vaka yükleniyor" : "Vaka bulunamadı"}
          </Text>
          <Button label="Geri" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const kindMeta = CASE_KIND_META[dossier.shell.kind];
  const badge = statusBadge(dossier.shell.status);
  const sticky = deriveSticky(dossier);
  const detailRows = kindDetailRows(dossier.kind_detail);
  const activeOffers = dossier.offers.filter(
    (o) => o.status === "pending" || o.status === "shortlisted",
  );
  const allDocuments = [
    ...dossier.attachments,
    ...dossier.evidence,
    ...dossier.documents,
  ];
  const isActive = !INACTIVE_STATUSES.has(dossier.shell.status);
  const isCancelled = dossier.shell.status === "cancelled";
  const pendingApprovals = dossier.approvals.filter(
    (approval) => approval.status === "pending",
  );
  const threadItems =
    threadQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const latestMessage = threadItems[0] ?? null;
  const linkedTowCaseIds = detailQuery.data?.linked_tow_case_ids ?? [];
  const canLinkTow =
    dossier.shell.kind === "accident" || dossier.shell.kind === "breakdown";
  const customerNotes = dossier.shell.customer_notes ?? "";

  const handleCancelAppointment = () => {
    Alert.alert(
      "Randevuyu iptal et",
      "Randevu talebin iptal edilecek; teklif tekrar bekleme durumuna döner.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal et",
          style: "destructive",
          onPress: async () => {
            await cancelAppointment.mutateAsync();
          },
        },
      ],
    );
  };
  const handleNotifyMatch = async (
    match: CaseDossierResponse["matches"][number],
  ) => {
    if (!match.can_notify || !match.technician_profile_id) return;
    try {
      await notifyCase.mutateAsync({
        caseId: dossier.shell.id,
        technicianProfileId: match.technician_profile_id,
      });
    } catch {
      Alert.alert(
        "Vaka bildirilemedi",
        "Bu servis bu vaka için uygun olmayabilir veya bildirim limitine ulaşılmış olabilir.",
      );
    }
  };
  const handleEditSubmit = async (patch: { summary: string; notes: string }) => {
    await updateNotesLive.mutateAsync({ content: patch.notes || null });
    await updateNotes.mutateAsync({
      caseId: dossier.shell.id,
      summary: patch.summary,
      notes: patch.notes,
    });
    await dossierQuery.refetch();
  };
  const handleAddAttachment = async (attachment: CaseAttachment) => {
    await addAttachment.mutateAsync({ caseId: dossier.shell.id, attachment });
    await dossierQuery.refetch();
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-2">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Vaka dosyası
          </Text>
          <Text
            variant="label"
            tone="inverse"
            className="text-[14px]"
            numberOfLines={1}
          >
            {dossier.shell.title}
          </Text>
        </View>
        <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
        {badge ? <TrustBadge label={badge.label} tone={badge.tone} /> : null}
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-40 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Araç Profili — Hero Card */}
        <VehicleHeroCard vehicle={dossier.vehicle} />

        {/* 2. Vaka detayları */}
        <DossierSection title="Vaka detayları">
          <View className="gap-0.5 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
            <View className="mb-2 flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text variant="eyebrow" tone="subtle">
                  Oluştururken girilen bilgiler
                </Text>
                {dossier.shell.summary ? (
                  <Text
                    variant="body"
                    tone="muted"
                    className="text-[13px] leading-[19px]"
                  >
                    {dossier.shell.summary}
                  </Text>
                ) : null}
              </View>
              {isActive ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Vaka notlarını düzenle"
                  onPress={() => setEditOpen(true)}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface-2"
                >
                  <Icon icon={Pencil} size={14} color="#83a7ff" />
                </Pressable>
              ) : null}
            </View>
            {dossier.shell.summary ? (
              <View className="h-px bg-app-outline/50" />
            ) : null}
            {detailRows.map((row) => (
              <View
                key={row.label}
                className="flex-row justify-between gap-3 border-t border-app-outline/50 py-2.5"
              >
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted flex-1 text-[12px]"
                >
                  {row.label}
                </Text>
                <Text
                  variant="label"
                  tone="inverse"
                  className="flex-1 text-right text-[12px]"
                >
                  {row.value}
                </Text>
              </View>
            ))}
            {dossier.shell.location_label ? (
              <View className="flex-row items-center gap-2 border-t border-app-outline/50 pt-2.5">
                <Icon icon={MapPin} size={13} color="#83a7ff" />
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px]"
                >
                  {dossier.shell.location_label}
                </Text>
              </View>
            ) : null}
            {customerNotes ? (
              <View className="gap-1 border-t border-app-outline/50 pt-2.5">
                <Text variant="eyebrow" tone="subtle">
                  Ek notlar
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted leading-[19px]"
                >
                  {customerNotes}
                </Text>
              </View>
            ) : null}
          </View>
        </DossierSection>

        {canLinkTow ? (
          <DossierSection title="Çekici bağlantısı">
            <View className="gap-2">
              {linkedTowCaseIds.map((towId) => (
                <ProfileActionRow
                  key={towId}
                  icon={Truck}
                  iconColor="#0ea5e9"
                  label="Bu vakanın çekicisini aç"
                  description={`Çekici #${towId.slice(0, 8)}`}
                  onPress={() => router.push(`/cekici/${towId}` as Href)}
                />
              ))}
              {linkedTowCaseIds.length === 0 && isActive ? (
                <ProfileActionRow
                  icon={Truck}
                  label="Bu vakaya bağlı çekici çağır"
                  description="Çekici gerekiyorsa ayrı ama bağlı bir çekici vakası açılır."
                  onPress={() => router.push(towEntry.route as Href)}
                />
              ) : null}
            </View>
          </DossierSection>
        ) : null}

        {/* 3. Eşleşen Ustalar */}
        <DossierSection title="Uygun ustalar">
          {dossier.matches.length > 0 ? (
            <View className="gap-2.5">
              {dossier.matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  notifyPending={notifyCase.isPending}
                  onNotify={handleNotifyMatch}
                />
              ))}
            </View>
          ) : (
            <View className="items-center gap-2 rounded-[20px] border border-dashed border-app-outline bg-app-surface/60 px-4 py-6">
              <Icon icon={Wrench} size={24} color="#525e81" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-center"
              >
                Uygun usta listesi hazırlanıyor.
              </Text>
            </View>
          )}
        </DossierSection>

        {/* 4. Gelen teklifler */}
        <DossierSection title={`Gelen teklifler (${activeOffers.length})`}>
          {activeOffers.length > 0 ? (
            <View className="gap-3">
              {activeOffers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </View>
          ) : (
            <View className="items-center gap-2 rounded-[20px] border border-dashed border-app-outline bg-app-surface/60 px-4 py-6">
              <Icon icon={Clock} size={24} color="#525e81" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-center"
              >
                Henüz teklif gelmedi. Uygun ustalar taranıyor.
              </Text>
            </View>
          )}
        </DossierSection>

        {pendingApprovals.length > 0 ? (
          <DossierSection title="Bekleyen onaylar">
            <View className="gap-2">
              {pendingApprovals.map((approval) => (
                <ProfileActionRow
                  key={approval.id}
                  icon={
                    approval.kind === "completion" ? CheckCircle : FileText
                  }
                  iconColor={
                    approval.kind === "parts_request"
                      ? "#f5b33f"
                      : approval.kind === "completion"
                        ? "#2dd28d"
                        : "#0ea5e9"
                  }
                  label={approval.title}
                  description={approval.description}
                  onPress={() =>
                    setOpenApproval({
                      id: approval.id,
                      kind: approval.kind,
                    })
                  }
                />
              ))}
            </View>
          </DossierSection>
        ) : null}

        {/* 5. Dosyalar ve kanıtlar */}
        <DossierSection title="Dosyalar">
          <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
            {allDocuments.length > 0 ? (
              allDocuments.slice(0, 6).map((item) => (
                <View
                  key={`${item.id}-${item.title}`}
                  className="flex-row items-center gap-3 border-b border-app-outline/40 pb-2.5 last:border-0 last:pb-0"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-app-surface-2">
                    <Icon icon={FileText} size={14} color="#83a7ff" />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text
                      variant="label"
                      tone="inverse"
                      className="text-[12px]"
                    >
                      {item.title}
                    </Text>
                    {"status_label" in item && item.status_label ? (
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-[10px]"
                      >
                        {item.status_label}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted"
              >
                Henüz dosya eklenmemiş.
              </Text>
            )}
            <View className="flex-row gap-2">
              {isActive ? (
                <View className="flex-1">
                  <Button
                    label="Dosya ekle"
                    variant="outline"
                    leftIcon={<Icon icon={Plus} size={14} color="#83a7ff" />}
                    onPress={() => setAttachOpen(true)}
                    fullWidth
                  />
                </View>
              ) : null}
              {allDocuments.length > 0 ? (
                <View className="flex-1">
                  <Button
                    label="Tümünü gör"
                    variant="outline"
                    onPress={() =>
                      router.push(`/vaka/${dossier.shell.id}/belgeler` as Href)
                    }
                    fullWidth
                  />
                </View>
              ) : null}
            </View>
          </View>
        </DossierSection>

        {/* 6. Süreç — milestone + task */}
        <DossierSection title="Süreç">
          {dossier.milestones.length > 0 ? (
            <View className="gap-2">
              {dossier.milestones.map((milestone) => (
                <MilestoneCard key={milestone.id} milestone={milestone} />
              ))}
            </View>
          ) : (
            <View className="items-center gap-2 rounded-[20px] border border-dashed border-app-outline bg-app-surface/60 px-4 py-6">
              <Icon icon={Truck} size={24} color="#525e81" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-center"
              >
                Süreç adımları eşleşme sonrası açılır.
              </Text>
            </View>
          )}
          {dossier.tasks.length > 0 ? (
            <View className="mt-1 gap-2">
              {dossier.tasks.map((task) => (
                <View
                  key={task.id}
                  className="rounded-[16px] border border-app-accent/30 bg-app-accent-soft px-3.5 py-3"
                >
                  <Text variant="label" tone="inverse" className="text-[13px]">
                    {task.title}
                  </Text>
                  {task.helper_label ? (
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text-muted text-[11px]"
                    >
                      {task.helper_label}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </DossierSection>

        {/* 7. Vaka geçmişi */}
        <DossierSection title="Vaka geçmişi">
          {dossier.timeline_summary.length > 0 ? (
            <View className="gap-1 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
              {dossier.timeline_summary.slice(0, 8).map((event) => (
                <TimelineRow key={event.id} event={event} />
              ))}
            </View>
          ) : (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted pl-1"
            >
              Vaka geçmişi henüz oluşmadı.
            </Text>
          )}
        </DossierSection>

        <DossierSection title="İletişim ve ödeme">
          <View className="gap-2">
            <ProfileActionRow
              icon={MessageSquare}
              label="Mesajlar"
              description={
                latestMessage
                  ? `${latestMessage.sender_role === "customer" ? "Sen" : "Servis"}: ${latestMessage.content}`
                  : "Henüz mesaj yok"
              }
              onPress={() =>
                router.push(`/vaka/${dossier.shell.id}/mesajlar` as Href)
              }
            />
            <BillingSummaryCard
              caseId={dossier.shell.id}
              estimateFallback={
                dossier.payment_snapshot.estimate_amount == null
                  ? null
                  : String(dossier.payment_snapshot.estimate_amount)
              }
            />
          </View>
        </DossierSection>

        {!isActive && !isCancelled ? (
          <Button
            label="Benzer talep aç"
            variant="outline"
            onPress={() =>
              router.push(`/(modal)/talep/${dossier.shell.kind}` as Href)
            }
          />
        ) : null}

        {isActive ? (
          <View className="gap-3 rounded-[20px] border border-app-critical/30 bg-app-surface px-4 py-4">
            <View className="flex-row items-center gap-2">
              <Icon icon={XCircle} size={15} color="#ef4444" />
              <Text variant="eyebrow" tone="critical">
                Vaka yönetimi
              </Text>
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted leading-5"
            >
              Vakayı iptal edersen aktif teklif ve randevu düşer.
            </Text>
            <Button
              label="Vakayı iptal et"
              variant="outline"
              onPress={() => setCancelSheetOpen(true)}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      {sticky.kind !== "none" ? (
        <View
          className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-6 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {sticky.kind === "offers" ? (
            <Button
              label="Teklifleri gör"
              size="lg"
              onPress={() =>
                router.push(
                  `/vaka/${dossier.shell.id}/teklifler` as Href,
                )
              }
              fullWidth
            />
          ) : null}
          {sticky.kind === "appointment" ? (
            <Button
              label="Randevuyu iptal et"
              variant="outline"
              loading={cancelAppointment.isPending}
              onPress={handleCancelAppointment}
              fullWidth
            />
          ) : null}
          {sticky.kind === "process" ? (
            <Button
              label="Süreç takibine git"
              size="lg"
              onPress={() =>
                router.push(`/vaka/${dossier.shell.id}/surec` as Href)
              }
              fullWidth
            />
          ) : null}
        </View>
      ) : null}

      <EditCaseNotesSheet
        visible={editOpen}
        initialSummary={dossier.shell.summary ?? ""}
        initialNotes={customerNotes}
        onClose={() => setEditOpen(false)}
        onSubmit={(patch) => {
          void handleEditSubmit(patch);
        }}
      />

      <AddAttachmentSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onSubmit={(attachment) => {
          void handleAddAttachment(attachment);
        }}
        target={{
          purpose: "case_evidence_photo",
          ownerRef: `case:${dossier.shell.id}`,
        }}
      />

      <CancellationSheet
        visible={cancelSheetOpen}
        caseId={dossier.shell.id}
        stage={deriveBillingStage(dossier.shell.status)}
        estimate={null}
        onClose={() => setCancelSheetOpen(false)}
        onCancelled={() => router.replace("/(tabs)/" as Href)}
      />

      <PartsApprovalSheet
        visible={openApproval?.kind === "parts_request"}
        caseId={dossier.shell.id}
        approvalId={
          openApproval?.kind === "parts_request" ? openApproval.id : null
        }
        onClose={() => setOpenApproval(null)}
        onTalkToTechnician={(threadCaseId) =>
          router.push(`/vaka/${threadCaseId}/mesajlar` as Href)
        }
      />

      <InvoiceApprovalSheet
        visible={openApproval?.kind === "invoice"}
        caseId={dossier.shell.id}
        approvalId={openApproval?.kind === "invoice" ? openApproval.id : null}
        onClose={() => setOpenApproval(null)}
        onTalkToTechnician={(threadCaseId) =>
          router.push(`/vaka/${threadCaseId}/mesajlar` as Href)
        }
      />

      <CompletionApprovalSheet
        visible={openApproval?.kind === "completion"}
        caseId={dossier.shell.id}
        approvalId={
          openApproval?.kind === "completion" ? openApproval.id : null
        }
        onClose={() => setOpenApproval(null)}
        onTalkToTechnician={(threadCaseId) =>
          router.push(`/vaka/${threadCaseId}/mesajlar` as Href)
        }
      />
    </SafeAreaView>
  );
}
