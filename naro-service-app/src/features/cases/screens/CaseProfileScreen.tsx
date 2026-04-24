import type { ServiceCase } from "@naro/domain";
import {
  BackButton,
  Button,
  CASE_KIND_META,
  CaseInspectionView,
  type CaseContextState,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useApproveIncomingAppointment,
  useDeclineIncomingAppointment,
  usePoolCaseDetail,
} from "@/features/jobs";
import { useOfferSheetStore } from "@/features/pool";

type StickyVariant =
  | { kind: "offer" }
  | { kind: "records" }
  | { kind: "appointment" }
  | { kind: "process" }
  | { kind: "awaiting_customer"; label: string; hint: string }
  | { kind: "tow_active"; label: string; hint: string }
  | { kind: "none" };

function deriveContext(caseItem: ServiceCase): CaseContextState {
  // F-P1-2 (2026-04-23 lifecycle audit L3-P1-2): terminal status
  // öncelikli; pending approval + aktif tow süreç bağlamında kalır.
  switch (caseItem.status) {
    case "completed":
    case "archived":
    case "cancelled":
      return "archive";
    case "matching":
    case "offers_ready":
    case "appointment_pending":
      return "pool";
    case "parts_approval":
    case "invoice_approval":
    case "scheduled":
    case "service_in_progress":
      return "process";
    default:
      return "process";
  }
}

function deriveSticky(
  caseItem: ServiceCase,
  technicianId: string,
): StickyVariant {
  const status = caseItem.status;
  const myOffer = caseItem.offers.find(
    (o) => o.technician_id === technicianId,
  );
  const isAssigned = caseItem.assigned_technician_id === technicianId;
  const isAppointmentForMe =
    caseItem.appointment?.status === "pending" &&
    caseItem.appointment.technician_id === technicianId;

  // F-P1-2: tow kind aktif akışında assigned usta için stage-first
  // sticky. Generic process sticky'yi atlayıp TowActiveJobScreen'e
  // doğrudan yönlendirir.
  if (
    isAssigned &&
    caseItem.kind === "towing" &&
    (status === "scheduled" || status === "service_in_progress")
  ) {
    return {
      kind: "tow_active",
      label: "Çekici akışı aktif",
      hint: "Aşamayı güncelle; müşteri ekranı seninle senkron.",
    };
  }

  // F-P1-2: pending approval (parts/invoice) — usta onay açtı, müşteri
  // bekliyor. Assigned usta için pasif sticky (CTA yok, sadece bilgi).
  if (
    isAssigned &&
    caseItem.pending_approvals.length > 0 &&
    (status === "parts_approval" || status === "invoice_approval")
  ) {
    const approval = caseItem.pending_approvals[0]!;
    const label =
      approval.kind === "parts_request"
        ? "Parça onayı bekliyor"
        : approval.kind === "invoice"
          ? "Fatura onayı bekliyor"
          : "Tamamlama onayı bekliyor";
    return {
      kind: "awaiting_customer",
      label,
      hint: "Müşteri yanıt verene kadar süreç duraklı.",
    };
  }

  if (status === "appointment_pending" && isAppointmentForMe) {
    return { kind: "appointment" };
  }
  if (status === "matching" || status === "offers_ready") {
    if (myOffer) return { kind: "records" };
    return { kind: "offer" };
  }
  if (
    isAssigned &&
    (status === "scheduled" ||
      status === "service_in_progress" ||
      status === "parts_approval" ||
      status === "invoice_approval")
  ) {
    return { kind: "process" };
  }
  if (status === "completed" || status === "archived") {
    return { kind: "none" };
  }
  return { kind: "none" };
}

function statusBadge(caseItem: ServiceCase): {
  label: string;
  tone: "success" | "warning" | "info" | "neutral" | "accent";
} | null {
  switch (caseItem.status) {
    case "completed":
      return { label: "Tamamlandı", tone: "success" };
    case "archived":
      return { label: "Arşiv", tone: "neutral" };
    case "cancelled":
      return { label: "İptal edildi", tone: "neutral" };
    case "matching":
      return { label: "Havuzda", tone: "info" };
    case "offers_ready":
      return { label: "Teklifler geldi", tone: "accent" };
    case "appointment_pending":
      return { label: "Randevu bekliyor", tone: "warning" };
    case "scheduled":
      return { label: "Planlandı", tone: "info" };
    case "service_in_progress":
      return { label: "Servis sürüyor", tone: "success" };
    case "parts_approval":
      return { label: "Parça onayı", tone: "warning" };
    case "invoice_approval":
      return { label: "Fatura onayı", tone: "warning" };
    default:
      return null;
  }
}

export function CaseProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = usePoolCaseDetail(id ?? "");
  const openOfferSheet = useOfferSheetStore((s) => s.open);
  const approve = useApproveIncomingAppointment();
  const decline = useDeclineIncomingAppointment();

  if (!caseItem) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Vaka bulunamadı
          </Text>
          <Button label="Geri" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const context = deriveContext(caseItem);
  const myTechnicianId =
    caseItem.assigned_technician_id ??
    caseItem.preferred_technician_id ??
    "";
  const sticky = deriveSticky(caseItem, myTechnicianId);
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const badge = statusBadge(caseItem);

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(caseItem.id);
      router.replace("/(tabs)/islerim");
    } catch (err) {
      console.warn("appointment approve failed", err);
    }
  };

  const handleDecline = async () => {
    try {
      await decline.mutateAsync({
        caseId: caseItem.id,
        reason: "Usta müsait değil",
      });
      router.back();
    } catch (err) {
      console.warn("appointment decline failed", err);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-2">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Vaka profili
          </Text>
          <Text
            variant="label"
            tone="inverse"
            className="text-[14px]"
            numberOfLines={1}
          >
            {caseItem.title}
          </Text>
        </View>
        <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
        {badge ? <TrustBadge label={badge.label} tone={badge.tone} /> : null}
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-6 pb-40 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CaseInspectionView
          caseItem={caseItem}
          myTechnicianId={myTechnicianId}
          contextState={context}
          actor="technician"
        />
      </ScrollView>

      {sticky.kind !== "none" ? (
        <View
          className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-6 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {sticky.kind === "offer" ? (
            <Button
              label="Teklif Gönder"
              size="lg"
              onPress={() => openOfferSheet(caseItem.id)}
              fullWidth
            />
          ) : null}
          {sticky.kind === "records" ? (
            <Button
              label="Kayıtlara git"
              variant="outline"
              onPress={() => router.replace("/(tabs)/islerim")}
              fullWidth
            />
          ) : null}
          {sticky.kind === "appointment" ? (
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Reddet"
                  variant="outline"
                  onPress={handleDecline}
                  loading={decline.isPending}
                  fullWidth
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Randevu ver"
                  onPress={handleApprove}
                  loading={approve.isPending}
                  fullWidth
                />
              </View>
            </View>
          ) : null}
          {sticky.kind === "process" ? (
            <Button
              label="Hasar takibine git"
              size="lg"
              onPress={() => router.push(`/is/${caseItem.id}` as Href)}
              fullWidth
            />
          ) : null}
          {sticky.kind === "tow_active" ? (
            <View className="gap-1">
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                {sticky.hint}
              </Text>
              <Button
                label={sticky.label}
                size="lg"
                onPress={() => router.push(`/cekici/${caseItem.id}` as Href)}
                fullWidth
              />
            </View>
          ) : null}
          {sticky.kind === "awaiting_customer" ? (
            <View className="gap-1 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
              <Text variant="label" tone="warning" className="text-[13px]">
                {sticky.label}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                {sticky.hint}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
