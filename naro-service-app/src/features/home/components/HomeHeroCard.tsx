import type { ServiceCase } from "@naro/domain";
import { getTrackingVehicleMeta } from "@naro/mobile-core";
import { Avatar, Button, Icon, StatusChip, Text, TrustBadge } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { CalendarClock, ChevronRight } from "lucide-react-native";
import { Alert, Pressable, View } from "react-native";

import {
  BREAKDOWN_LABEL,
  CASE_KIND_META,
  DAMAGE_AREA_LABEL,
} from "@/features/cases";
import {
  useApproveIncomingAppointment,
  useDeclineIncomingAppointment,
} from "@/features/jobs/api";

import { maskCustomerName } from "./helpers";

const SLOT_LABEL: Record<string, string> = {
  today: "Bugün",
  tomorrow: "Yarın",
  custom: "Seçili gün",
  flexible: "Esnek",
};

type Props = {
  caseItem: ServiceCase;
};

export function HomeHeroCard({ caseItem }: Props) {
  const router = useRouter();
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  const appointment = caseItem.appointment;
  const firstPhoto = caseItem.attachments.find((a) => a.kind === "photo");
  const approve = useApproveIncomingAppointment();
  const decline = useDeclineIncomingAppointment();
  const isPending = appointment?.status === "pending";

  const chips: { label: string; tone: "info" | "warning" | "accent" | "critical" }[] = [];
  if (caseItem.kind === "accident" && caseItem.request.damage_area) {
    chips.push({
      label: DAMAGE_AREA_LABEL[caseItem.request.damage_area] ?? caseItem.request.damage_area,
      tone: "critical",
    });
  }
  if (caseItem.kind === "breakdown" && caseItem.request.breakdown_category) {
    chips.push({
      label: BREAKDOWN_LABEL[caseItem.request.breakdown_category] ?? caseItem.request.breakdown_category,
      tone: "warning",
    });
  }
  if (caseItem.request.kasko_selected) chips.push({ label: "Kasko", tone: "info" });
  if (caseItem.request.sigorta_selected) chips.push({ label: "Trafik", tone: "info" });
  if (caseItem.request.valet_requested) chips.push({ label: "Valet", tone: "accent" });
  if (caseItem.request.towing_required) chips.push({ label: "Çekici", tone: "warning" });

  const slotLabel = appointment
    ? `${SLOT_LABEL[appointment.slot.kind] ?? appointment.slot.dateLabel ?? ""}${
        appointment.slot.timeWindow ? ` · ${appointment.slot.timeWindow}` : ""
      }`
    : null;

  const openDetail = () => router.push(`/randevu/${caseItem.id}` as Href);
  const openVakaProfile = () => router.push(`/vaka/${caseItem.id}` as Href);

  const handleApprove = () => {
    Alert.alert(
      "Randevu onaylansın mı?",
      "Müşteri anında bilgilendirilir ve servis süreci başlar.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Onayla",
          onPress: async () => {
            await approve.mutateAsync(caseItem.id);
          },
        },
      ],
    );
  };

  const handleDecline = () => {
    Alert.alert(
      "Randevu reddedilsin mi?",
      "Müşteri alternatif ustalara yönlendirilir.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Reddet",
          style: "destructive",
          onPress: async () => {
            await decline.mutateAsync({
              caseId: caseItem.id,
              reason: "Usta müsait değil",
            });
          },
        },
      ],
    );
  };

  return (
    <View
      className="overflow-hidden rounded-[28px] border bg-app-surface"
      style={{
        borderColor: `${kindMeta.iconColor}40`,
      }}
    >
      {/* Gradient band */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${caseItem.title} randevu talebini aç`}
        onPress={openDetail}
        className="gap-3 px-5 pb-4 pt-5 active:opacity-95"
        style={{ backgroundColor: `${kindMeta.iconColor}14` }}
      >
        <View className="flex-row items-start gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hasar profilini aç"
            onPress={openVakaProfile}
            hitSlop={6}
          >
            {firstPhoto ? (
              <View
                className="h-20 w-20 items-center justify-center overflow-hidden rounded-[18px] border"
                style={{
                  borderColor: `${kindMeta.iconColor}30`,
                  backgroundColor: `${kindMeta.iconColor}20`,
                }}
              >
                <Icon icon={kindMeta.icon} size={28} color={kindMeta.iconColor} />
              </View>
            ) : (
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: `${kindMeta.iconColor}25` }}
              >
                <Icon icon={kindMeta.icon} size={26} color={kindMeta.iconColor} />
              </View>
            )}
          </Pressable>

          <View className="flex-1 gap-1.5">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
              {slotLabel ? (
                <View className="flex-row items-center gap-1 rounded-full border border-app-outline bg-app-surface px-2 py-0.5">
                  <Icon icon={CalendarClock} size={11} color="#0ea5e9" />
                  <Text variant="caption" tone="muted" className="text-[11px]">
                    {slotLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              variant="h3"
              tone="inverse"
              className="text-[17px] leading-[21px]"
              numberOfLines={2}
            >
              {caseItem.title}
            </Text>
          </View>
          <Icon icon={ChevronRight} size={16} color="#83a7ff" />
        </View>

        {vehicle ? (
          <View className="flex-row items-center gap-2 rounded-[14px] bg-app-surface/60 px-3 py-2">
            <Avatar name={vehicle.customerName} size="sm" />
            <View className="flex-1 gap-0.5">
              <Text
                variant="caption"
                tone="inverse"
                className="text-[12px]"
                numberOfLines={1}
              >
                {maskCustomerName(vehicle.customerName)} · {vehicle.plate}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
                numberOfLines={1}
              >
                {vehicle.vehicleLabel}
              </Text>
            </View>
          </View>
        ) : null}

        {chips.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {chips.map((chip) => (
              <StatusChip key={chip.label} label={chip.label} tone={chip.tone} />
            ))}
          </View>
        ) : null}
      </Pressable>

      {/* Footer — direct actions if appointment pending */}
      {isPending ? (
        <View className="flex-row gap-2 border-t border-app-outline bg-app-surface px-4 py-3">
          <View className="flex-1">
            <Button
              label="Reddet"
              variant="outline"
              size="md"
              onPress={handleDecline}
              loading={decline.isPending}
              fullWidth
            />
          </View>
          <View className="flex-1">
            <Button
              label="Randevu ver"
              size="md"
              onPress={handleApprove}
              loading={approve.isPending}
              fullWidth
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
