import type { ServiceRequestKind } from "@naro/domain";
import {
  Avatar,
  Button,
  FlowProgress,
  FlowScreen,
  Icon,
  StackedActions,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { CarFront, ChevronDown, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTechnicianCooldownStore } from "@/features/cases/cooldown-store";
import { TOW_DEFAULT_PICKUP, useTowStore } from "@/features/tow";
import { useTechnicianProfile } from "@/features/ustalar/api";
import {
  useActiveVehicle,
  useVehicles,
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
  const {
    data: vehicles,
    isLoading: isLoadingVehicles,
    isError: isVehiclesError,
  } = useVehicles();
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
  const stepValidationMessage = draft ? currentStep.validate(draft) : null;
  // PO K3 karar 2026-04-23: kaza (accident) vakalarında en az 1 fotoğraf
  // ZORUNLU (sigorta dosyası için kritik). towing/breakdown/maintenance
  // opsiyonel. Submit gate sadece son adımda uygulanır.
  const accidentPhotoGap =
    isLastStep &&
    kind === "accident" &&
    (draft?.attachments.length ?? 0) === 0;
  const validationMessage =
    stepValidationMessage ??
    (accidentPhotoGap
      ? "Kaza vakası için en az 1 fotoğraf zorunlu (sigorta dosyası)."
      : null);
  const canFastTrackToAppointment = Boolean(
    technicianId &&
    preferredTechnician &&
    preferredTechnician.availability === "available" &&
    !isTechnicianInCooldown,
  );
  const compactShell = flow.progressVariant === "bar-thin";
  // Compact shell body zaten adım başlığını taşıyor — shell description boş geçilir,
  // böylece step adı progress bar label'ından (Adım X / N · Title) okunur.
  const screenDescription = compactShell
    ? ""
    : preferredTechnician
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

  if (isLoadingVehicles && (!vehicles || vehicles.length === 0)) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color="#83a7ff" />
          <Text tone="muted" variant="caption">
            Araçların yükleniyor…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isVehiclesError) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse" className="text-center">
            Araç listesi yüklenemedi
          </Text>
          <Text variant="body" tone="muted" className="text-center">
            Bağlantını kontrol edip yeniden dene.
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

  if (!vehicles || vehicles.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-5 px-6">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={CarFront} size={24} color="#83a7ff" />
          </View>
          <View className="gap-2">
            <Text variant="h2" tone="inverse" className="text-center">
              Önce aracını ekle
            </Text>
            <Text variant="body" tone="muted" className="text-center">
              Talep oluşturabilmek için kayıtlı bir araca ihtiyacın var. Birkaç
              saniyede ekleyip kaldığın yerden devam edebilirsin.
            </Text>
          </View>
          <View className="w-full gap-2">
            <Button
              label="Aracımı ekle"
              variant="primary"
              leftIcon={<Icon icon={Plus} size={16} color="#ffffff" />}
              onPress={() => router.replace("/(modal)/arac-ekle" as Href)}
            />
            <Button
              label="Geri dön"
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!draft || !activeVehicle) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color="#83a7ff" />
          <Text tone="muted" variant="caption">
            Composer hazırlanıyor…
          </Text>
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
    if (!activeVehicle) return;

    if (kind === "towing") {
      const isImmediate = draft.urgency === "urgent";
      const createTowCase = useTowStore.getState();
      const baseTowInput = {
        pickup_lat_lng: TOW_DEFAULT_PICKUP.lat_lng,
        pickup_label: draft.location_label.trim() || TOW_DEFAULT_PICKUP.label,
        dropoff_lat_lng: null,
        dropoff_label: draft.dropoff_label?.trim() || null,
        vehicle_id: activeVehicle.id,
        incident_reason: "not_running" as const,
        required_equipment: "flatbed" as const,
        kasko: {
          has_kasko: false,
          pre_auth_on_customer_card: true,
        },
        attachments: [],
      };
      const created = isImmediate
        ? createTowCase.createImmediate(baseTowInput)
        : createTowCase.createScheduled({
            ...baseTowInput,
            scheduled_at:
              draft.preferred_window ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          });
      resetDraft();
      router.replace(`/cekici/${created.id}` as Href);
      return;
    }

    const createdCase = await submitMutation.mutateAsync();
    resetDraft();
    const nextRoute =
      technicianId && canFastTrackToAppointment
        ? `/randevu/${technicianId}?caseId=${createdCase.id}`
        : `/vaka/${createdCase.id}`;
    router.replace(nextRoute as Href);
  }

  const handleClose = () => {
    router.back();
  };

  return (
    <FlowScreen
      eyebrow={compactShell ? undefined : flow.eyebrow}
      title={compactShell ? flow.title : flow.title}
      description={screenDescription}
      onBack={compactShell ? handleClose : goBack}
      backVariant={compactShell || stepIndex === 0 ? "close" : "back"}
      compact={compactShell}
      trailingAction={
        compactShell ? <DraftSaveAction onPress={handleClose} /> : undefined
      }
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
        {compactShell && stepIndex === 0 ? (
          <View className="items-center">
            <VehiclePlateChip
              plate={activeVehicle.plate}
              onPress={openVehicleSwitcher}
            />
          </View>
        ) : !compactShell ? (
          <TrustBadge label={getCaseKindLabel(kind)} tone="accent" />
        ) : null}
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
      </View>

      {currentStep.render({ kind, draft, updateDraft, goNext })}
    </FlowScreen>
  );
}

function VehiclePlateChip({
  plate,
  onPress,
}: {
  plate: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Aracı değiştir — ${plate}`}
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:bg-app-surface-2"
    >
      <Icon icon={CarFront} size={12} color="#83a7ff" />
      <Text variant="label" tone="inverse" className="text-[12px]">
        {plate}
      </Text>
      <Icon icon={ChevronDown} size={11} color="#83a7ff" />
    </Pressable>
  );
}

function DraftSaveAction({ onPress }: { onPress: () => void }) {
  // V1: "Taslak kaydet" pattern UI slot'u — gerçek persist sonraki brief'te.
  // Şimdilik çıkış onayı gibi davranıyor (router.back).
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Taslak kaydet"
      onPress={onPress}
      className="rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:bg-app-surface-2"
    >
      <Text variant="caption" tone="accent" className="text-[11px]">
        Taslak kaydet
      </Text>
    </Pressable>
  );
}
