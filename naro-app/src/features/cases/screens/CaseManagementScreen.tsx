import type { CaseDocument } from "@naro/domain";
import {
  Avatar,
  BackButton,
  Button,
  Icon,
  StatusChip,
  Surface,
  Text,
  TrustBadge,
  VehicleContextBar,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  AudioWaveform,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  Film,
  Hourglass,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCaseApprovals } from "@/features/approvals";
import {
  BillingSummaryCard,
  CancellationSheet,
  CompletionApprovalSheet,
  InvoiceApprovalSheet,
  PartsApprovalSheet,
  type CaseBillingStage,
} from "@/features/billing";
import { useCaseOffers } from "@/features/offers";
import { useUstaPreviewStore } from "@/features/ustalar";
import { mockTechnicianProfiles } from "@/features/ustalar/data/fixtures";
import { useVehicle } from "@/features/vehicles";
import { openMediaAsset } from "@/shared/media/openAsset";

import {
  useAddCaseAttachment,
  useAppointmentCountdown,
  useCancelCase,
  useCaseDetail,
  useUpdateCaseNotes,
} from "../api";
import { AddAttachmentSheet } from "../components/AddAttachmentSheet";
import { EditCaseNotesSheet } from "../components/EditCaseNotesSheet";
import { getCaseKindLabel, getCaseStatusLabel, getCaseStatusTone } from "../presentation";

const INACTIVE_STATUSES = new Set<string>(["completed", "archived", "cancelled"]);

const ATTACHMENT_ICON: Record<string, LucideIcon> = {
  photo: Camera,
  video: Film,
  audio: AudioWaveform,
  document: FileText,
  invoice: FileText,
  report: FileText,
  location: FileText,
};

const ATTACHMENT_COLOR: Record<string, string> = {
  photo: "#83a7ff",
  video: "#0ea5e9",
  audio: "#2dd28d",
  document: "#f5b33f",
  invoice: "#f5b33f",
  report: "#f5b33f",
  location: "#83a7ff",
};

type ApprovalKind = "parts_request" | "invoice" | "completion";

const APPROVAL_META: Record<
  ApprovalKind,
  {
    label: string;
    icon: LucideIcon;
    iconColor: string;
    containerClass: string;
    iconBgClass: string;
    textTone: "warning" | "accent" | "success";
  }
> = {
  parts_request: {
    label: "Ek parça onayı bekliyor",
    icon: Sparkles,
    iconColor: "#f5b33f",
    containerClass: "border-app-warning/40 bg-app-warning-soft",
    iconBgClass: "bg-app-warning/20",
    textTone: "warning",
  },
  invoice: {
    label: "Fatura onayı bekliyor",
    icon: FileText,
    iconColor: "#0ea5e9",
    containerClass: "border-brand-500/40 bg-brand-500/10",
    iconBgClass: "bg-brand-500/20",
    textTone: "accent",
  },
  completion: {
    label: "İş tamamlandı — son onay",
    icon: CheckCircle2,
    iconColor: "#2dd28d",
    containerClass: "border-app-success/40 bg-app-success-soft",
    iconBgClass: "bg-app-success/20",
    textTone: "success",
  },
};

export function CaseManagementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";
  const { data: caseItem } = useCaseDetail(caseId);
  const { data: vehicle } = useVehicle(caseItem?.vehicle_id ?? "");
  const countdown = useAppointmentCountdown(caseId);
  const openPreview = useUstaPreviewStore((state) => state.open);

  const cancelCase = useCancelCase();
  const addAttachment = useAddCaseAttachment();
  const updateNotes = useUpdateCaseNotes();

  const [editOpen, setEditOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [openApproval, setOpenApproval] = useState<{
    id: string;
    kind: "parts_request" | "invoice" | "completion";
  } | null>(null);

  // Canlı approvals (BE shipped 2026-04-23): case bazlı pending liste
  const approvalsQuery = useCaseApprovals(caseId);
  const pendingApprovals = useMemo(
    () => (approvalsQuery.data ?? []).filter((a) => a.status === "pending"),
    [approvalsQuery.data],
  );
  const offersQuery = useCaseOffers(caseId);
  const offers = offersQuery.data ?? [];

  const assignedTechnician = useMemo(() => {
    if (!caseItem) return null;
    const techId =
      caseItem.assigned_technician_id ?? caseItem.preferred_technician_id;
    if (!techId) return null;
    return mockTechnicianProfiles.find((t) => t.id === techId) ?? null;
  }, [caseItem]);

  if (!caseItem) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Vaka bulunamadı
          </Text>
          <Button
            label="Geri dön"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = !INACTIVE_STATUSES.has(caseItem.status);
  const isCancelled = caseItem.status === "cancelled";
  const documents = caseItem.documents ?? [];
  const lastMessage =
    caseItem.thread.messages[caseItem.thread.messages.length - 1] ?? null;
  const hasProcessBridge = [
    "appointment_pending",
    "scheduled",
    "service_in_progress",
    "parts_approval",
    "invoice_approval",
  ].includes(caseItem.status);
  const showFinderHint =
    caseItem.status === "matching" || caseItem.status === "offers_ready";

  const handleCancel = () => {
    setCancelSheetOpen(true);
  };

  const handleEditSubmit = (patch: { summary: string; notes: string }) => {
    void updateNotes.mutateAsync({
      caseId,
      summary: patch.summary,
      notes: patch.notes,
    });
  };

  const handleAddAttachment = (
    attachment: Parameters<typeof addAttachment.mutate>[0]["attachment"],
  ) => {
    void addAttachment.mutateAsync({ caseId, attachment });
  };

  return (
    <SafeAreaView className="flex-1 bg-app-bg" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton onPress={() => router.back()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vaka profilini aç"
          onPress={() =>
            router.push(`/(modal)/vaka-profili/${caseItem.id}` as Href)
          }
          className="flex-1 flex-row items-center justify-center gap-1.5 active:opacity-85"
        >
          <Text variant="h2" tone="inverse" className="text-[18px]">
            Vakam
          </Text>
          <Icon icon={ChevronRight} size={14} color="#83a7ff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Özet kartı */}
        <Surface
          variant="raised"
          radius="lg"
          className="gap-3 border-app-outline-strong bg-app-surface-2 px-4 py-4"
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <TrustBadge label={getCaseKindLabel(caseItem.kind)} tone="accent" />
            <StatusChip
              label={getCaseStatusLabel(caseItem.status)}
              tone={getCaseStatusTone(caseItem.status)}
            />
          </View>
          <Text variant="display" tone="inverse" className="text-[20px] leading-[24px]">
            {caseItem.title}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-subtle text-[11px]">
            {`Oluşturuldu · ${caseItem.created_at_label} · #${caseItem.id.slice(0, 8)}`}
          </Text>
        </Surface>

        {/* Süreç köprüsü */}
        {hasProcessBridge ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ustayla süreci aç"
            onPress={() => router.push(`/vaka/${caseId}/surec` as Href)}
            className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/40 bg-brand-500/10 px-4 py-3.5 active:opacity-90"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
              <Icon
                icon={caseItem.status === "appointment_pending" ? Hourglass : Sparkles}
                size={18}
                color="#0ea5e9"
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Ustayla süreç
              </Text>
              <Text variant="label" tone="inverse" className="text-[14px]">
                {caseItem.next_action_title || getCaseStatusLabel(caseItem.status)}
              </Text>
              {countdown.label ? (
                <Text variant="caption" tone="warning" className="text-[11px]">
                  {countdown.label}
                </Text>
              ) : caseItem.next_action_description ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px]"
                  numberOfLines={2}
                >
                  {caseItem.next_action_description}
                </Text>
              ) : null}
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
          </Pressable>
        ) : null}

        {/* Usta henüz yok */}
        {showFinderHint ? (
          <Surface variant="flat" radius="lg" className="gap-3 px-4 py-3.5">
            <View className="flex-row items-center gap-2">
              <Icon icon={Sparkles} size={14} color="#83a7ff" />
              <Text variant="label" tone="inverse" className="text-[14px]">
                {caseItem.status === "matching"
                  ? "Usta henüz seçilmedi"
                  : `${offers.length} teklif hazır`}
              </Text>
            </View>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              {caseItem.status === "matching"
                ? "Uygun ustalar senin için taranıyor. Çarşı'dan manuel de seçebilirsin."
                : "Teklifleri karşılaştır ve uygun olanıyla randevu al."}
            </Text>
            {caseItem.status === "offers_ready" ? (
              <Button
                label="Teklifleri aç"
                onPress={() =>
                  router.push(`/vaka/${caseId}/teklifler` as Href)
                }
              />
            ) : (
              <Button
                label="Usta ara"
                variant="outline"
                onPress={() => router.push("/(tabs)/carsi" as Href)}
              />
            )}
          </Surface>
        ) : null}

        {/* Araç kartı */}
        {vehicle ? (
          <VehicleContextBar
            plate={vehicle.plate}
            vehicle={`${vehicle.make} ${vehicle.model} · ${vehicle.year}`}
            subtitle={vehicle.note}
            onPress={() => router.push(`/arac/${vehicle.id}` as Href)}
          />
        ) : null}

        {/* Atanmış usta (scheduled ve sonrası için) */}
        {assignedTechnician && !showFinderHint ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${assignedTechnician.name} önizleme`}
            onPress={() => openPreview(assignedTechnician.id)}
            className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
          >
            <Avatar name={assignedTechnician.name} size="md" />
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Atanan usta
              </Text>
              <Text variant="label" tone="inverse" className="text-[14px]">
                {assignedTechnician.name}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
                numberOfLines={1}
              >
                {assignedTechnician.tagline}
              </Text>
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
          </Pressable>
        ) : null}

        {/* Özet + notlar */}
        <Surface variant="flat" radius="lg" className="gap-3 px-4 py-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text variant="eyebrow" tone="subtle">
                Özet
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text leading-[20px]"
              >
                {caseItem.summary || "Özet girilmemiş."}
              </Text>
            </View>
            {isActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notları düzenle"
                onPress={() => setEditOpen(true)}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface-2"
              >
                <Icon icon={Pencil} size={14} color="#83a7ff" />
              </Pressable>
            ) : null}
          </View>
          {caseItem.request.notes ? (
            <>
              <View className="h-px bg-app-outline" />
              <View className="gap-1">
                <Text variant="eyebrow" tone="subtle">
                  Ek notlar
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted leading-[20px]"
                >
                  {caseItem.request.notes}
                </Text>
              </View>
            </>
          ) : null}
        </Surface>

        {/* Dosyalar */}
        <Surface variant="flat" radius="lg" className="gap-3 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="inverse" className="text-[14px]">
              Dosyalar
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-subtle text-[11px]">
              {documents.length} dosya
            </Text>
          </View>
          {documents.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {documents.slice(0, 4).map((doc: CaseDocument) => {
                const IconCmp = ATTACHMENT_ICON[doc.kind] ?? FileText;
                const color = ATTACHMENT_COLOR[doc.kind] ?? "#83a7ff";
                return (
                  <Pressable
                    key={doc.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${doc.title} dosyasını aç`}
                    onPress={() => void openMediaAsset(doc.asset, "preview")}
                    className="w-24 items-center gap-1.5 rounded-[14px] border border-app-outline bg-app-surface-2 px-2 py-2.5 active:opacity-85"
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-app-bg">
                      <Icon icon={IconCmp} size={16} color={color} />
                    </View>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text text-[11px] text-center"
                      numberOfLines={2}
                    >
                      {doc.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              Henüz dosya eklenmemiş.
            </Text>
          )}
          <View className="flex-row gap-2">
            {isActive ? (
              <Button
                label="Dosya ekle"
                variant="outline"
                leftIcon={<Icon icon={Plus} size={14} color="#83a7ff" />}
                className="flex-1"
                onPress={() => setAttachOpen(true)}
              />
            ) : null}
            {documents.length > 4 ? (
              <Button
                label="Tümünü gör"
                variant="outline"
                className="flex-1"
                onPress={() =>
                  router.push(`/vaka/${caseId}/belgeler` as Href)
                }
              />
            ) : null}
          </View>
        </Surface>

        {/* Mesajlar özeti */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mesajları aç"
          onPress={() => router.push(`/vaka/${caseId}/mesajlar` as Href)}
          className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
            <Icon icon={MessageSquare} size={16} color="#83a7ff" />
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text variant="label" tone="inverse" className="text-[14px]">
                Mesajlar
              </Text>
              {caseItem.thread.unread_count > 0 ? (
                <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-app-critical px-1.5">
                  <Text
                    variant="caption"
                    tone="inverse"
                    className="text-[10px] font-semibold"
                  >
                    {caseItem.thread.unread_count}
                  </Text>
                </View>
              ) : null}
            </View>
            {lastMessage ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
                numberOfLines={1}
              >
                {`${lastMessage.author_name}: ${lastMessage.body}`}
              </Text>
            ) : (
              <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
                Henüz mesaj yok
              </Text>
            )}
          </View>
          <Icon icon={ChevronRight} size={16} color="#83a7ff" />
        </Pressable>

        {/* Teklifler özeti */}
        {offers.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Teklifleri aç"
            onPress={() => router.push(`/vaka/${caseId}/teklifler` as Href)}
            className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-app-success/15">
              <Icon icon={FileText} size={16} color="#2dd28d" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse" className="text-[14px]">
                Teklifler
              </Text>
              <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
                {`${offers.length} teklif${offers[0] ? ` · ${formatOfferPrice(offers[0].amount, offers[0].currency)}` : ""}`}
              </Text>
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
          </Pressable>
        ) : null}

        {/* Bekleyen onay talepleri — canlı approvals endpoint */}
        {pendingApprovals.map((approval) => {
          const meta = APPROVAL_META[approval.kind];
          return (
            <Pressable
              key={approval.id}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label} onayını aç`}
              onPress={() =>
                setOpenApproval({ id: approval.id, kind: approval.kind })
              }
              className={[
                "flex-row items-center gap-3 rounded-[16px] border px-4 py-3.5 active:opacity-90",
                meta.containerClass,
              ].join(" ")}
            >
              <View
                className={[
                  "h-9 w-9 items-center justify-center rounded-full",
                  meta.iconBgClass,
                ].join(" ")}
              >
                <Icon icon={meta.icon} size={15} color={meta.iconColor} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text
                  variant="label"
                  tone={meta.textTone}
                  className="text-[13px]"
                >
                  {meta.label}
                </Text>
                {approval.description ? (
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[11px]"
                    numberOfLines={1}
                  >
                    {approval.description}
                  </Text>
                ) : null}
              </View>
              <Icon icon={ChevronRight} size={14} color="#83a7ff" />
            </Pressable>
          );
        })}

        {/* Billing summary — BE billing summary endpoint 404 iken
            komponent sessizce null döner (ödeme akışı henüz başlamamış). */}
        <BillingSummaryCard caseId={caseId} />

        {/* Metadata */}
        <View className="items-center pt-2">
          <Text variant="caption" tone="muted" className="text-app-text-subtle text-[10px]">
            {`Son güncelleme · ${caseItem.updated_at_label}`}
          </Text>
        </View>

        {/* Kapandı durumunda benzer talep */}
        {!isActive && !isCancelled ? (
          <Button
            label="Benzer talep aç"
            variant="outline"
            onPress={() =>
              router.push(`/(modal)/talep/${caseItem.kind}` as Href)
            }
          />
        ) : null}

        {/* Tehlikeli bölge */}
        {isActive ? (
          <Surface
            variant="flat"
            radius="lg"
            className="mt-4 gap-3 border-app-critical/30 px-4 py-4"
          >
            <Text variant="eyebrow" tone="critical">
              Tehlikeli bölge
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              Vakayı iptal edersen aktif teklif ve randevu düşer. Geri alma yok.
            </Text>
            <Button
              label="Vakayı iptal et"
              variant="outline"
              loading={cancelCase.isPending}
              onPress={handleCancel}
            />
          </Surface>
        ) : null}
      </ScrollView>

      <EditCaseNotesSheet
        visible={editOpen}
        initialSummary={caseItem.summary}
        initialNotes={caseItem.request.notes ?? ""}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      <AddAttachmentSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onSubmit={handleAddAttachment}
        target={{ purpose: "case_evidence_photo", ownerRef: `case:${caseId}` }}
      />

      <CancellationSheet
        visible={cancelSheetOpen}
        caseId={caseId}
        stage={deriveBillingStage(caseItem.status)}
        estimate={null}
        onClose={() => setCancelSheetOpen(false)}
        onCancelled={() => router.replace("/(tabs)/" as Href)}
      />

      <PartsApprovalSheet
        visible={openApproval?.kind === "parts_request"}
        caseId={caseId}
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
        caseId={caseId}
        approvalId={openApproval?.kind === "invoice" ? openApproval.id : null}
        onClose={() => setOpenApproval(null)}
        onTalkToTechnician={(threadCaseId) =>
          router.push(`/vaka/${threadCaseId}/mesajlar` as Href)
        }
      />

      <CompletionApprovalSheet
        visible={openApproval?.kind === "completion"}
        caseId={caseId}
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

function formatOfferPrice(amountRaw: string, currency: string): string {
  const parsed = Number.parseFloat(amountRaw);
  if (Number.isNaN(parsed)) return `${amountRaw} ${currency}`;
  const formatted = parsed.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "TRY" ? "₺" : currency;
  return `${formatted} ${symbol}`;
}

function deriveBillingStage(status: string): CaseBillingStage {
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
