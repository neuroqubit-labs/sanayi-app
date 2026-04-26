import {
  Avatar,
  BackButton,
  Button,
  Icon,
  Text,
  VehicleContextBar,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
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
import { useTowEntryRoute } from "@/features/tow/entry";
import { useUstaPreviewStore } from "@/features/ustalar";
import { useTechnicianPublicView } from "@/features/ustalar/api";
import { useVehicle } from "@/features/vehicles";

import {
  useAddCaseAttachment,
  useAppointmentCountdown,
  useUpdateCaseNotes,
  useUpdateCaseNotesLive,
} from "../api";
import { AddAttachmentSheet } from "../components/AddAttachmentSheet";
import { EditCaseNotesSheet } from "../components/EditCaseNotesSheet";
import { SubtypeDetailCard } from "../components/SubtypeDetailCard";
import { VehicleSnapshotCard } from "../components/VehicleSnapshotCard";
import { ManagementApprovalsSection } from "../components/management/ManagementApprovalsSection";
import { MessagesPreviewSection, OffersPreviewSection } from "../components/management/ManagementContactSections";
import { ManagementDocumentsSection } from "../components/management/ManagementDocumentsSection";
import { ManagementHazardZone } from "../components/management/ManagementHazardZone";
import { ManagementHeader } from "../components/management/ManagementHeader";
import { ManagementMatchingSection } from "../components/management/ManagementMatchingSection";
import { ManagementNotesSection } from "../components/management/ManagementNotesSection";
import { ManagementProcessBridge } from "../components/management/ManagementProcessBridge";
import { ManagementTowingSection } from "../components/management/ManagementTowingSection";
import { useCanonicalCase } from "../hooks/useCanonicalCase";

const INACTIVE_STATUSES = new Set<string>(["completed", "archived", "cancelled"]);

export function CaseManagementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";
  const canonicalQuery = useCanonicalCase(caseId);
  const caseItem = canonicalQuery.data;
  const linkage = canonicalQuery.linkage;
  const { data: vehicle } = useVehicle(caseItem?.vehicle_id ?? "");
  const countdown = useAppointmentCountdown(caseId);
  const openPreview = useUstaPreviewStore((state) => state.open);

  const addAttachment = useAddCaseAttachment();
  const updateNotes = useUpdateCaseNotes();
  const updateNotesLive = useUpdateCaseNotesLive(caseId);

  const [editOpen, setEditOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [openApproval, setOpenApproval] = useState<{
    id: string;
    kind: "parts_request" | "invoice" | "completion";
  } | null>(null);

  const approvalsQuery = useCaseApprovals(caseId);
  const pendingApprovals = useMemo(
    () => (approvalsQuery.data ?? []).filter((a) => a.status === "pending"),
    [approvalsQuery.data],
  );

  const offersQuery = useCaseOffers(caseId);
  const offers = offersQuery.data ?? [];
  const towEntry = useTowEntryRoute({
    vehicleId: caseItem?.vehicle_id,
    fallback: `/(modal)/talep/towing?parentCaseId=${caseId}` as Href,
  });

  const isActive = caseItem ? !INACTIVE_STATUSES.has(caseItem.status) : false;
  const isCancelled = caseItem?.status === "cancelled";
  const documents = caseItem?.documents ?? [];
  const lastMessage =
    caseItem?.thread.messages[caseItem.thread.messages.length - 1] ?? null;

  const hasProcessBridge = caseItem && [
    "appointment_pending",
    "scheduled",
    "service_in_progress",
    "parts_approval",
    "invoice_approval",
  ].includes(caseItem.status);

  const showFinderHint =
    caseItem && (caseItem.status === "matching" || caseItem.status === "offers_ready");

  const canLinkTow =
    caseItem?.kind === "accident" || caseItem?.kind === "breakdown";

  const assignedTechnicianId = caseItem?.assigned_technician_id ?? "";
  const { data: assignedTechnician } = useTechnicianPublicView(assignedTechnicianId);

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

  const handleEditSubmit = (patch: { summary: string; notes: string }) => {
    void updateNotesLive.mutateAsync({ content: patch.notes || null });
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
        <ManagementHeader
          kind={caseItem.kind}
          status={caseItem.status}
          title={caseItem.title}
          createdAtLabel={caseItem.created_at_label}
          id={caseItem.id}
        />

        {hasProcessBridge && (
          <ManagementProcessBridge
            caseId={caseId}
            status={caseItem.status}
            nextActionTitle={caseItem.next_action_title}
            nextActionDescription={caseItem.next_action_description}
            countdownLabel={countdown.label}
          />
        )}

        {canLinkTow && (
          <ManagementTowingSection
            caseId={caseId}
            isActive={isActive}
            linkedTowCaseIds={linkage?.linked_tow_case_ids ?? []}
            towEntryRoute={towEntry.route}
          />
        )}

        {showFinderHint && (
          <ManagementMatchingSection
            caseId={caseId}
            status={caseItem.status}
            offerCount={offers.length}
          />
        )}

        {vehicle ? (
          <VehicleContextBar
            plate={vehicle.plate}
            vehicle={`${vehicle.make} ${vehicle.model} · ${vehicle.year}`}
            subtitle={vehicle.note}
            onPress={() => router.push(`/arac/${vehicle.id}` as Href)}
          />
        ) : (
          <VehicleSnapshotCard snapshot={linkage?.vehicle_snapshot} />
        )}

        {linkage?.subtype && (
          <SubtypeDetailCard
            kind={caseItem.kind}
            subtype={linkage.subtype}
          />
        )}

        {assignedTechnician && !showFinderHint && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${assignedTechnician.display_name} önizleme`}
            onPress={() => openPreview(assignedTechnician.id)}
            className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
          >
            <Avatar name={assignedTechnician.display_name} size="md" />
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Atanan usta
              </Text>
              <Text variant="label" tone="inverse" className="text-[14px]">
                {assignedTechnician.display_name}
              </Text>
              {assignedTechnician.tagline ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px]"
                  numberOfLines={1}
                >
                  {assignedTechnician.tagline}
                </Text>
              ) : null}
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
          </Pressable>
        )}

        <ManagementNotesSection
          summary={caseItem.summary}
          notes={linkage?.customer_notes ?? caseItem.request.notes ?? ""}
          isActive={isActive}
          onEdit={() => setEditOpen(true)}
        />

        <ManagementDocumentsSection
          caseId={caseId}
          documents={documents}
          isActive={isActive}
          onAddPress={() => setAttachOpen(true)}
        />

        <MessagesPreviewSection
          caseId={caseId}
          unreadCount={caseItem.thread.unread_count}
          lastMessageAuthor={lastMessage?.author_name}
          lastMessageBody={lastMessage?.body}
        />

        {offers.length > 0 && (
          <OffersPreviewSection
            caseId={caseId}
            offerCount={offers.length}
            firstOfferAmount={offers[0]?.amount}
            firstOfferCurrency={offers[0]?.currency}
          />
        )}

        <ManagementApprovalsSection
          approvals={pendingApprovals as any}
          onApprovalPress={(id, kind) => setOpenApproval({ id, kind })}
        />

        <BillingSummaryCard
          caseId={caseId}
          estimateFallback={linkage?.estimate_amount ?? null}
        />

        <View className="items-center pt-2">
          <Text variant="caption" tone="muted" className="text-app-text-subtle text-[10px]">
            {`Son güncelleme · ${caseItem.updated_at_label}`}
          </Text>
        </View>

        {!isActive && !isCancelled && (
          <Button
            label="Benzer talep aç"
            variant="outline"
            onPress={() =>
              router.push(`/(modal)/talep/${caseItem.kind}` as Href)
            }
          />
        )}

        {isActive && (
          <ManagementHazardZone onCancelPress={() => setCancelSheetOpen(true)} />
        )}
      </ScrollView>

      <EditCaseNotesSheet
        visible={editOpen}
        initialSummary={caseItem.summary}
        initialNotes={linkage?.customer_notes ?? caseItem.request.notes ?? ""}
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
