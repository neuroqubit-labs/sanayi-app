import type { AppointmentSlot } from "@naro/domain";
import { BackButton, Button, Icon, SectionHeader, Text, TrustBadge } from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarClock, Lock, ShieldCheck, Timer } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { VakaCard } from "@/features/cases";
import {
  useApproveIncomingAppointment,
  useDeclineIncomingAppointment,
  usePoolCaseDetail,
} from "@/features/jobs";
import {
  isPaymentAccountRequiredError,
  paymentAccountRequiredMessage,
} from "@/features/technicians/paymentAccountErrors";
import { telemetry } from "@/runtime";

const SLOT_LABEL: Record<string, string> = {
  today: "Bugün",
  tomorrow: "Yarın",
  custom: "Seçili gün",
  flexible: "Esnek · müşteri esnek",
};

export function AppointmentRequestDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = usePoolCaseDetail(id ?? "");
  const approve = useApproveIncomingAppointment();
  const decline = useDeclineIncomingAppointment();
  const [actionError, setActionError] = useState<string | null>(null);

  if (!caseItem) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Randevu bulunamadı
          </Text>
          <Button label="Geri" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const appointment = caseItem.appointment;
  const linkedOffer = appointment?.offer_id
    ? caseItem.offers.find((o) => o.id === appointment.offer_id)
    : null;
  const isPending = appointment?.status === "pending";

  const handleApprove = async () => {
    if (!appointment) return;
    try {
      await approve.mutateAsync(caseItem.id);
      setActionError(null);
      router.replace("/(tabs)/islerim");
    } catch (err) {
      telemetry.captureError(err, { context: "appointment approve failed" });
      setActionError(
        isPaymentAccountRequiredError(err)
          ? paymentAccountRequiredMessage("Randevu vermek")
          : "Randevu onaylanamadı. Tekrar dene.",
      );
    }
  };

  const handleDecline = async () => {
    if (!appointment) return;
    try {
      await decline.mutateAsync({
        caseId: caseItem.id,
        reason: "Usta müsait değil",
      });
      setActionError(null);
      router.back();
    } catch (err) {
      telemetry.captureError(err, { context: "appointment decline failed" });
      setActionError("Randevu reddedilemedi. Tekrar dene.");
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-2">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Randevu talebi
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
        {isPending ? <TrustBadge label="Yanıt bekliyor" tone="warning" /> : null}
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-6 pb-40 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <VakaCard
          caseItem={caseItem}
          label="Hangi vaka için randevu?"
          onPress={() => router.push(`/vaka/${caseItem.id}` as Href)}
        />

        {appointment ? (
          <AppointmentSummary
            slot={appointment.slot}
            note={appointment.note ?? null}
            offer={linkedOffer ?? null}
          />
        ) : null}
      </ScrollView>

      {/* Sticky bottom actions */}
      <View
        className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-6 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {actionError ? (
          <View className="rounded-[14px] border border-app-critical/40 bg-app-critical-soft px-3 py-2">
            <Text variant="caption" tone="critical" className="text-[11px]">
              {actionError}
            </Text>
          </View>
        ) : null}
        {isPending ? (
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
        ) : (
          <Button
            label="Kayıtlara git"
            variant="outline"
            onPress={() => router.replace("/(tabs)/islerim")}
            fullWidth
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function AppointmentSummary({
  slot,
  note,
  offer,
}: {
  slot: AppointmentSlot;
  note: string | null;
  offer: {
    price_label: string;
    eta_label: string;
    warranty_label: string;
  } | null;
}) {
  return (
    <View className="gap-3">
      <SectionHeader
        title="Talep edilen zaman"
        description="Müşterinin önerdiği randevu"
      />
      <View className="gap-3 rounded-[22px] border border-brand-500/30 bg-brand-500/10 px-4 py-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={CalendarClock} size={16} color="#0ea5e9" />
          <Text variant="label" tone="inverse" className="text-[15px]">
            {SLOT_LABEL[slot.kind] ?? slot.dateLabel ?? "—"}
          </Text>
        </View>
        {slot.timeWindow ? (
          <View className="flex-row items-center gap-2">
            <Icon icon={Timer} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px]"
            >
              {slot.timeWindow}
            </Text>
          </View>
        ) : null}
        {note ? (
          <View className="gap-1 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
            <Text variant="eyebrow" tone="subtle">
              Müşteri notu
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text leading-[19px]"
            >
              {note}
            </Text>
          </View>
        ) : null}
      </View>

      {offer ? (
        <View className="gap-2 rounded-[22px] border border-app-success/40 bg-app-success-soft px-4 py-4">
          <View className="flex-row items-center gap-2">
            <Icon icon={Lock} size={13} color="#2dd28d" />
            <Text variant="eyebrow" tone="subtle">
              Bağlayıcı teklif
            </Text>
          </View>
          <Text
            variant="display"
            tone="inverse"
            className="text-[22px] leading-[26px]"
          >
            {offer.price_label}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
              <Icon icon={Timer} size={11} color="#83a7ff" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {offer.eta_label}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
              <Icon icon={ShieldCheck} size={11} color="#2dd28d" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {offer.warranty_label}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
