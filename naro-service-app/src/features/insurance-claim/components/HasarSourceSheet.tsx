import type { ServiceCase } from "@naro/domain";
import { getTrackingVehicleMeta } from "@naro/mobile-core";
import { ActionSheetSurface, Icon, Text, TrustBadge } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native";
import { useMemo } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CASE_KIND_META } from "@/features/cases";
import { maskCustomerName } from "@/features/home/components/helpers";
import { useJobsFeed } from "@/features/jobs/api";

import { useClaimSourceSheetStore } from "../source-sheet-store";

export function HasarSourceSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const open = useClaimSourceSheetStore((s) => s.open);
  const close = useClaimSourceSheetStore((s) => s.close);
  const { data: jobs = [] } = useJobsFeed();

  const eligible = useMemo(
    () =>
      jobs.filter(
        (c) =>
          (c.kind === "accident" || c.kind === "towing") &&
          c.origin !== "technician" &&
          c.insurance_claim === null &&
          c.status !== "completed" &&
          c.status !== "archived" &&
          c.status !== "cancelled",
      ),
    [jobs],
  );

  const goForm = (caseId?: string) => {
    close();
    const path = caseId
      ? `/(modal)/hasar-olustur?caseId=${caseId}`
      : "/(modal)/hasar-olustur?mode=standalone";
    router.push(path as Href);
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kaynak vaka seçimini kapat"
        onPress={close}
        className="flex-1 justify-end bg-black/60"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <ActionSheetSurface
            title="Hasar Dosyası Aç"
            description="Aktif vakan için açıyorsan seç; yoksa sıfırdan başlat."
          >
            <View className="gap-3">
              {eligible.length > 0 ? (
                <View className="gap-2">
                  <Text variant="eyebrow" tone="subtle">
                    Aktif vakalarım · {eligible.length}
                  </Text>
                  <ScrollView
                    className="max-h-[260px]"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {eligible.map((caseItem) => (
                      <CaseOptionRow
                        key={caseItem.id}
                        caseItem={caseItem}
                        onPress={() => goForm(caseItem.id)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View className="rounded-[14px] border border-app-outline bg-app-surface px-4 py-3">
                  <Text variant="caption" tone="muted" className="text-[12px]">
                    Aktif vakan yok. Sıfırdan başlatabilirsin.
                  </Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sıfırdan hasar dosyası aç"
                onPress={() => goForm()}
                className="flex-row items-center gap-3 rounded-[16px] border border-dashed border-brand-500/40 bg-brand-500/10 px-4 py-3.5 active:opacity-85"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
                  <Icon icon={Plus} size={18} color="#f45f25" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="label" tone="inverse" className="text-[14px]">
                    Sıfırdan aç
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[12px]"
                  >
                    Vaka sistemde yok — elle gir.
                  </Text>
                </View>
                <Icon icon={ChevronRight} size={16} color="#f45f25" />
              </Pressable>
            </View>
          </ActionSheetSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CaseOptionRow({
  caseItem,
  onPress,
}: {
  caseItem: ServiceCase;
  onPress: () => void;
}) {
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${caseItem.title} için dosya aç`}
      onPress={onPress}
      className="flex-row items-start gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${kindMeta.iconColor}20` }}
      >
        <Icon icon={kindMeta.icon} size={18} color={kindMeta.iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
          >
            {caseItem.updated_at_label}
          </Text>
        </View>
        <Text
          variant="label"
          tone="inverse"
          className="text-[13px]"
          numberOfLines={1}
        >
          {caseItem.title}
        </Text>
        {vehicle ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px]"
            numberOfLines={1}
          >
            {maskCustomerName(vehicle.customerName)} · {vehicle.plate} ·{" "}
            {vehicle.vehicleLabel}
          </Text>
        ) : null}
      </View>
      <Icon icon={ChevronRight} size={14} color="#83a7ff" />
    </Pressable>
  );
}
