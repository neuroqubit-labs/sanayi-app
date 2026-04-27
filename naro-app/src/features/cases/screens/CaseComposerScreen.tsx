import type {
  ServiceRequestDraft,
  ServiceRequestKind,
  TowVehicleEquipment,
} from "@naro/domain";
import { ApiError } from "@naro/mobile-core";
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
import {
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  CarFront,
  ChevronDown,
  FileCheck2,
  LogOut,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getMissingRequiredAttachmentCategories } from "@/features/cases/caseCreationContract";
import { useTechnicianCooldownStore } from "@/features/cases/cooldown-store";
import { useTowFareQuote } from "@/features/tow/api";
import { useTowEntryRoute } from "@/features/tow/entry";
import { useTechnicianProfile } from "@/features/ustalar/api";
import {
  useActiveVehicle,
  useVehicles,
  useVehicleStore,
  useVehicleSwitcherStore,
} from "@/features/vehicles";

import { useCreateCaseDraft, useSubmitCase } from "../api";
import { getComposerFlow } from "../composer";
import { TowCallComposer } from "../composer/TowCallComposer";
import { ComposerScene } from "../composer/components/ComposerScene";
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

function hasMeaningfulDraft(draft: ServiceRequestDraft) {
  if (draft.attachments.length > 0) return true;
  if (draft.symptoms.length > 0) return true;
  if (draft.maintenance_items.length > 0) return true;
  if (draft.breakdown_category) return true;
  if (draft.maintenance_category) return true;
  if (draft.damage_area) return true;
  if (draft.damage_severity) return true;
  if (draft.report_method) return true;
  if (draft.counterparty_note) return true;
  if (draft.vehicle_drivable != null) return true;
  if (draft.on_site_repair || draft.valet_requested) return true;
  if (draft.towing_required) return true;
  if ((draft.summary ?? "").trim().length > 0) return true;
  if ((draft.location_label ?? "").trim().length > 0) return true;
  return false;
}

function extractDuplicateOpenCaseId(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const detail = (err.body as { detail?: unknown } | undefined)?.detail;
  if (!detail || typeof detail !== "object") return null;
  const type = (detail as { type?: unknown }).type;
  const existingCaseId = (detail as { existing_case_id?: unknown })
    .existing_case_id;
  if (type !== "duplicate_open_case" || typeof existingCaseId !== "string") {
    return null;
  }
  return existingCaseId;
}

export function CaseComposerScreen() {
  const router = useRouter();
  const {
    kind: rawKind,
    vehicleId,
    technicianId,
    parentCaseId,
  } = useLocalSearchParams<{
    kind: string;
    vehicleId?: string;
    technicianId?: string;
    parentCaseId?: string;
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
  const [towSubmitMessage, setTowSubmitMessage] = useState<string | null>(null);
  const freshTowDraftKeyRef = useRef<string | null>(null);
  const towEntry = useTowEntryRoute({
    vehicleId: activeVehicle?.id,
  });

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
  const towFareQuote = useTowFareQuote();
  const [exitSheetVisible, setExitSheetVisible] = useState(false);
  const resetTowSubmitErrors = useCallback(() => {
    setTowSubmitMessage(null);
    submitMutation.reset();
    towFareQuote.reset();
  }, [submitMutation, towFareQuote]);
  const flow = useMemo(() => getComposerFlow(kind), [kind]);

  const currentStep = flow.steps[stepIndex] ?? flow.steps[0]!;
  const isLastStep = stepIndex === flow.steps.length - 1;
  const stepValidationMessage = draft ? currentStep.validate(draft) : null;
  const missingRequiredAttachments =
    isLastStep && draft
      ? getMissingRequiredAttachmentCategories(kind, draft)
      : [];
  const validationMessage =
    stepValidationMessage ??
    (missingRequiredAttachments.length > 0
      ? `${missingRequiredAttachments[0]!.label} eksik.`
      : null);
  const canNotifyPreferredTechnician = Boolean(
    technicianId && preferredTechnician && !isTechnicianInCooldown,
  );
  const compactShell = flow.progressVariant === "bar-thin";
  // Compact shell body zaten adım başlığını taşıyor — shell description boş geçilir,
  // böylece step adı progress bar label'ından (Adım X / N · Title) okunur.
  const screenDescription = compactShell
    ? ""
    : preferredTechnician
      ? `${flow.description} Talep ${preferredTechnician.name} önceliğiyle açılır.`
      : flow.description;
  const hasDraftChanges = Boolean(draft && hasMeaningfulDraft(draft));

  useFocusEffect(
    useCallback(() => {
      if (kind === "towing") return undefined;

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (exitSheetVisible) {
            setExitSheetVisible(false);
            return true;
          }
          if (stepIndex > 0) {
            setStepIndex((index) => Math.max(0, index - 1));
            return true;
          }
          setExitSheetVisible(true);
          return true;
        },
      );

      return () => subscription.remove();
    }, [exitSheetVisible, kind, stepIndex]),
  );

  useEffect(() => {
    if (kind !== "towing" || !activeVehicle?.id || !draft) return;
    const draftKey = `${activeVehicle.id}:${parentCaseId ?? ""}`;
    if (freshTowDraftKeyRef.current === draftKey) return;
    freshTowDraftKeyRef.current = draftKey;
    resetTowSubmitErrors();
    resetDraft();
  }, [
    activeVehicle?.id,
    draft,
    kind,
    parentCaseId,
    resetDraft,
    resetTowSubmitErrors,
  ]);

  useEffect(() => {
    if (kind !== "towing" || !towEntry.activeTowCase) return;
    router.replace(`/cekici/${towEntry.activeTowCase.id}` as Href);
  }, [kind, router, towEntry.activeTowCase]);

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
              onPress={() => router.push("/arac/yeni" as Href)}
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
      requestExit();
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
    if (!activeVehicle || !draft) return;
    setTowSubmitMessage(null);

    if (kind === "towing") {
      const isImmediate = draft.urgency === "urgent";
      const mode = isImmediate
        ? ("immediate" as const)
        : ("scheduled" as const);
      if (!draft.location_lat_lng || !draft.dropoff_lat_lng) return;
      const pickupLatLng = draft.location_lat_lng;
      const dropoffLatLng = draft.dropoff_lat_lng;
      const equipment: TowVehicleEquipment[] =
        draft.tow_required_equipment.length > 0
          ? draft.tow_required_equipment
          : ["flatbed"];
      const scheduledAt = isImmediate
        ? null
        : (draft.tow_scheduled_at ??
          new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString());
      try {
        const quote = await towFareQuote.mutateAsync({
          mode,
          pickup_lat_lng: pickupLatLng,
          dropoff_lat_lng: dropoffLatLng,
          required_equipment: equipment,
          urgency_bump: isImmediate,
        });
        const createdCase = await submitMutation.mutateAsync({
          towing: {
            mode,
            pickupLatLng,
            dropoffLatLng,
            requiredEquipment: [...equipment],
            incidentReason:
              draft.tow_incident_reason ??
              (draft.vehicle_drivable === false ? "not_running" : "other"),
            scheduledAt,
            fareQuote: quote.quote as unknown as Record<string, unknown>,
            parentCaseId: parentCaseId ?? null,
          },
        });
        resetDraft();
        router.replace(
          (isImmediate
            ? `/(modal)/cekici-odeme/${createdCase.id}`
            : `/cekici/${createdCase.id}`) as Href,
        );
      } catch (err) {
        const existingCaseId = extractDuplicateOpenCaseId(err);
        if (existingCaseId) {
          resetDraft();
          router.replace(`/cekici/${existingCaseId}` as Href);
          return;
        }
        setTowSubmitMessage(
          "Çekici çağrısı oluşturulamadı. Bağlantını kontrol edip tekrar dene.",
        );
      }
      return;
    }

    const towingHandoff =
      kind !== "breakdown" && kind !== "maintenance" && draft.towing_required;
    const createdCase = await submitMutation.mutateAsync();
    resetDraft();
    if (towingHandoff) {
      router.replace(
        `/(modal)/talep/towing?parentCaseId=${createdCase.id}` as Href,
      );
    } else {
      router.replace(`/vaka/${createdCase.id}` as Href);
    }
  }

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)" as Href);
  };

  const requestExit = () => {
    setExitSheetVisible(true);
  };

  const keepDraftAndExit = () => {
    setExitSheetVisible(false);
    handleClose();
  };

  const discardDraftAndExit = () => {
    resetDraft();
    setExitSheetVisible(false);
    handleClose();
  };

  const exitSheet =
    kind === "towing" ? null : (
      <ComposerExitSheet
        visible={exitSheetVisible}
        hasDraftChanges={hasDraftChanges}
        onCancel={() => setExitSheetVisible(false)}
        onKeepDraft={keepDraftAndExit}
        onDiscard={discardDraftAndExit}
      />
    );

  if (kind === "towing") {
    return (
      <TowCallComposer
        draft={draft}
        activeVehicle={activeVehicle}
        updateDraft={updateDraft}
        onClose={handleClose}
        onSubmit={() => {
          void handleSubmit();
        }}
        onResetSubmitError={resetTowSubmitErrors}
        onOpenVehicleSwitcher={openVehicleSwitcher}
        loading={submitMutation.isPending || towFareQuote.isPending}
        error={
          towSubmitMessage
            ? new Error(towSubmitMessage)
            : (submitMutation.error ?? towFareQuote.error ?? null)
        }
      />
    );
  }

  if (kind === "breakdown" || kind === "maintenance" || kind === "accident") {
    const poolLabel =
      kind === "maintenance" ? "bakım" : kind === "accident" ? "hasar" : "arıza";
    return (
      <>
        <ComposerScene
        title={flow.title}
        subtitle={flow.description}
        vehicleLabel={activeVehicle.plate}
        steps={flow.steps.map((step) => ({
          key: step.key,
          title: step.title,
          description: step.description,
        }))}
        activeIndex={stepIndex}
        onClose={requestExit}
        onStepPress={(index) => setStepIndex(index)}
        trailingAction={
          <ComposerProgressBadge current={stepIndex + 1} total={flow.steps.length} />
        }
        primaryLabel={
          isLastStep ? (flow.submitLabel ?? "Bildirimi gönder") : "Devam et"
        }
        onPrimary={goNext}
        primaryLoading={submitMutation.isPending || towFareQuote.isPending}
        primaryDisabled={Boolean(validationMessage)}
        footerHidden={currentStep.hideFooter}
        secondaryLabel={stepIndex === 0 ? "İptal" : "Geri"}
        onSecondary={goBack}
        helperText={
          validationMessage
            ? validationMessage
            : isLastStep
              ? preferredTechnician
                ? canNotifyPreferredTechnician
                  ? `${preferredTechnician.name} için vaka açılır; teklif geldiğinde randevuya geçersin.`
                : `${preferredTechnician.name} için vaka açılır; teklif süreci vaka detayında ilerler.`
                : `Gönderdiğinde ${poolLabel} havuzuna düşer ve ustalar tekliflerini gönderir.`
              : undefined
        }
        helperTone={validationMessage ? "warning" : "subtle"}
      >
        {preferredTechnician ? (
          <View className="rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5">
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
        {currentStep.render({ kind, draft, updateDraft, goNext })}
        </ComposerScene>
        {exitSheet}
      </>
    );
  }

  return (
    <>
      <FlowScreen
      eyebrow={compactShell ? undefined : flow.eyebrow}
      title={compactShell ? flow.title : flow.title}
      description={screenDescription}
      onBack={compactShell ? requestExit : goBack}
      backVariant={compactShell || stepIndex === 0 ? "close" : "back"}
      compact={compactShell}
      trailingAction={
        compactShell ? (
          <ComposerProgressBadge current={stepIndex + 1} total={flow.steps.length} />
        ) : undefined
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
            primaryLoading={submitMutation.isPending || towFareQuote.isPending}
            primaryDisabled={Boolean(validationMessage)}
            secondaryLabel={stepIndex === 0 ? "İptal" : "Geri"}
            onSecondary={goBack}
            helperText={
              validationMessage
                ? validationMessage
                : isLastStep
                  ? preferredTechnician
                    ? canNotifyPreferredTechnician
                      ? `${preferredTechnician.name} için vaka açılır; teklif geldiğinde randevuya geçersin.`
                      : `${preferredTechnician.name} için vaka açılır; teklif süreci vaka detayında ilerler.`
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
      {exitSheet}
    </>
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

function ComposerProgressBadge({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <View className="min-w-9 items-center rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
      <Text variant="caption" tone="subtle" className="text-[11px]">
        {current}/{total}
      </Text>
    </View>
  );
}

function ComposerExitSheet({
  visible,
  hasDraftChanges,
  onCancel,
  onKeepDraft,
  onDiscard,
}: {
  visible: boolean;
  hasDraftChanges: boolean;
  onCancel: () => void;
  onKeepDraft: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-end bg-black/45 px-4 pb-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vazgeç"
          className="absolute inset-0"
          onPress={onCancel}
        />
        <View className="gap-4 rounded-[28px] border border-app-outline bg-app-bg px-5 pb-5 pt-4">
          <View className="items-center">
            <View className="h-1 w-12 rounded-full bg-app-outline" />
          </View>

          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-[16px] bg-brand-500/15">
              <Icon icon={FileCheck2} size={20} color="#0ea5e9" />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="h3" tone="inverse">
                Çıkmadan önce
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted leading-[18px]"
              >
                {hasDraftChanges
                  ? "Bu vaka taslakta kalabilir ya da seçimleri temizleyip çıkabilirsin."
                  : "Henüz kaydedilecek seçim yok. İstersen doğrudan çıkabilirsin."}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vazgeç"
              onPress={onCancel}
              className="h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface active:bg-app-surface-2"
            >
              <Icon icon={X} size={17} color="#83a7ff" />
            </Pressable>
          </View>

          <View className="gap-2.5">
            <ExitActionRow
              icon={FileCheck2}
              title="Taslak kaydet ve çık"
              subtitle={
                hasDraftChanges
                  ? "Daha sonra kaldığın yerden devam et."
                  : "Kaydedilecek seçim yok; güvenle çıkılır."
              }
              tone="accent"
              onPress={onKeepDraft}
            />
            <ExitActionRow
              icon={hasDraftChanges ? Trash2 : LogOut}
              title={hasDraftChanges ? "Taslağı sil ve çık" : "Çık"}
              subtitle={
                hasDraftChanges
                  ? "Bu vakadaki seçimleri temizle."
                  : "Vaka oluşturmadan ekrana dön."
              }
              tone={hasDraftChanges ? "critical" : "neutral"}
              onPress={onDiscard}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vazgeç"
              onPress={onCancel}
              className="h-[52px] items-center justify-center rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
            >
              <Text variant="label" tone="inverse">
                Vazgeç
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ExitActionRow({
  icon,
  title,
  subtitle,
  tone,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone: "accent" | "critical" | "neutral";
  onPress: () => void;
}) {
  const iconColor =
    tone === "critical" ? "#ef4444" : tone === "accent" ? "#0ea5e9" : "#83a7ff";
  const toneClasses =
    tone === "critical"
      ? "border-app-critical/30 bg-app-critical-soft"
      : tone === "accent"
        ? "border-brand-500/30 bg-brand-500/10"
        : "border-app-outline bg-app-surface";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
        toneClasses,
      ].join(" ")}
    >
      <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-app-surface/80">
        <Icon icon={icon} size={19} color={iconColor} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          variant="label"
          tone={tone === "critical" ? "critical" : "inverse"}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[16px]"
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
