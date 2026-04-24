import {
  ActionSheetSurface,
  BottomSheetOverlay,
  Button,
  FeeWarningCard,
  FieldInput,
  OptionPillGroup,
  Text,
} from "@naro/ui";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { useSubmitCancellation } from "../api";
import { useCancellationFeeCompute, type CaseBillingStage } from "../hooks";
import type { CancellationReason } from "../schemas";

export type CancellationSheetProps = {
  visible: boolean;
  caseId: string;
  /** Fee hesaplaması için vaka billing durumu. */
  stage: CaseBillingStage;
  /** Nihai tutar tahmini — fee orantı hesabı için. */
  estimate: number | null;
  onClose: () => void;
  /** İptal başarılı — caller navigation. */
  onCancelled?: () => void;
};

const REASON_OPTIONS: { value: CancellationReason; label: string }[] = [
  { value: "changed_mind", label: "Vazgeçtim" },
  { value: "price_changed", label: "Fiyat değişti" },
  { value: "no_response", label: "Usta yanıt vermedi" },
  { value: "other", label: "Diğer" },
];

export function CancellationSheet({
  visible,
  caseId,
  stage,
  estimate,
  onClose,
  onCancelled,
}: CancellationSheetProps) {
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [comment, setComment] = useState("");
  const submit = useSubmitCancellation(caseId);
  const feeEstimate = useCancellationFeeCompute(stage, estimate);

  const canSubmit = reason !== null && !submit.isPending;

  const handleSubmit = async () => {
    if (!reason) return;
    try {
      await submit.mutateAsync({
        reason,
        comment: comment.trim() || null,
      });
      setReason(null);
      setComment("");
      onClose();
      onCancelled?.();
    } catch (err) {
      console.warn("cancellation failed", err);
    }
  };

  const handleClose = () => {
    if (submit.isPending) return;
    setReason(null);
    setComment("");
    onClose();
  };

  return (
    <BottomSheetOverlay
      visible={visible}
      onClose={handleClose}
      accessibilityLabel="Kapat"
      dismissible={!submit.isPending}
      keyboardAvoiding
    >
      <ActionSheetSurface
        title="Vakayı iptal et"
        description="İptal sebebini seç — usta ve platform kaydını tutar."
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16 }}
          style={{ maxHeight: 460 }}
        >
          <View className="gap-2">
            <Text variant="eyebrow" tone="subtle">
              Sebep
            </Text>
            <OptionPillGroup
              options={REASON_OPTIONS.map((option) => ({
                key: option.value,
                label: option.label,
              }))}
              selectedKey={reason}
              onSelect={(next) => setReason(reason === next ? null : next)}
              size="md"
            />
          </View>

          <FieldInput
            label="Kısa açıklama (opsiyonel)"
            value={comment}
            onChangeText={setComment}
            placeholder="Usta ve platform için kısaca anlat"
            textarea
            rows={4}
          />

          {feeEstimate.waived ? (
            <View className="gap-1 rounded-[14px] border border-app-success/30 bg-app-success-soft px-3 py-2.5">
              <Text variant="label" tone="success" className="text-[13px]">
                İptal ücreti yok
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px] leading-[16px]"
              >
                {feeEstimate.stage_label} — kartından tutulan (varsa) otomatik
                iade olur.
              </Text>
            </View>
          ) : (
            <FeeWarningCard
              title="İptal ücreti"
              amount={feeEstimate.fee_amount}
              currency={feeEstimate.currency}
              description={`${feeEstimate.stage_label} — bu tutar kartından çekilir, kalan hold iptal edilir. Nihai hesap backend'de doğrulanır.`}
              tone="warning"
            />
          )}
        </ScrollView>

        <View className="flex-row gap-2 pt-1">
          <View className="flex-1">
            <Button
              label="Vazgeç"
              variant="outline"
              size="md"
              fullWidth
              onPress={handleClose}
              disabled={submit.isPending}
            />
          </View>
          <View className="flex-1">
            <Button
              label={submit.isPending ? "İptal ediliyor…" : "İptal et"}
              size="md"
              fullWidth
              variant="danger"
              loading={submit.isPending}
              disabled={!canSubmit}
              onPress={handleSubmit}
            />
          </View>
        </View>

        {submit.isError ? (
          <View className="mt-2 rounded-[10px] border border-app-critical/30 bg-app-critical-soft px-3 py-2">
            <Text variant="caption" tone="critical" className="text-[11px]">
              İptal işlenemedi. Tekrar dene.
            </Text>
          </View>
        ) : null}
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}
