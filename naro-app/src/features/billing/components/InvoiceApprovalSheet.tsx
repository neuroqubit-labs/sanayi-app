import {
  ActionSheetSurface,
  Button,
  Icon,
  MoneyAmount,
  Text,
} from "@naro/ui";
import {
  CheckCircle2,
  Clock3,
  FileText,
  MessageCircle,
} from "lucide-react-native";
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

export type InvoiceApprovalSheetProps = {
  visible: boolean;
  approvalId: string | null;
  onClose: () => void;
  /**
   * Approve sonrası ek pre-auth gerekirse (nadir, usta düşük tahmin
   * ettiyse) caller 3DS flow tetiklemek için çağrılır. Çoğu durumda
   * pre-auth yeterli → capture otomatik.
   */
  onNeedsPayment?: (args: {
    caseId: string;
    redirectUrl: string;
    paymentId: string | null;
  }) => void;
  onTalkToTechnician?: (caseId: string) => void;
};

export function InvoiceApprovalSheet({
  visible,
  approvalId,
  onClose,
  onNeedsPayment,
  onTalkToTechnician,
}: InvoiceApprovalSheetProps) {
  const approvalQuery = useCaseApproval(approvalId ?? "");
  const submit = useSubmitApprovalDecision(approvalId ?? "");
  const [reason, setReason] = useState("");
  const [disputing, setDisputing] = useState(false);

  const lineItemsSum = useMemo(() => {
    const items = approvalQuery.data?.line_items ?? [];
    return items.reduce((sum, item) => {
      const parsed = Number.parseFloat(item.value.replace(/[^\d.-]/g, ""));
      return Number.isNaN(parsed) ? sum : sum + parsed;
    }, 0);
  }, [approvalQuery.data]);

  const finalAmount =
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
      console.warn("invoice approve failed", err);
    }
  };

  const handleDispute = async () => {
    if (!approvalId) return;
    const trimmed = reason.trim();
    if (trimmed.length < 10) return;
    try {
      await submit.mutateAsync({ decision: "reject", reason: trimmed });
      setReason("");
      setDisputing(false);
      onClose();
    } catch (err) {
      console.warn("invoice dispute failed", err);
    }
  };

  const handleClose = () => {
    if (submit.isPending) return;
    setDisputing(false);
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
          title="Fatura onayı"
          description="İş tamamlandı — ücret onayını bekliyor"
        >
          {approvalQuery.isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color="#83a7ff" />
            </View>
          ) : approvalQuery.isError || !approvalQuery.data ? (
            <View className="gap-2 rounded-[16px] border border-app-critical/30 bg-app-critical-soft px-3 py-2.5">
              <Text variant="caption" tone="critical" className="text-[12px]">
                Fatura talebi yüklenemedi. Daha sonra tekrar dene.
              </Text>
            </View>
          ) : (
            <InvoiceBody
              data={approvalQuery.data}
              amount={finalAmount}
              disputing={disputing}
              reason={reason}
              setReason={setReason}
              submitPending={submit.isPending}
              submitError={submit.isError}
              onApprove={handleApprove}
              onDispute={handleDispute}
              onStartDispute={() => setDisputing(true)}
              onCancelDispute={() => {
                setDisputing(false);
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
  disputing: boolean;
  reason: string;
  setReason: (v: string) => void;
  submitPending: boolean;
  submitError: boolean;
  onApprove: () => void;
  onDispute: () => void;
  onStartDispute: () => void;
  onCancelDispute: () => void;
  onTalkToTechnician?: () => void;
};

function InvoiceBody({
  data,
  amount,
  disputing,
  reason,
  setReason,
  submitPending,
  submitError,
  onApprove,
  onDispute,
  onStartDispute,
  onCancelDispute,
  onTalkToTechnician,
}: BodyProps) {
  const reasonValid = reason.trim().length >= 10;
  return (
    <View className="gap-3">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        style={{ maxHeight: 440 }}
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
            <Text variant="eyebrow" tone="subtle" className="text-[10px]">
              Ustadan son notu
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
            <View className="flex-row items-center gap-1.5">
              <Icon icon={FileText} size={12} color="#83a7ff" />
              <Text variant="eyebrow" tone="subtle">
                Yapılan işlemler
              </Text>
            </View>
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
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  <Text variant="label" tone="inverse" className="text-[12px]">
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {amount !== null ? (
          <View className="gap-2 rounded-[16px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
            <View className="flex-row items-center gap-2">
              <Icon icon={CheckCircle2} size={14} color="#2dd28d" />
              <Text variant="eyebrow" tone="success">
                Nihai tutar
              </Text>
            </View>
            <MoneyAmount amount={amount} variant="h2" tone="success" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px] leading-[16px]"
            >
              Onayladığında bu tutar kartından tahsil edilir. Fazla tutulan
              pre-auth otomatik iade edilir.
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
            72 saat içinde yanıt vermezsen otomatik onaylanır.
          </Text>
        </View>
      </ScrollView>

      {disputing ? (
        <View className="gap-2 rounded-[14px] border border-app-critical/40 bg-app-critical-soft/30 px-3 py-2.5">
          <Text variant="eyebrow" tone="critical" className="text-[10px]">
            İtiraz sebebi (en az 10 karakter)
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px] leading-[15px]"
          >
            Admin arabulucu 3-5 iş günü içinde inceler. Açıklaman net
            olursa süreç hızlanır.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Sorunu kısaca anlat — iş yapılmadı / tahminden farklı / kalite problemi"
            placeholderTextColor="#6f7b97"
            multiline
            className="rounded-[10px] border border-app-outline bg-app-surface px-3 py-2 text-sm text-app-text"
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Vazgeç"
                variant="outline"
                size="md"
                fullWidth
                onPress={onCancelDispute}
                disabled={submitPending}
              />
            </View>
            <View className="flex-1">
              <Button
                label="İtirazı gönder"
                size="md"
                fullWidth
                variant="danger"
                loading={submitPending}
                disabled={!reasonValid || submitPending}
                onPress={onDispute}
              />
            </View>
          </View>
        </View>
      ) : (
        <View className="gap-2">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="İtiraz et"
                variant="outline"
                size="md"
                fullWidth
                onPress={onStartDispute}
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
                Önce ustaya sor
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
