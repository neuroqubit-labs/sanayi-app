import type { ServiceRequestKind } from "@naro/domain";
import {
  Avatar,
  Button,
  FlowProgress,
  FlowScreen,
  StackedActions,
  Text,
  TrustBadge,
  VehicleContextBar,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTechnicianCooldownStore } from "@/features/cases/cooldown-store";
import { useTechnicianProfile } from "@/features/ustalar/api";
import {
  useActiveVehicle,
  useVehicleStore,
  useVehicleSwitcherStore,
} from "@/features/vehicles";
import { useDraftGuard } from "@/shared/navigation/useDraftGuard";

import { useCreateCaseDraft, useSubmitCase } from "../api";
import { getComposerFlow } from "../composer";
import { getCaseKindLabel } from "../presentation";

const KIND_VALUES: ServiceRequestKind[] = [
  "accident",
  "towing",
  "breakdown",
  "maintenance",
];

function isServiceRequestKind(value: string): value is ServiceRequestKind {
  return (KIND_VALUES as string[]).includes(value);
}

function hasMeaningfulDraft(draft: {
  summary?: string;
  location_label?: string;
  attachments: { id: string }[];
  symptoms: string[];
  maintenance_items: string[];
}) {
  if (draft.attachments.length > 0) return true;
  if (draft.symptoms.length > 0) return true;
  if (draft.maintenance_items.length > 0) return true;
  if ((draft.summary ?? "").trim().length > 0) return true;
  if ((draft.location_label ?? "").trim().length > 0) return true;
  return false;
}

export function CaseComposerScreen() {
  const router = useRouter();
  const {
    kind: rawKind,
    vehicleId,
    technicianId,
  } = useLocalSearchParams<{
    kind: string;
    vehicleId?: string;
    technicianId?: string;
  }>();
  const { data: activeVehicle } = useActiveVehicle();
  const { data: preferredTechnician } = useTechnicianProfile(
    technicianId ?? "",
  );
  const setActiveVehicle = useVehicleStore((state) => state.setActiveVehicle);
  const openVehicleSwitcher = useVehicleSwitcherStore((s) => s.open);
  const isTechnicianInCooldown = useTechnicianCooldownStore((state) =>
    technicianId ? state.isInCooldown(technicianId) : false,
  );
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (vehicleId && vehicleId !== activeVehicle?.id) {
      setActiveVehicle(vehicleId);
    }
  }, [vehicleId, activeVehicle?.id, setActiveVehicle]);

  const kind: ServiceRequestKind =
    rawKind && isServiceRequestKind(rawKind) ? rawKind : "breakdown";
  const isValidKind = Boolean(rawKind && isServiceRequestKind(rawKind));

  const { data: draft, updateDraft, resetDraft } = useCreateCaseDraft(kind);
  const submitMutation = useSubmitCase(kind);
  const flow = useMemo(() => getComposerFlow(kind), [kind]);

  const currentStep = flow.steps[stepIndex] ?? flow.steps[0]!;
  const isLastStep = stepIndex === flow.steps.length - 1;
  const validationMessage = draft ? currentStep.validate(draft) : null;
  const canFastTrackToAppointment = Boolean(
    technicianId &&
    preferredTechnician &&
    preferredTechnician.availability === "available" &&
    !isTechnicianInCooldown,
  );
  const screenDescription = preferredTechnician
    ? `${flow.description} Talep ${preferredTechnician.name} önceliğiyle açılır.`
    : flow.description;

  useDraftGuard({
    enabled: Boolean(draft && hasMeaningfulDraft(draft)),
    onDiscard: () => resetDraft(),
  });

  if (!isValidKind) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Talep tipi bulunamadı
          </Text>
          <Button
            label="Geri dön"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!draft || !activeVehicle) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center">
          <Text tone="inverse">Composer hazırlanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const goBack = () => {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    if (validationMessage) {
      return;
    }

    if (isLastStep) {
      void handleSubmit();
      return;
    }

    setStepIndex((current) => Math.min(flow.steps.length - 1, current + 1));
  };

  async function handleSubmit() {
    const createdCase = await submitMutation.mutateAsync();
    resetDraft();
    const nextRoute =
      kind === "towing"
        ? `/cekici-takip/${createdCase.id}`
        : technicianId && canFastTrackToAppointment
          ? `/randevu/${technicianId}?caseId=${createdCase.id}`
          : `/vaka/${createdCase.id}`;
    router.replace(nextRoute as Href);
  }

  return (
    <FlowScreen
      eyebrow={flow.eyebrow}
      title={flow.title}
      description={screenDescription}
      onBack={goBack}
      backVariant={stepIndex === 0 ? "close" : "back"}
      progress={
        flow.steps.length <= 1 ? undefined : (
          <FlowProgress
            steps={flow.steps.map((step) => ({
              key: step.key,
              title: step.title,
              description: step.description,
            }))}
            activeIndex={stepIndex}
            variant={flow.progressVariant ?? "rail"}
            onStepPress={(index) => setStepIndex(index)}
          />
        )
      }
      footer={
        currentStep.hideFooter ? null : (
          <StackedActions
            primaryLabel={
              isLastStep ? (flow.submitLabel ?? "Bildirimi gönder") : "Devam et"
            }
            onPrimary={goNext}
            primaryLoading={submitMutation.isPending}
            primaryDisabled={Boolean(validationMessage)}
            secondaryLabel={stepIndex === 0 ? "İptal" : "Geri"}
            onSecondary={goBack}
            helperText={
              validationMessage
                ? validationMessage
                : isLastStep
                  ? preferredTechnician
                    ? canFastTrackToAppointment
                      ? `${preferredTechnician.name} için vaka açılır; müsait olduğu için sonraki adımda randevuya geçersin.`
                      : `${preferredTechnician.name} için vaka açılır; şu an hızlı randevu yerine önce vaka detayında ilerlersin.`
                    : "Gönderdiğinde hasar havuzuna düşer ve ustalar tekliflerini gönderir."
                  : "Adımı tamamladıkça bildirim netleşir."
            }
            helperTone={validationMessage ? "warning" : "subtle"}
          />
        )
      }
    >
      <View className="gap-2">
        <TrustBadge label={getCaseKindLabel(kind)} tone="accent" />
        {preferredTechnician ? (
          <View className="rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
            <View className="flex-row items-center gap-3">
              <Avatar name={preferredTechnician.name} size="md" />
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse">
                  {preferredTechnician.name}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted"
                >
                  {preferredTechnician.tagline}
                </Text>
              </View>
              <TrustBadge label="Usta öncelikli" tone="info" />
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="mt-3 text-app-text-subtle leading-[18px]"
            >
              Bu talep önce bu servis bağlamında açılır. Gerekirse diğer
              teklifleri daha sonra yine görebilirsin.
            </Text>
          </View>
        ) : null}
        {stepIndex === 0 ? (
          <VehicleContextBar
            plate={activeVehicle.plate}
            vehicle={`${activeVehicle.make} ${activeVehicle.model} · ${activeVehicle.year}`}
            subtitle={activeVehicle.note}
            onPress={openVehicleSwitcher}
          />
        ) : null}
      </View>

      {currentStep.render({ kind, draft, updateDraft, goNext })}
    </FlowScreen>
  );
}
