import {
  ActionSheetSurface,
  BottomSheetOverlay,
  Button,
  FieldInput,
  Icon,
  OptionPillGroup,
  Text,
  useNaroTheme,
} from "@naro/ui";
import { Clock, PackageCheck, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import {
  usePoolCaseDetailLive,
  useSubmitOfferLive,
} from "@/features/jobs/api.live";
import {
  isPaymentAccountRequiredError,
  paymentAccountRequiredMessage,
} from "@/features/technicians/paymentAccountErrors";

import { useOfferSheetStore } from "../offer-sheet-store";

const DEFAULT_ETA_PRESETS = [
  { label: "Aynı gün", minutes: 480 },
  { label: "1 iş günü", minutes: 60 * 24 },
  { label: "2-3 gün", minutes: 60 * 48 },
  { label: "1 hafta", minutes: 60 * 24 * 7 },
];

const DEFAULT_DELIVERY_MODES = [
  "Atölye kabul",
  "Pickup + atölye",
  "Mobil + atölye",
  "Yerinde onarım",
];

const DEFAULT_WARRANTIES = [
  "30 gün işçilik",
  "3 ay işçilik",
  "6 ay / 10.000 km",
  "1 yıl yazılı garanti",
];

const APPOINTMENT_SLOT_PRESETS = [
  { label: "Bugün", helper: "Uygunsa bugün kabul", preset_key: "today" },
  { label: "Yarın", helper: "Yarın için randevu öner", preset_key: "tomorrow" },
  {
    label: "Önümüzdeki hafta",
    helper: "Hafta içinde uygun zaman",
    preset_key: "next_week",
  },
  {
    label: "Esnek tarih",
    helper: "Müşteriyle birlikte netleşir",
    preset_key: "flexible",
  },
];

/**
 * Canonical offer submit sheet — P1-4 iter 2 consumer migration 2026-04-23.
 * Mock useSubmitOffer (+PRIMARY_TECHNICIAN_ID) → useSubmitOfferLive +
 * useMyTechnicianProfile (canonical technician_id).
 *
 * Nested <button> DOM fix: backdrop Pressable absolute sibling (nested
 * Pressable ağacı yerine).
 */
export function OfferSubmissionSheet() {
  const { colors } = useNaroTheme();
  const caseId = useOfferSheetStore((state) => state.caseId);
  const close = useOfferSheetStore((state) => state.close);
  const { data: caseItem } = usePoolCaseDetailLive(caseId ?? "");
  const submit = useSubmitOfferLive();

  const [amount, setAmount] = useState("");
  const [etaIndex, setEtaIndex] = useState(1);
  const [deliveryIndex, setDeliveryIndex] = useState(0);
  const [warrantyIndex, setWarrantyIndex] = useState(2);
  const [slotIndex, setSlotIndex] = useState(3);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (caseId) {
      setAmount("");
      setEtaIndex(1);
      setDeliveryIndex(0);
      setWarrantyIndex(2);
      setSlotIndex(3);
      setNote("");
    }
  }, [caseId]);

  const etaPresets = DEFAULT_ETA_PRESETS;
  const deliveryModes = DEFAULT_DELIVERY_MODES;
  const warranties = DEFAULT_WARRANTIES;
  const notePlaceholder = "Kapsam, parça, teslim detayı...";

  const isOpen = Boolean(caseId);
  const amountNumeric = Number(amount.replace(/\./g, ""));
  const canSubmit =
    !Number.isNaN(amountNumeric) && amountNumeric > 0 && !submit.isPending;
  const submitErrorMessage = submit.isError
    ? isPaymentAccountRequiredError(submit.error)
      ? paymentAccountRequiredMessage("Teklif vermek")
      : "Teklif gönderilemedi. Tekrar dene."
    : null;

  const handleSubmit = async () => {
    if (!caseId || !canSubmit) return;
    const eta = etaPresets[etaIndex]!;
    const slot = APPOINTMENT_SLOT_PRESETS[slotIndex]!;
    try {
      await submit.mutateAsync({
        case_id: caseId,
        headline:
          note.trim() ||
          `${caseItem?.title ?? "Vaka"} için teklif`,
        description:
          note.trim() ||
          "Bu vakayı uzmanlığımla çözebilirim. Teslim saatleri ve garanti şartlarını yukarıda belirttim.",
        amount: String(amountNumeric),
        currency: "TRY",
        eta_minutes: eta.minutes,
        delivery_mode: deliveryModes[deliveryIndex]!,
        warranty_label: warranties[warrantyIndex]!,
        available_at_label: slot.label,
        badges: [],
        slot_proposal: {
          kind: "flexible",
          label: slot.label,
          preset_key: slot.preset_key,
        },
        slot_is_firm: false,
      });
      close();
    } catch (err) {
      console.warn("offer submit failed", err);
    }
  };

  return (
    <BottomSheetOverlay
      visible={isOpen}
      onClose={close}
      accessibilityLabel="Teklif ekranını kapat"
      dismissible={!submit.isPending}
      keyboardAvoiding
    >
      <ActionSheetSurface
        title="Teklif Gönder"
        description={
          caseItem?.title ?? "Havuzdaki vaka için teklif"
        }
      >
        <View className="gap-4">
          <View className="gap-2">
            <FieldInput
              label="Teklif tutarı (₺)"
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/[^\d.]/g, ""))}
              placeholder="örn: 2.500"
              numeric
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={Clock} size={12} color={colors.info} />
              <Text variant="eyebrow" tone="subtle">
                Teslim süresi
              </Text>
            </View>
            <OptionPillGroup
              options={etaPresets.map((preset, index) => ({
                key: String(index),
                label: preset.label,
              }))}
              selectedKey={String(etaIndex)}
              onSelect={(key) => setEtaIndex(Number(key))}
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={PackageCheck} size={12} color={colors.info} />
              <Text variant="eyebrow" tone="subtle">
                Randevu önerisi
              </Text>
            </View>
            <OptionPillGroup
              options={APPOINTMENT_SLOT_PRESETS.map((slot, index) => ({
                key: String(index),
                label: slot.label,
              }))}
              selectedKey={String(slotIndex)}
              onSelect={(key) => setSlotIndex(Number(key))}
            />
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              {APPOINTMENT_SLOT_PRESETS[slotIndex]?.helper}
            </Text>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={PackageCheck} size={12} color={colors.info} />
              <Text variant="eyebrow" tone="subtle">
                Teslim modu
              </Text>
            </View>
            <OptionPillGroup
              options={deliveryModes.map((mode, index) => ({
                key: String(index),
                label: mode,
              }))}
              selectedKey={String(deliveryIndex)}
              onSelect={(key) => setDeliveryIndex(Number(key))}
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={ShieldCheck} size={12} color={colors.info} />
              <Text variant="eyebrow" tone="subtle">
                Garanti
              </Text>
            </View>
            <OptionPillGroup
              options={warranties.map((label, index) => ({
                key: String(index),
                label,
              }))}
              selectedKey={String(warrantyIndex)}
              onSelect={(key) => setWarrantyIndex(Number(key))}
            />
          </View>

          <View className="gap-2">
            <FieldInput
              label="Ek not (opsiyonel)"
              value={note}
              onChangeText={setNote}
              placeholder={notePlaceholder}
              textarea
              rows={3}
            />
          </View>

          {submitErrorMessage ? (
            <View className="rounded-[12px] border border-app-critical/40 bg-app-critical-soft px-3 py-2">
              <Text variant="caption" tone="critical" className="text-[11px]">
                {submitErrorMessage}
              </Text>
            </View>
          ) : null}

          <View className="flex-row gap-3 pt-1">
            <View className="flex-1">
              <Button
                label="Vazgeç"
                variant="outline"
                fullWidth
                onPress={close}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Teklif Gönder"
                fullWidth
                disabled={!canSubmit}
                loading={submit.isPending}
                onPress={handleSubmit}
              />
            </View>
          </View>
        </View>
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}
