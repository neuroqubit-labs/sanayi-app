import {
  ActionSheetSurface,
  BottomSheetOverlay,
  Button,
  Icon,
  Text,
} from "@naro/ui";
import { Clock, PackageCheck, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import {
  usePoolCaseDetailLive,
  useSubmitOfferLive,
} from "@/features/jobs/api.live";
import { useTechnicianProfileStore } from "@/features/technicians";

import { useOfferSheetStore } from "../offer-sheet-store";

const DEFAULT_ETA_PRESETS = [
  { label: "Aynı gün", minutes: 480 },
  { label: "1 iş günü", minutes: 60 * 24 },
  { label: "2-3 gün", minutes: 60 * 48 },
  { label: "1 hafta", minutes: 60 * 24 * 7 },
];

const TOW_ETA_PRESETS = [
  { label: "10 dk", minutes: 10 },
  { label: "20 dk", minutes: 20 },
  { label: "30 dk", minutes: 30 },
  { label: "45 dk", minutes: 45 },
];

const DEFAULT_DELIVERY_MODES = [
  "Atölye kabul",
  "Pickup + atölye",
  "Mobil + atölye",
  "Yerinde onarım",
];

const TOW_DELIVERY_MODES = [
  "Flatbed çekici",
  "Hook çekici",
  "Wheel-lift çekici",
  "Yol yardım / kısa müdahale",
];

const DEFAULT_WARRANTIES = [
  "30 gün işçilik",
  "3 ay işçilik",
  "6 ay / 10.000 km",
  "1 yıl yazılı garanti",
];

const TOW_WARRANTIES = [
  "Canlı konum paylaşımı",
  "Fotoğraflı teslim",
  "Sigortalı taşıma",
  "Dikkatli yükleme / sabitleme",
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
  const caseId = useOfferSheetStore((state) => state.caseId);
  const close = useOfferSheetStore((state) => state.close);
  const { data: caseItem } = usePoolCaseDetailLive(caseId ?? "");
  const activeProviderType = useTechnicianProfileStore(
    (state) => state.active_provider_type ?? state.provider_type,
  );
  const submit = useSubmitOfferLive();

  const [amount, setAmount] = useState("");
  const [etaIndex, setEtaIndex] = useState(1);
  const [deliveryIndex, setDeliveryIndex] = useState(0);
  const [warrantyIndex, setWarrantyIndex] = useState(2);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (caseId) {
      setAmount("");
      setEtaIndex(1);
      setDeliveryIndex(0);
      setWarrantyIndex(2);
      setNote("");
    }
  }, [caseId]);

  const isTowOffer =
    caseItem?.kind === "towing" && activeProviderType === "cekici";
  const etaPresets = isTowOffer ? TOW_ETA_PRESETS : DEFAULT_ETA_PRESETS;
  const deliveryModes = isTowOffer
    ? TOW_DELIVERY_MODES
    : DEFAULT_DELIVERY_MODES;
  const warranties = isTowOffer ? TOW_WARRANTIES : DEFAULT_WARRANTIES;
  const etaSectionTitle = isTowOffer ? "Varış süresi" : "Teslim süresi";
  const deliverySectionTitle = isTowOffer ? "Hizmet tipi" : "Teslim modu";
  const warrantySectionTitle = isTowOffer ? "Taşıma güvencesi" : "Garanti";
  const notePlaceholder = isTowOffer
    ? "Konum teyidi, ekipman, varış notu..."
    : "Kapsam, parça, teslim detayı...";

  const isOpen = Boolean(caseId);
  const amountNumeric = Number(amount.replace(/\./g, ""));
  const canSubmit =
    !Number.isNaN(amountNumeric) && amountNumeric > 0 && !submit.isPending;

  const handleSubmit = async () => {
    if (!caseId || !canSubmit) return;
    const eta = etaPresets[etaIndex]!;
    try {
      await submit.mutateAsync({
        case_id: caseId,
        headline:
          note.trim() ||
          `${caseItem?.title ?? "Vaka"} için ${isTowOffer ? "çekici teklifi" : "teklif"}`,
        description:
          note.trim() ||
          (isTowOffer
            ? "Varış süresi, çekici hizmet tipi ve taşıma güvencesi yukarıda belirtilmiştir."
            : "Bu vakayı uzmanlığımla çözebilirim. Teslim saatleri ve garanti şartlarını yukarıda belirttim."),
        amount: String(amountNumeric),
        currency: "TRY",
        eta_minutes: eta.minutes,
        delivery_mode: deliveryModes[deliveryIndex]!,
        warranty_label: warranties[warrantyIndex]!,
        available_at_label: isTowOffer ? "Hemen çıkışa hazır" : "Hazır",
        badges: [],
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
          isTowOffer
            ? "Çekici vakanız için varış süresi ve hizmet tipini netleştirin."
            : (caseItem?.title ?? "Havuzdaki vaka için teklif")
        }
      >
        <View className="gap-4">
          <View className="gap-2">
            <Text variant="eyebrow" tone="subtle">
              Teklif tutarı (₺)
            </Text>
            <View className="rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
              <TextInput
                value={amount}
                onChangeText={(value) =>
                  setAmount(value.replace(/[^\d.]/g, ""))
                }
                placeholder="örn: 2.500"
                placeholderTextColor="#6f7b97"
                keyboardType="numeric"
                className="text-base text-app-text"
              />
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={Clock} size={12} color="#83a7ff" />
              <Text variant="eyebrow" tone="subtle">
                {etaSectionTitle}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {etaPresets.map((preset, index) => (
                <Pressable
                  key={preset.label}
                  onPress={() => setEtaIndex(index)}
                  className={`rounded-full border px-3 py-1.5 ${
                    etaIndex === index
                      ? "border-brand-500 bg-brand-500"
                      : "border-app-outline bg-app-surface"
                  }`}
                >
                  <Text
                    variant="caption"
                    tone={etaIndex === index ? "inverse" : "muted"}
                    className="text-[12px]"
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={PackageCheck} size={12} color="#83a7ff" />
              <Text variant="eyebrow" tone="subtle">
                {deliverySectionTitle}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {deliveryModes.map((mode, index) => (
                <Pressable
                  key={mode}
                  onPress={() => setDeliveryIndex(index)}
                  className={`rounded-full border px-3 py-1.5 ${
                    deliveryIndex === index
                      ? "border-brand-500 bg-brand-500"
                      : "border-app-outline bg-app-surface"
                  }`}
                >
                  <Text
                    variant="caption"
                    tone={deliveryIndex === index ? "inverse" : "muted"}
                    className="text-[12px]"
                  >
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={ShieldCheck} size={12} color="#83a7ff" />
              <Text variant="eyebrow" tone="subtle">
                {warrantySectionTitle}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {warranties.map((label, index) => (
                <Pressable
                  key={label}
                  onPress={() => setWarrantyIndex(index)}
                  className={`rounded-full border px-3 py-1.5 ${
                    warrantyIndex === index
                      ? "border-brand-500 bg-brand-500"
                      : "border-app-outline bg-app-surface"
                  }`}
                >
                  <Text
                    variant="caption"
                    tone={warrantyIndex === index ? "inverse" : "muted"}
                    className="text-[12px]"
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text variant="eyebrow" tone="subtle">
              Ek not (opsiyonel)
            </Text>
            <View className="rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={notePlaceholder}
                placeholderTextColor="#6f7b97"
                multiline
                textAlignVertical="top"
                className="min-h-[60px] text-base text-app-text"
              />
            </View>
          </View>

          {submit.isError ? (
            <View className="rounded-[12px] border border-app-critical/40 bg-app-critical-soft px-3 py-2">
              <Text variant="caption" tone="critical" className="text-[11px]">
                Teklif gönderilemedi. Tekrar dene.
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
