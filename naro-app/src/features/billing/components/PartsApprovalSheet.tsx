import {
  ActionSheetSurface,
  ActionRow,
  BottomSheetOverlay,
  Button,
  FieldInput,
  Icon,
  MoneyAmount,
  Text,
  ThreeDSWebView,
  useNaroTheme,
} from "@naro/ui";
import { AlertTriangle, Clock3, MessageCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { useThreeDSFlow } from "@/features/billing/hooks";
import {
  useCaseApprovals,
  useDecideApproval,
  useInitiateApprovalPayment,
} from "@/features/approvals";
import type { ApprovalResponse } from "@/features/approvals";

function parseDecimal(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export type PartsApprovalSheetProps = {
  visible: boolean;
  caseId: string;
  approvalId: string | null;
  onClose: () => void;
  /** Usta ile mesajlaşma için route navigate — caller sağlar. */
  onTalkToTechnician?: (caseId: string) => void;
};

export function PartsApprovalSheet({
  visible,
  caseId,
  approvalId,
  onClose,
  onTalkToTechnician,
}: PartsApprovalSheetProps) {
  const { colors } = useNaroTheme();
  const approvalsQuery = useCaseApprovals(caseId);
  const approval = useMemo(
    () =>
      approvalsQuery.data?.find(
        (a) => a.id === approvalId && a.kind === "parts_request",
      ) ?? null,
    [approvalsQuery.data, approvalId],
  );

  const submit = useDecideApproval(caseId, approvalId ?? "");
  const initiatePayment = useInitiateApprovalPayment(caseId, approvalId ?? "");
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const amount = parseDecimal(approval?.amount ?? null);

  const flow = useThreeDSFlow({
    redirectUrl: checkoutUrl,
    onSuccess: () => {
      setCheckoutUrl(null);
      approvalsQuery.refetch();
      onClose();
    },
    onFail: ({ message }) => {
      setPaymentError(message ?? "Ödeme tamamlanamadı. Tekrar deneyebilirsin.");
      setCheckoutUrl(null);
    },
  });

  const handleOfflineApprove = async (
    method: "service_card" | "cash" | undefined,
  ) => {
    if (!approvalId) return;
    try {
      await submit.mutateAsync({
        decision: "approve",
        payment_method: method,
      });
      onClose();
    } catch (err) {
      console.warn("parts approve failed", err);
    }
  };

  const handleOnlinePayment = async () => {
    if (!approvalId) return;
    if (amount === null) {
      await handleOfflineApprove(undefined);
      return;
    }
    try {
      setPaymentError(null);
      const response = await initiatePayment.mutateAsync();
      if (response.checkout_url.startsWith("mock://")) {
        onClose();
        return;
      }
      setCheckoutUrl(response.checkout_url);
    } catch (err) {
      console.warn("parts payment failed", err);
      setPaymentError("Online ödeme başlatılamadı. Diğer ödeme yöntemlerini seçebilirsin.");
    }
  };

  const handleReject = async () => {
    if (!approvalId) return;
    try {
      await submit.mutateAsync({
        decision: "reject",
        note: reason.trim() || null,
      });
      setReason("");
      setRejecting(false);
      onClose();
    } catch (err) {
      console.warn("parts reject failed", err);
    }
  };

  const handleClose = () => {
    if (submit.isPending || initiatePayment.isPending) return;
    if (checkoutUrl) {
      flow.abandon();
      setCheckoutUrl(null);
      return;
    }
    setRejecting(false);
    setReason("");
    onClose();
  };

  return (
    <BottomSheetOverlay
      visible={visible}
      onClose={handleClose}
      accessibilityLabel="Kapat"
      dismissible={!submit.isPending && !initiatePayment.isPending}
    >
      <ActionSheetSurface
        title="Ek parça onayı"
        description="Usta ek parça talep etti"
      >
        {checkoutUrl ? (
          <View className="h-[520px] gap-3">
            <ThreeDSWebView
              source={checkoutUrl}
              onShouldAllowRequest={flow.shouldAllowNavigation}
              loading={flow.state.phase === "loading"}
            />
            <Button
              label="Ödeme adımını kapat"
              variant="outline"
              size="md"
              fullWidth
              onPress={handleClose}
            />
          </View>
        ) : approvalsQuery.isLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator size="small" color={colors.info} />
          </View>
        ) : approvalsQuery.isError || !approval ? (
          <View className="gap-2 rounded-[16px] border border-app-critical/30 bg-app-critical-soft px-3 py-2.5">
            <Text variant="caption" tone="critical" className="text-[12px]">
              Onay talebi yüklenemedi. Daha sonra tekrar dene.
            </Text>
          </View>
        ) : (
          <ApprovalBody
            data={approval}
            amount={amount}
            rejecting={rejecting}
            reason={reason}
            setReason={setReason}
            submitPending={submit.isPending || initiatePayment.isPending}
            submitError={submit.isError || initiatePayment.isError}
            paymentError={paymentError}
            onOnlinePayment={handleOnlinePayment}
            onServiceCard={() => handleOfflineApprove("service_card")}
            onCash={() => handleOfflineApprove("cash")}
            onReject={handleReject}
            onStartReject={() => setRejecting(true)}
            onCancelReject={() => {
              setRejecting(false);
              setReason("");
            }}
            onTalkToTechnician={
              onTalkToTechnician
                ? () => onTalkToTechnician(approval.case_id)
                : undefined
            }
          />
        )}
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}

type BodyProps = {
  data: ApprovalResponse;
  amount: number | null;
  rejecting: boolean;
  reason: string;
  setReason: (v: string) => void;
  submitPending: boolean;
  submitError: boolean;
  paymentError: string | null;
  onOnlinePayment: () => void;
  onServiceCard: () => void;
  onCash: () => void;
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
  paymentError,
  onOnlinePayment,
  onServiceCard,
  onCash,
  onReject,
  onStartReject,
  onCancelReject,
  onTalkToTechnician,
}: BodyProps) {
  const { colors } = useNaroTheme();

  return (
    <View className="gap-3">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        style={{ maxHeight: 420 }}
      >
        {data.description ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[13px] leading-[18px]"
          >
            {data.description}
          </Text>
        ) : null}

        {data.line_items.length > 0 ? (
          <View className="gap-2">
            <Text variant="eyebrow" tone="subtle">
              Ek istenen kalemler
            </Text>
            <View className="gap-1.5 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
              {data.line_items.map((item, idx) => (
                <View
                  key={`${idx}-${item.label}`}
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
                  <Text variant="label" tone="accent" className="text-[12px]">
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
              <Icon icon={AlertTriangle} size={14} color={colors.warning} />
              <Text variant="eyebrow" tone="warning">
                Ek tutar
              </Text>
            </View>
            <MoneyAmount amount={amount} variant="h2" tone="warning" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px] leading-[16px]"
            >
              Online ödeme önerilir. İstersen serviste kart veya nakit ödeme
              seçip bu talebi kayıt altına alabilirsin.
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-2 rounded-[12px] border border-dashed border-app-outline bg-app-surface-2/50 px-3 py-2">
          <Icon icon={Clock3} size={11} color={colors.info} />
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
          <Text variant="eyebrow" tone="subtle" className="text-[10px]">
            Red sebebi (opsiyonel)
          </Text>
          <FieldInput
            value={reason}
            onChangeText={setReason}
            placeholder="Kısa açıklama — usta görecek"
            textarea
            rows={3}
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
          {amount !== null ? (
            <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
              <Text variant="eyebrow" tone="subtle" className="text-[10px]">
                Ödeme yöntemi
              </Text>
              <Button
                label={submitPending ? "Başlatılıyor…" : "Naro ile online öde"}
                size="md"
                fullWidth
                loading={submitPending}
                onPress={onOnlinePayment}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="Serviste kart"
                    variant="outline"
                    size="sm"
                    fullWidth
                    disabled={submitPending}
                    onPress={onServiceCard}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label="Nakit"
                    variant="outline"
                    size="sm"
                    fullWidth
                    disabled={submitPending}
                    onPress={onCash}
                  />
                </View>
              </View>
              <Text variant="caption" tone="muted" className="text-[11px]">
                Serviste ödeme Naro üzerinden tahsil edilmez; yalnızca vaka
                geçmişine işlenir.
              </Text>
            </View>
          ) : null}
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
                label={submitPending ? "Onaylanıyor…" : "Tutar yoksa onayla"}
                size="md"
                fullWidth
                loading={submitPending}
                disabled={amount !== null || submitPending}
                onPress={onOnlinePayment}
              />
            </View>
          </View>
          {onTalkToTechnician ? (
            <ActionRow
              label="Usta ile konuş"
              leading={
                <Icon icon={MessageCircle} size={13} color={colors.info} />
              }
              onPress={onTalkToTechnician}
              disabled={submitPending}
              className="justify-center"
            />
          ) : null}
          {submitError ? (
            <View className="rounded-[10px] border border-app-critical/30 bg-app-critical-soft px-3 py-2">
              <Text variant="caption" tone="critical" className="text-[11px]">
                İşlem başarısız oldu. Tekrar dene.
              </Text>
            </View>
          ) : null}
          {paymentError ? (
            <View className="rounded-[10px] border border-app-critical/30 bg-app-critical-soft px-3 py-2">
              <Text variant="caption" tone="critical" className="text-[11px]">
                {paymentError}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
