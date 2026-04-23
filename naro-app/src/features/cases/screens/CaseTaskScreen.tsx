import {
  BackButton,
  Button,
  PlatformTrustCard,
  PremiumListRow,
  Screen,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import {
  useConfirmAppointment,
  useRefreshCaseMatching,
} from "../api";
import { useCanonicalCase } from "../hooks/useCanonicalCase";

const TRUST_RELEVANT_KINDS = new Set([
  "approve_parts",
  "approve_invoice",
  "confirm_completion",
  "share_invoice",
]);

export function CaseTaskScreen() {
  const router = useRouter();
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId: string }>();
  // İş B iter 2 Chunk 3: task canonical case.tasks[] içinden okunur
  // (syncTrackingCase status + kind'den türetir). Eski mock useCaseTask
  // deprecated.
  const { data: caseItem } = useCanonicalCase(id ?? "");
  const task = caseItem?.tasks.find((t) => t.id === taskId) ?? null;
  const refreshMatching = useRefreshCaseMatching(id ?? "");
  const confirmAppointment = useConfirmAppointment(id ?? "");

  if (!caseItem || !task) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Gorev bulunamadi
        </Text>
        <Button label="Geri don" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const relatedDocuments = caseItem.documents.filter((document) =>
    task.related_document_ids.includes(document.id),
  );

  async function handlePrimary() {
    const currentCase = caseItem!;
    const currentTask = task!;

    if (currentTask.kind === "refresh_matching") {
      await refreshMatching.mutateAsync();
      router.replace(`/vaka/${currentCase.id}` as Href);
      return;
    }

    if (currentTask.kind === "confirm_appointment") {
      await confirmAppointment.mutateAsync();
      router.replace(`/vaka/${currentCase.id}` as Href);
      return;
    }

    if (currentTask.kind === "review_offers") {
      router.replace(`/vaka/${currentCase.id}/teklifler` as Href);
      return;
    }

    if (currentTask.kind === "approve_parts" && currentTask.related_approval_id) {
      router.replace(
        `/vaka/${currentCase.id}/onay/${currentTask.related_approval_id}` as Href,
      );
      return;
    }

    if (
      (currentTask.kind === "approve_invoice" ||
        currentTask.kind === "confirm_completion") &&
      currentTask.related_approval_id
    ) {
      router.replace(
        `/vaka/${currentCase.id}/onay/${currentTask.related_approval_id}` as Href,
      );
      return;
    }

    if (currentTask.kind === "open_documents") {
      router.replace(`/vaka/${currentCase.id}/belgeler` as Href);
      return;
    }

    if (currentTask.kind === "message_service") {
      router.replace(`/vaka/${currentCase.id}/mesajlar` as Href);
      return;
    }

    if (currentTask.kind === "start_similar_request") {
      router.replace(`/(modal)/talep/${currentCase.kind}` as Href);
      return;
    }

    router.replace(`/vaka/${currentCase.id}` as Href);
  }

  const isLoading = refreshMatching.isPending || confirmAppointment.isPending;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Görev
          </Text>
          <Text variant="h2" tone="inverse">
            {task.title}
          </Text>
        </View>
      </View>

      <View className="gap-4 rounded-[30px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
        <View className="flex-row items-center justify-between gap-3">
          <TrustBadge
            label={task.urgency === "now" ? "Simdi" : "Siradaki"}
            tone={task.urgency === "now" ? "accent" : "info"}
          />
          <Text variant="caption" tone="subtle">
            {caseItem.updated_at_label}
          </Text>
        </View>
        <Text tone="muted" className="text-app-text-muted">
          {task.description}
        </Text>
        {task.helper_label ? (
          <View className="rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
            <Text variant="label" tone="inverse">
              Yardimci not
            </Text>
            <Text tone="muted" className="mt-2 text-app-text-muted">
              {task.helper_label}
            </Text>
          </View>
        ) : null}
      </View>

      {task.evidence_requirements.length ? (
        <View className="gap-3">
          <Text variant="h3" tone="inverse">
            Bu karar icin gosterilen kanitlar
          </Text>
          <View className="gap-3">
            {task.evidence_requirements.map((item) => (
              <PremiumListRow
                key={item.id}
                title={item.title}
                subtitle={item.hint}
                trailing={
                  <TrustBadge
                    label={item.required ? "Zorunlu" : "Opsiyonel"}
                    tone={item.required ? "warning" : "info"}
                  />
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {relatedDocuments.length ? (
        <View className="gap-3">
          <Text variant="h3" tone="inverse">
            Bu goreve bagli belgeler
          </Text>
          <View className="gap-3">
            {relatedDocuments.map((document) => (
              <PremiumListRow
                key={document.id}
                title={document.title}
                subtitle={`${document.source_label} · ${document.status_label}`}
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

      {TRUST_RELEVANT_KINDS.has(task.kind) ? <PlatformTrustCard /> : null}

      <Button
        label={task.cta_label}
        fullWidth
        size="lg"
        loading={isLoading}
        onPress={() => void handlePrimary()}
      />
    </Screen>
  );
}
