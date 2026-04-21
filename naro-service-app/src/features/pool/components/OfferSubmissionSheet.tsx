import { PRIMARY_TECHNICIAN_ID } from "@naro/mobile-core";
import { ActionSheetSurface, Button, Icon, Text } from "@naro/ui";
import { Clock, PackageCheck, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePoolCaseDetail, useSubmitOffer } from "@/features/jobs/api";

import { useOfferSheetStore } from "../offer-sheet-store";

const ETA_PRESETS = [
  { label: "Aynı gün", minutes: 480 },
  { label: "1 iş günü", minutes: 60 * 24 },
  { label: "2-3 gün", minutes: 60 * 48 },
  { label: "1 hafta", minutes: 60 * 24 * 7 },
];

const DELIVERY_MODES = [
  "Atölye kabul",
  "Pickup + atölye",
  "Mobil + atölye",
  "Yerinde onarım",
];

const WARRANTIES = [
  "30 gün işçilik",
  "3 ay işçilik",
  "6 ay / 10.000 km",
  "1 yıl yazılı garanti",
];

export function OfferSubmissionSheet() {
  const caseId = useOfferSheetStore((state) => state.caseId);
  const close = useOfferSheetStore((state) => state.close);
  const insets = useSafeAreaInsets();
  const { data: caseItem } = usePoolCaseDetail(caseId ?? "");
  const submit = useSubmitOffer();

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

  const isOpen = Boolean(caseId);
  const amountNumeric = Number(amount.replace(/\./g, ""));
  const canSubmit =
    !Number.isNaN(amountNumeric) && amountNumeric > 0 && !submit.isPending;

  const handleSubmit = async () => {
    if (!caseId || !canSubmit) return;
    const eta = ETA_PRESETS[etaIndex]!;
    await submit.mutateAsync({
      caseId,
      payload: {
        technician_id: PRIMARY_TECHNICIAN_ID,
        headline: note.trim() || `${caseItem?.title ?? "Vaka"} için teklif`,
        description:
          note.trim() ||
          "Bu vakayı uzmanlığımla çözebilirim. Teslim saatleri ve garanti şartlarını yukarıda belirttim.",
        amount: amountNumeric,
        eta_minutes: eta.minutes,
        eta_label: eta.label,
        delivery_mode: DELIVERY_MODES[deliveryIndex]!,
        warranty_label: WARRANTIES[warrantyIndex]!,
        available_at_label: "Hazır",
        badges: [],
      },
    });
    close();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Teklif ekranını kapat"
        onPress={close}
        className="flex-1 justify-end bg-black/60"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Pressable onPress={(event) => event.stopPropagation()}>
            <ActionSheetSurface
              title="Teklif Gönder"
              description={caseItem?.title ?? "Havuzdaki vaka için teklif"}
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
                      Teslim süresi
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {ETA_PRESETS.map((preset, index) => (
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
                      Teslim modu
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {DELIVERY_MODES.map((mode, index) => (
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
                      Garanti
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {WARRANTIES.map((label, index) => (
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
                      placeholder="Kapsam, parça, teslim detayı..."
                      placeholderTextColor="#6f7b97"
                      multiline
                      textAlignVertical="top"
                      className="min-h-[60px] text-base text-app-text"
                    />
                  </View>
                </View>

                <View className="flex-row gap-3 pt-1">
                  <View className="flex-1">
                    <Button label="Vazgeç" variant="outline" fullWidth onPress={close} />
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
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
