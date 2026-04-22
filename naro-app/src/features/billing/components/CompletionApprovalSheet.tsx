import { ActionSheetSurface, Button, Icon, Text } from "@naro/ui";
import { CheckCircle2, Clock3, MessageCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  View,
} from "react-native";

import { useCaseApprovals, useDecideApproval } from "@/features/approvals";

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
  const approvalsQuery = useCaseApprovals(caseId);
  const approval = useMemo(
    () =>
      approvalsQuery.data?.find(
        (a) => a.id === approvalId && a.kind === "completion",
      ) ?? null,
    [approvalsQuery.data, approvalId],
  );

  const submit = useDecideApproval(caseId, approvalId ?? "");
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    if (!approvalId) return;
    try {
      await submit.mutateAsync({ decision: "approve" });
      onClose();
    } catch (err) {
      console.warn("completion approve failed", err);
    }
  };

  const handleReject = async () => {
    if (!approvalId) return;
    const trimmed = note.trim();
    if (trimmed.length < 5) return;
    try {
      await submit.mutateAsync({ decision: "reject", note: trimmed });
      setNote("");
      setRejecting(false);
      onClose();
    } catch (err) {
      console.warn("completion reject failed", err);
    }
  };

  const handleClose = () => {
    if (submit.isPending) return;
    setRejecting(false);
    setNote("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          onPress={handleClose}
          className="absolute inset-0 bg-black/50"
        />
        <View className="absolute inset-x-0 bottom-0">
          <ActionSheetSurface
            title="İş tamamlandı mı?"
            description="Usta işi bitirdi; onayınla süreç kapanır."
          >
            {approvalsQuery.isLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator size="small" color="#83a7ff" />
              </View>
            ) : approvalsQuery.isError || !approval ? (
              <View className="gap-2 rounded-[16px] border border-app-critical/30 bg-app-critical-soft px-3 py-2.5">
                <Text variant="caption" tone="critical" className="text-[12px]">
                  Onay talebi yüklenemedi. Daha sonra tekrar dene.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {approval.description ? (
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[13px] leading-[18px]"
                  >
                    {approval.description}
                  </Text>
                ) : null}

                <View className="gap-2 rounded-[16px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
                  <View className="flex-row items-center gap-2">
                    <Icon icon={CheckCircle2} size={14} color="#2dd28d" />
                    <Text variant="eyebrow" tone="success">
                      Son kontrol
                    </Text>
                  </View>
                  <Text
                    variant="body"
                    tone="muted"
                    className="text-app-text text-[13px] leading-[19px]"
                  >
                    Onaylarsan vaka kapanır. Sorun varsa "Sorun bildir"e basıp
                    kısa bir açıklama yaz — usta veya admin takip eder.
                  </Text>
                </View>

                <View className="flex-row items-center gap-2 rounded-[12px] border border-dashed border-app-outline bg-app-surface-2/50 px-3 py-2">
                  <Icon icon={Clock3} size={11} color="#83a7ff" />
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-subtle text-[11px]"
                  >
                    48 saat içinde yanıt vermezsen otomatik onaylanır.
                  </Text>
                </View>

                {rejecting ? (
                  <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
                    <Text variant="eyebrow" tone="subtle" className="text-[10px]">
                      Sorun ne? (en az 5 karakter)
                    </Text>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Kısa açıklama — usta ve admin görecek"
                      placeholderTextColor="#6f7b97"
                      multiline
                      className="rounded-[10px] border border-app-outline bg-app-surface px-3 py-2 text-sm text-app-text"
                      textAlignVertical="top"
                      style={{ minHeight: 70 }}
                    />
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Button
                          label="Vazgeç"
                          variant="outline"
                          size="md"
                          fullWidth
                          onPress={() => {
                            setRejecting(false);
                            setNote("");
                          }}
                          disabled={submit.isPending}
                        />
                      </View>
                      <View className="flex-1">
                        <Button
                          label="Sorunu gönder"
                          size="md"
                          fullWidth
                          variant="danger"
                          loading={submit.isPending}
                          disabled={note.trim().length < 5 || submit.isPending}
                          onPress={handleReject}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="gap-2">
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Button
                          label="Sorun bildir"
                          variant="outline"
                          size="md"
                          fullWidth
                          onPress={() => setRejecting(true)}
                          disabled={submit.isPending}
                        />
                      </View>
                      <View className="flex-[1.4]">
                        <Button
                          label={
                            submit.isPending ? "Onaylanıyor…" : "İş tamam, onayla"
                          }
                          size="md"
                          fullWidth
                          loading={submit.isPending}
                          onPress={handleApprove}
                        />
                      </View>
                    </View>
                    {onTalkToTechnician ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Usta ile konuş"
                        onPress={() => onTalkToTechnician(approval.case_id)}
                        disabled={submit.isPending}
                        className="flex-row items-center justify-center gap-2 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2 active:bg-app-surface-2"
                      >
                        <Icon icon={MessageCircle} size={13} color="#83a7ff" />
                        <Text variant="label" tone="inverse" className="text-[12px]">
                          Usta ile konuş
                        </Text>
                      </Pressable>
                    ) : null}
                    {submit.isError ? (
                      <View className="rounded-[10px] border border-app-critical/30 bg-app-critical-soft px-3 py-2">
                        <Text
                          variant="caption"
                          tone="critical"
                          className="text-[11px]"
                        >
                          İşlem başarısız oldu. Tekrar dene.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </ActionSheetSurface>
        </View>
      </View>
    </Modal>
  );
}
