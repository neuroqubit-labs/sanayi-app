import {
  ActionSheetSurface,
  Button,
  Icon,
  MoneyAmount,
  Text,
} from "@naro/ui";
import { AlertTriangle, Clock3, MessageCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { useCaseApproval, useSubmitApprovalDecision } from "../api";

export type PartsApprovalSheetProps = {
  visible: boolean;
  approvalId: string | null;
  onClose: () => void;
  /**
   * Approve response'ta `payment.redirect_url` geldiyse caller 3DS flow'u
   * açmalı (PaymentInitiateScreen veya inline WebView). caseId +
   * redirectUrl + paymentId aktarılır; FE'de optimistic ilerleme yok.
   */
  onNeedsPayment?: (args: {
    caseId: string;
    redirectUrl: string;
    paymentId: string | null;
  }) => void;
  /** Usta ile mesajlaşma için route navigate — caller sağlar. */
  onTalkToTechnician?: (caseId: string) => void;
};

export function PartsApprovalSheet({
  visible,
  approvalId,
  onClose,
  onNeedsPayment,
  onTalkToTechnician,
}: PartsApprovalSheetProps) {
  const approvalQuery = useCaseApproval(approvalId ?? "");
  const submit = useSubmitApprovalDecision(approvalId ?? "");
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const lineItemsSum = useMemo(() => {
    const items = approvalQuery.data?.line_items ?? [];
    return items.reduce((sum, item) => {
      const parsed = Number.parseFloat(item.value.replace(/[^\d.-]/g, ""));
      return Number.isNaN(parsed) ? sum : sum + parsed;
    }, 0);
  }, [approvalQuery.data]);

  const amount =
    approvalQuery.data?.amount ??
    (lineItemsSum > 0 ? lineItemsSum : null);

  const handleApprove = async () => {
    if (!approvalId) return;
    try {
      const response = await submit.mutateAsync({ decision: "approve" });
      if (
        response.payment?.required &&
        response.payment.redirect_url &&
        onNeedsPayment
      ) {
        onNeedsPayment({
          caseId: response.approval.case_id,
          redirectUrl: response.payment.redirect_url,
          paymentId: response.payment.payment_id,
        });
      }
      onClose();
    } catch (err) {
      console.warn("parts approve failed", err);
    }
  };

  const handleReject = async () => {
    if (!approvalId) return;
    try {
      await submit.mutateAsync({
        decision: "reject",
        reason: reason.trim() || null,
      });
      setReason("");
      setRejecting(false);
      onClose();
    } catch (err) {
      console.warn("parts reject failed", err);
    }
  };

  const handleClose = () => {
    if (submit.isPending) return;
    setRejecting(false);
    setReason("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        onPress={handleClose}
        className="flex-1 bg-black/50"
      />
      <View className="absolute inset-x-0 bottom-0">
        <ActionSheetSurface
          title="Ek parça onayı"
          description={
            approvalQuery.data?.requested_by_snapshot_name
              ? `${approvalQuery.data.requested_by_snapshot_name} ek parça talep etti`
              : "Usta ek parça talep etti"
          }
        >
          {approvalQuery.isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color="#83a7ff" />
            </View>
          ) : approvalQuery.isError || !approvalQuery.data ? (
            <View className="gap-2 rounded-[16px] border border-app-critical/30 bg-app-critical-soft px-3 py-2.5">
              <Text variant="caption" tone="critical" className="text-[12px]">
                Onay talebi yüklenemedi. Daha sonra tekrar dene.
              </Text>
            </View>
          ) : (
            <ApprovalBody
              data={approvalQuery.data}
              amount={amount}
              rejecting={rejecting}
              reason={reason}
              setReason={setReason}
              submitPending={submit.isPending}
              submitError={submit.isError}
              onApprove={handleApprove}
              onReject={handleReject}
              onStartReject={() => setRejecting(true)}
              onCancelReject={() => {
                setRejecting(false);
                setReason("");
              }}
              onTalkToTechnician={
                onTalkToTechnician && approvalQuery.data.case_id
                  ? () => onTalkToTechnician(approvalQuery.data!.case_id)
                  : undefined
              }
            />
          )}
        </ActionSheetSurface>
      </View>
    </Modal>
  );
}

type BodyProps = {
  data: NonNullable<ReturnType<typeof useCaseApproval>["data"]>;
  amount: number | null;
  rejecting: boolean;
  reason: string;
  setReason: (v: string) => void;
  submitPending: boolean;
  submitError: boolean;
  onApprove: () => void;
  onReject: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onTalkToTechnician?: () => void;
};

function ApprovalBody({
  data,
  amount,
  rejecting,
  reason,
  setReason,
  submitPending,
  submitError,
  onApprove,
  onReject,
  onStartReject,
  onCancelReject,
  onTalkToTechnician,
}: BodyProps) {
  return (
    <View className="gap-3">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        style={{ maxHeight: 420 }}
      >
        <Text
          variant="label"
          tone="inverse"
          className="text-[14px] leading-[19px]"
        >
          {data.title}
        </Text>
        {data.description ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[13px] leading-[18px]"
          >
            {data.description}
          </Text>
        ) : null}

        {data.service_comment ? (
          <View className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
            <Text
              variant="eyebrow"
              tone="subtle"
              className="text-[10px]"
            >
              Ustadan not
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px] leading-[17px]"
            >
              {data.service_comment}
            </Text>
          </View>
        ) : null}

        {data.line_items.length > 0 ? (
          <View className="gap-2">
            <Text variant="eyebrow" tone="subtle">
              Ek istenen kalemler
            </Text>
            <View className="gap-1.5 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
              {data.line_items.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center justify-between gap-2 border-b border-app-outline/40 pb-1.5 last:border-0 last:pb-0"
                >
                  <Text
                    variant="caption"
                    tone="inverse"
                    className="flex-1 text-[12px]"
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <Text
                    variant="label"
                    tone="accent"
                    className="text-[12px]"
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {amount !== null ? (
          <View className="gap-2 rounded-[16px] border border-app-warning/40 bg-app-warning-soft px-4 py-3.5">
            <View className="flex-row items-center gap-2">
              <Icon icon={AlertTriangle} size={14} color="#f5b33f" />
              <Text variant="eyebrow" tone="warning">
                Ek tutar
              </Text>
            </View>
            <MoneyAmount
              amount={amount}
              variant="h2"
              tone="warning"
            />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px] leading-[16px]"
            >
              Onaylarsan kartından bu tutar ek olarak pre-auth tutulur.
              İş bitince kesin tutar üzerinden kesilir.
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-2 rounded-[12px] border border-dashed border-app-outline bg-app-surface-2/50 px-3 py-2">
          <Icon icon={Clock3} size={11} color="#83a7ff" />
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
          >
            48 saat içinde yanıt vermezsen otomatik iptal edilir.
          </Text>
        </View>
      </ScrollView>

      {rejecting ? (
        <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
          <Text
            variant="eyebrow"
            tone="subtle"
            className="text-[10px]"
          >
            Red sebebi (opsiyonel)
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Kısa açıklama — usta görecek"
            placeholderTextColor="#6f7b97"
            multiline
            className="rounded-[10px] border border-app-outline bg-app-surface px-3 py-2 text-sm text-app-text"
            textAlignVertical="top"
            style={{ minHeight: 60 }}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Vazgeç"
                variant="outline"
                size="md"
                fullWidth
                onPress={onCancelReject}
                disabled={submitPending}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Reddi gönder"
                size="md"
                fullWidth
                variant="danger"
                loading={submitPending}
                onPress={onReject}
              />
            </View>
          </View>
        </View>
      ) : (
        <View className="gap-2">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Reddet"
                variant="outline"
                size="md"
                fullWidth
                onPress={onStartReject}
                disabled={submitPending}
              />
            </View>
            <View className="flex-[1.4]">
              <Button
                label={submitPending ? "Onaylanıyor…" : "Onayla + Öde"}
                size="md"
                fullWidth
                loading={submitPending}
                onPress={onApprove}
              />
            </View>
          </View>
          {onTalkToTechnician ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Usta ile konuş"
              onPress={onTalkToTechnician}
              disabled={submitPending}
              className="flex-row items-center justify-center gap-2 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2 active:bg-app-surface-2"
            >
              <Icon icon={MessageCircle} size={13} color="#83a7ff" />
              <Text variant="label" tone="inverse" className="text-[12px]">
                Usta ile konuş
              </Text>
            </Pressable>
          ) : null}
          {submitError ? (
            <View className="rounded-[10px] border border-app-critical/30 bg-app-critical-soft px-3 py-2">
              <Text variant="caption" tone="critical" className="text-[11px]">
                İşlem başarısız oldu. Tekrar dene.
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
