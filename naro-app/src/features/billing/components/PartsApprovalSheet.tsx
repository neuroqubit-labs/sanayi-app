import {
  ActionSheetSurface,
  ActionRow,
  BottomSheetOverlay,
  Button,
  FieldInput,
  Icon,
  MoneyAmount,
  Text,
  useNaroTheme,
} from "@naro/ui";
import { AlertTriangle, Clock3, MessageCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { useCaseApprovals, useDecideApproval } from "@/features/approvals";
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
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const amount = parseDecimal(approval?.amount ?? null);

  const handleApprove = async () => {
    if (!approvalId) return;
    try {
      await submit.mutateAsync({ decision: "approve" });
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
    if (submit.isPending) return;
    setRejecting(false);
    setReason("");
    onClose();
  };

  return (
    <BottomSheetOverlay
      visible={visible}
      onClose={handleClose}
      accessibilityLabel="Kapat"
      dismissible={!submit.isPending}
    >
      <ActionSheetSurface
        title="Ek parça onayı"
        description="Usta ek parça talep etti"
      >
        {approvalsQuery.isLoading ? (
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
              Onaylarsan kartından bu tutar ek olarak pre-auth tutulur. İş
              bitince kesin tutar üzerinden kesilir.
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
                label={submitPending ? "Onaylanıyor…" : "Onayla"}
                size="md"
                fullWidth
                loading={submitPending}
                onPress={onApprove}
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
        </View>
      )}
    </View>
  );
}
