import { Button, PremiumListRow, Text, TrustBadge } from "@naro/ui";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, FileText } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDecideApproval } from "@/features/approvals";
import { CompletionDecisionPanel } from "@/features/billing";

import { useCanonicalCase } from "../hooks/useCanonicalCase";

export function CaseApprovalScreen() {
  const router = useRouter();
  const { id, approvalId } = useLocalSearchParams<{
    id: string;
    approvalId: string;
  }>();
  const { data: caseItem } = useCanonicalCase(id ?? "");
  const decideApproval = useDecideApproval(id ?? "", approvalId ?? "");

  if (!caseItem) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Onay kaydi bulunamadi
          </Text>
          <Button
            label="Geri don"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const approval = caseItem.pending_approvals.find(
    (item) => item.id === approvalId,
  );

  if (!approval) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Bu onay artik beklemiyor
          </Text>
          <Button
            label="Vakaya don"
            variant="outline"
            onPress={() => router.replace(`/vaka/${caseItem.id}` as Href)}
          />
        </View>
      </SafeAreaView>
    );
  }

  const currentCase = caseItem;
  const currentApproval = approval;

  const relatedDocuments = currentCase.documents.filter((document) =>
    currentApproval.evidence_document_ids.includes(document.id),
  );

  const actionLabel =
    currentApproval.action_label ??
    (currentApproval.kind === "parts_request"
      ? "Parca onayini ver"
      : currentApproval.kind === "invoice"
        ? "Faturayi onayla"
        : "Teslimi onayla");

  async function onApprove() {
    await decideApproval.mutateAsync({ decision: "approve" });
    router.replace(`/vaka/${currentCase.id}` as Href);
  }

  async function onApproveCompletion(payload: {
    rating: number;
    review_body?: string;
    public_showcase_consent: boolean;
  }) {
    await decideApproval.mutateAsync({
      decision: "approve",
      rating: payload.rating,
      review_body: payload.review_body,
      public_showcase_consent: payload.public_showcase_consent,
    });
    router.replace(`/vaka/${currentCase.id}` as Href);
  }

  async function onRejectCompletion(note: string) {
    await decideApproval.mutateAsync({ decision: "reject", note });
    router.replace(`/vaka/${currentCase.id}` as Href);
  }

  const isLoading = decideApproval.isPending;
  const isCompletion = currentApproval.kind === "completion";

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <ScrollView contentContainerClassName="gap-5 px-6 pb-36 pt-6">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface"
          >
            <ArrowLeft size={18} color="#f5f7ff" />
          </Pressable>
          <View className="flex-1 gap-1">
            <Text variant="eyebrow" tone="subtle">
              Onay detay
            </Text>
            <Text variant="h2" tone="inverse">
              {currentApproval.title}
            </Text>
          </View>
        </View>

        <View className="gap-4 rounded-[32px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
          <View className="flex-row items-center justify-between gap-3">
            <TrustBadge label="Onay bekliyor" tone="warning" />
            <Text variant="caption" tone="subtle">
              {currentApproval.requested_at_label}
            </Text>
          </View>
          <Text tone="muted" className="text-app-text-muted">
            {currentApproval.description}
          </Text>
          {currentApproval.amount_label ? (
            <Text variant="display" tone="inverse" className="text-[34px] leading-[38px]">
              {currentApproval.amount_label}
            </Text>
          ) : null}
          {currentApproval.service_comment ? (
            <View className="rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
              <Text variant="label" tone="inverse">
                Servis notu
              </Text>
              <Text tone="muted" className="mt-2 text-app-text-muted">
                {currentApproval.service_comment}
              </Text>
            </View>
          ) : null}
        </View>

        {!isCompletion ? (
          <View className="gap-3">
            {currentApproval.line_items.map((item) => (
              <PremiumListRow
                key={item.id}
                title={item.label}
                subtitle={item.note}
                trailing={
                  <Text variant="label" tone="warning">
                    {item.value}
                  </Text>
                }
              />
            ))}
          </View>
        ) : null}

        {isCompletion ? (
          <CompletionDecisionPanel
            approval={{
              case_id: currentCase.id,
              description: currentApproval.description,
              service_comment: currentApproval.service_comment,
              line_items: currentApproval.line_items,
            }}
            isSubmitting={isLoading}
            isError={decideApproval.isError}
            onApprove={onApproveCompletion}
            onReject={onRejectCompletion}
          />
        ) : null}

        {relatedDocuments.length ? (
          <View className="gap-4">
            <Text variant="h3" tone="inverse">
              Kanit ve ekler
            </Text>
            <View className="gap-3">
              {relatedDocuments.map((document) => (
                <PremiumListRow
                  key={document.id}
                  title={document.title}
                  subtitle={`${document.source_label} · ${document.status_label}`}
                  leading={
                    <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                      <FileText size={18} color="#f5f7ff" />
                    </View>
                  }
                  trailing={
                    <Text variant="caption" tone="subtle">
                      {document.created_at_label}
                    </Text>
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {!isCompletion ? (
        <View className="border-t border-app-outline bg-app-bg px-6 pb-5 pt-4">
          <Button
            label={actionLabel}
            fullWidth
            size="lg"
            loading={isLoading}
            onPress={() => void onApprove()}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
