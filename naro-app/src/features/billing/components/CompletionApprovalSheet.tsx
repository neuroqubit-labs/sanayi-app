import {
  ActionSheetSurface,
  BottomSheetOverlay,
  Text,
  useNaroTheme,
} from "@naro/ui";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import { useCaseApprovals, useDecideApproval } from "@/features/approvals";
import { telemetry } from "@/runtime";

import { CompletionDecisionPanel } from "./CompletionDecisionPanel";

export type CompletionApprovalSheetProps = {
  visible: boolean;
  caseId: string;
  approvalId: string | null;
  onClose: () => void;
  onTalkToTechnician?: (caseId: string) => void;
};

/**
 * Completion onayı — usta "iş bitti" der; müşteri onaylar veya sorun bildirir.
 * Minimal sheet: başka finansal alan yok (amount null completion'da).
 */
export function CompletionApprovalSheet({
  visible,
  caseId,
  approvalId,
  onClose,
  onTalkToTechnician,
}: CompletionApprovalSheetProps) {
  const { colors } = useNaroTheme();
  const approvalsQuery = useCaseApprovals(caseId);
  const approval = useMemo(
    () =>
      approvalsQuery.data?.find(
        (a) => a.id === approvalId && a.kind === "completion",
      ) ?? null,
    [approvalsQuery.data, approvalId],
  );

  const submit = useDecideApproval(caseId, approvalId ?? "");

  const handleApprove = async (payload: {
    rating: number;
    review_body?: string;
    public_showcase_consent: boolean;
  }) => {
    if (!approvalId) return;
    try {
      await submit.mutateAsync({
        decision: "approve",
        rating: payload.rating,
        review_body: payload.review_body,
        public_showcase_consent: payload.public_showcase_consent,
      });
      onClose();
    } catch (err) {
      telemetry.captureError(err, { context: "completion approve failed" });
    }
  };

  const handleReject = async (note: string) => {
    if (!approvalId) return;
    try {
      await submit.mutateAsync({ decision: "reject", note });
      onClose();
    } catch (err) {
      telemetry.captureError(err, { context: "completion reject failed" });
    }
  };

  const handleClose = () => {
    if (submit.isPending) return;
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
        title="İş tamamlandı mı?"
        description="Usta işi bitirdi; onayınla süreç kapanır."
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
          <CompletionDecisionPanel
            approval={approval}
            isSubmitting={submit.isPending}
            isError={submit.isError}
            onApprove={handleApprove}
            onReject={handleReject}
            onTalkToTechnician={onTalkToTechnician}
          />
        )}
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}
