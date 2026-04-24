import {
  FlowProgress,
  FlowScreen,
  Icon,
  StackedActions,
  Text,
  ToggleChip,
  useNaroTheme,
} from "@naro/ui";
import { useRouter } from "expo-router";
import {
  Bike,
  Camera,
  Car,
  Caravan,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  TextInput,
  View,
} from "react-native";

import { useAttachmentPicker } from "@/shared/attachments";
import { useDraftGuard } from "@/shared/navigation/useDraftGuard";

import { useAddVehicle } from "../api";
import {
  VEHICLE_CHASSIS_MAX_LENGTH,
  VEHICLE_ENGINE_MAX_LENGTH,
  VEHICLE_FUEL_OPTIONS,
  VEHICLE_KINDS,
  VEHICLE_KIND_LABELS,
  VEHICLE_PLATE_REGEX,
  VEHICLE_TRANSMISSIONS,
  VEHICLE_TRANSMISSION_LABELS,
  VEHICLE_YEAR_MIN,
  type VehicleFuelKey,
  type VehicleKind,
  type VehicleTransmission,
} from "../constants";
import { VEHICLE_ADD_COPY } from "../copy";
import type { VehicleDraft } from "../types";

// ─── Step config ───────────────────────────────────────────────────────────

const STEP_ORDER = [
  "kind",
  "identity",
  "photo",
  "basics",
  "advanced",
  "consent",
] as const;
type StepKey = (typeof STEP_ORDER)[number];

const STEP_TITLES: Record<StepKey, string> = {
  kind: VEHICLE_ADD_COPY.steps.kind.title,
  identity: VEHICLE_ADD_COPY.steps.identity.title,
  photo: VEHICLE_ADD_COPY.steps.photo.title,
  basics: VEHICLE_ADD_COPY.steps.basics.title,
  advanced: VEHICLE_ADD_COPY.steps.advanced.title,
  consent: VEHICLE_ADD_COPY.steps.consent.title,
};

const KIND_ICONS: Record<VehicleKind, LucideIcon> = {
  otomobil: Car,
  suv: Car,
  motosiklet: Bike,
  kamyonet: Truck,
  hafif_ticari: Truck,
  karavan: Caravan,
  klasik: Car,
  ticari: Truck,
};

// ─── Form state ────────────────────────────────────────────────────────────

type FormState = {
  vehicleKind: VehicleKind | null;
  plate: string;
  make: string;
  model: string;
  year: string;
  photoUri?: string;
  fuel?: VehicleFuelKey;
  mileage: string;
  color: string;
  transmission?: VehicleTransmission;
  chassisNo: string;
  engineNo: string;
  note: string;
  historyAccessGranted: boolean;
};

const INITIAL_STATE: FormState = {
  vehicleKind: null,
  plate: "",
  make: "",
  model: "",
  year: "",
  photoUri: undefined,
  fuel: undefined,
  mileage: "",
  color: "",
  transmission: undefined,
  chassisNo: "",
  engineNo: "",
  note: "",
  historyAccessGranted: false,
};

// ─── Main ──────────────────────────────────────────────────────────────────

export function VehicleAddScreen() {
  const router = useRouter();
  const addVehicle = useAddVehicle();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const stepKey = STEP_ORDER[stepIndex]!;

  const plateNormalized = form.plate.trim().toUpperCase();
  const plateValid = VEHICLE_PLATE_REGEX.test(plateNormalized);
  const yearCurrent = new Date().getFullYear();
  const yearInt = form.year.trim() ? Number(form.year.trim()) : null;
  const yearValid =
    yearInt !== null &&
    Number.isInteger(yearInt) &&
    yearInt >= VEHICLE_YEAR_MIN &&
    yearInt <= yearCurrent + 1;

  const hasContent = Boolean(
    form.vehicleKind ||
      form.plate.trim() ||
      form.make.trim() ||
      form.model.trim() ||
      form.year.trim() ||
      form.photoUri ||
      form.color.trim() ||
      form.mileage.trim() ||
      form.note.trim() ||
      form.chassisNo.trim() ||
      form.engineNo.trim(),
  );

  useDraftGuard({
    enabled: hasContent && !addVehicle.isSuccess,
    title: "Aracı kaydet veya çık",
    message:
      "Girdiğin bilgiler kaybolabilir — devam etmek istediğine emin misin?",
    onDiscard: () => {},
  });

  const validationMessage = useMemo((): string | null => {
    if (stepKey === "kind") {
      if (!form.vehicleKind) return VEHICLE_ADD_COPY.validation.kindRequired;
    }
    if (stepKey === "identity") {
      if (!form.plate.trim()) return VEHICLE_ADD_COPY.validation.plateRequired;
      if (!plateValid) return VEHICLE_ADD_COPY.validation.plateInvalid;
      if (!form.make.trim()) return VEHICLE_ADD_COPY.validation.makeRequired;
      if (!form.model.trim()) return VEHICLE_ADD_COPY.validation.modelRequired;
      if (!form.year.trim()) return VEHICLE_ADD_COPY.validation.yearRequired;
      if (!yearValid) return VEHICLE_ADD_COPY.validation.yearInvalid;
    }
    if (stepKey === "basics") {
      const digits = form.mileage.replace(/\./g, "");
      if (digits && Number.isNaN(Number(digits))) {
        return VEHICLE_ADD_COPY.validation.mileageInvalid;
      }
    }
    if (stepKey === "advanced") {
      if (form.chassisNo.trim().length > VEHICLE_CHASSIS_MAX_LENGTH) {
        return VEHICLE_ADD_COPY.validation.chassisTooLong;
      }
      if (form.engineNo.trim().length > VEHICLE_ENGINE_MAX_LENGTH) {
        return VEHICLE_ADD_COPY.validation.engineTooLong;
      }
    }
    return null;
  }, [stepKey, form, plateValid, yearValid]);

  const isLast = stepIndex === STEP_ORDER.length - 1;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    if (validationMessage) return;
    if (!isLast) {
      setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
      return;
    }
    void handleSubmit();
  }

  function goBack() {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function handleSubmit() {
    if (!form.vehicleKind) return;
    const digits = form.mileage.replace(/\./g, "");
    const mileageNum = digits ? Number(digits) : undefined;
    const draft: VehicleDraft = {
      vehicleKind: form.vehicleKind,
      plate: plateNormalized,
      make: form.make.trim(),
      model: form.model.trim(),
      year: yearInt ?? undefined,
      photoUri: form.photoUri,
      fuel: form.fuel,
      transmission: form.transmission,
      chassisNo: form.chassisNo.trim() || undefined,
      engineNo: form.engineNo.trim() || undefined,
      mileageKm:
        typeof mileageNum === "number" && !Number.isNaN(mileageNum)
          ? mileageNum
          : undefined,
      color: form.color.trim() || undefined,
      note: form.note.trim() || undefined,
      historyAccessGranted: form.historyAccessGranted,
    };
    try {
      const vehicle = await addVehicle.mutateAsync(draft);
      router.replace(`/arac/${vehicle.id}`);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Araç eklenemedi. Tekrar dene.";
      Alert.alert("Araç eklenemedi", message);
    }
  }

  const progressSteps = STEP_ORDER.map((key) => ({
    key,
    title: STEP_TITLES[key],
  }));

  const primaryLabel = isLast
    ? VEHICLE_ADD_COPY.chrome.submitLabel
    : VEHICLE_ADD_COPY.chrome.nextLabel;

  return (
    <FlowScreen
      compact
      title={VEHICLE_ADD_COPY.screen.title}
      onBack={goBack}
      backVariant={stepIndex === 0 ? "close" : "back"}
      trailingAction={
        stepKey === "advanced" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={VEHICLE_ADD_COPY.steps.advanced.skipLabel}
            onPress={() =>
              setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1))
            }
            hitSlop={8}
          >
            <Text variant="label" tone="accent">
              {VEHICLE_ADD_COPY.steps.advanced.skipLabel}
            </Text>
          </Pressable>
        ) : undefined
      }
      progress={
        <FlowProgress
          steps={progressSteps}
          activeIndex={stepIndex}
          variant="bar-thin"
        />
      }
      footer={
        <StackedActions
          floating
          integrated
          primaryLabel={primaryLabel}
          onPrimary={goNext}
          primaryLoading={addVehicle.isPending}
          primaryDisabled={Boolean(validationMessage)}
          helperText={validationMessage ?? undefined}
          helperTone={validationMessage ? "warning" : "subtle"}
        />
      }
    >
      {stepKey === "kind" ? (
        <KindStep
          selected={form.vehicleKind}
          onSelect={(kind) => {
            update("vehicleKind", kind);
            setTimeout(
              () => setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1)),
              150,
            );
          }}
        />
      ) : null}

      {stepKey === "identity" ? (
        <IdentityStep form={form} onChange={update} />
      ) : null}

      {stepKey === "photo" ? (
        <PhotoStep
          photoUri={form.photoUri}
          onChange={(uri) => update("photoUri", uri)}
        />
      ) : null}

      {stepKey === "basics" ? (
        <BasicsStep form={form} onChange={update} />
      ) : null}

      {stepKey === "advanced" ? (
        <AdvancedStep form={form} onChange={update} />
      ) : null}

      {stepKey === "consent" ? (
        <ConsentStep
          granted={form.historyAccessGranted}
          onToggle={() =>
            update("historyAccessGranted", !form.historyAccessGranted)
          }
        />
      ) : null}
    </FlowScreen>
  );
}

// ─── Step: Kind (8 tile grid) ──────────────────────────────────────────────

function KindStep({
  selected,
  onSelect,
}: {
  selected: VehicleKind | null;
  onSelect: (kind: VehicleKind) => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h2" tone="inverse">
          {VEHICLE_ADD_COPY.steps.kind.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted">
          {VEHICLE_ADD_COPY.steps.kind.helper}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {VEHICLE_KINDS.map((kind) => {
          const KindIcon = KIND_ICONS[kind];
          const isSelected = selected === kind;
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={VEHICLE_KIND_LABELS[kind]}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(kind)}
              className={[
                "items-center justify-center gap-2 rounded-2xl border px-3 py-5",
                isSelected
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
              style={{ width: "47%", minHeight: 100 }}
            >
              <Icon
                icon={KindIcon}
                size={28}
                color={isSelected ? colors.info : colors.textMuted}
                strokeWidth={1.8}
              />
              <Text
                variant="label"
                tone={isSelected ? "accent" : "inverse"}
                className="text-center"
              >
                {VEHICLE_KIND_LABELS[kind]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step: Identity (plate, make, model, year) ─────────────────────────────

function IdentityStep({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h2" tone="inverse">
          {VEHICLE_ADD_COPY.steps.identity.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted text-[12px]">
          {VEHICLE_ADD_COPY.steps.identity.helper}
        </Text>
      </View>

      <View className="gap-3">
        <TextField
          value={form.plate}
          onChangeText={(v) => onChange("plate", v)}
          placeholder={VEHICLE_ADD_COPY.steps.identity.placeholders.plate}
          autoCapitalize="characters"
          placeholderColor={colors.textSubtle}
        />
        <TextField
          value={form.make}
          onChangeText={(v) => onChange("make", v)}
          placeholder={VEHICLE_ADD_COPY.steps.identity.placeholders.make}
          placeholderColor={colors.textSubtle}
        />
        <TextField
          value={form.model}
          onChangeText={(v) => onChange("model", v)}
          placeholder={VEHICLE_ADD_COPY.steps.identity.placeholders.model}
          placeholderColor={colors.textSubtle}
        />
        <TextField
          value={form.year}
          onChangeText={(v) => onChange("year", v.replace(/[^0-9]/g, ""))}
          placeholder={VEHICLE_ADD_COPY.steps.identity.placeholders.year}
          placeholderColor={colors.textSubtle}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </View>
  );
}

// ─── Step: Photo (optional, encouraged) ────────────────────────────────────

function PhotoStep({
  photoUri,
  onChange,
}: {
  photoUri: string | undefined;
  onChange: (uri: string | undefined) => void;
}) {
  const { colors } = useNaroTheme();
  // OwnerRef pilot scope'ta pending string — asset user-level saklanıyor,
  // photoUri vehicle.photo_url'e copy ediliyor. TB-4: V1.1'de FK+lifecycle.
  const { pickPhoto, status } = useAttachmentPicker({
    purpose: "vehicle_photo",
    ownerRef: `vehicle:new:${Date.now()}`,
  });

  async function handlePick() {
    const drafts = await pickPhoto("photo", "Araç fotoğrafı", {
      multiple: false,
      quality: 0.85,
    });
    const first = drafts[0];
    if (first?.remoteUri) {
      onChange(first.remoteUri);
    } else if (first?.localUri) {
      onChange(first.localUri);
    }
  }

  const busy = status === "picking" || status === "uploading";

  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h2" tone="inverse">
          {VEHICLE_ADD_COPY.steps.photo.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted text-[13px]">
          {VEHICLE_ADD_COPY.steps.photo.helper}
        </Text>
      </View>

      {photoUri ? (
        <View className="gap-3">
          <View
            className="overflow-hidden rounded-2xl border border-app-outline"
            style={{ aspectRatio: 16 / 10 }}
          >
            <Image
              source={{ uri: photoUri }}
              resizeMode="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={VEHICLE_ADD_COPY.steps.photo.replaceLabel}
              onPress={handlePick}
              disabled={busy}
              className="flex-1 items-center justify-center rounded-xl border border-app-outline bg-app-surface px-4 py-3"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              <Text tone="inverse" variant="label">
                {busy
                  ? VEHICLE_ADD_COPY.steps.photo.uploading
                  : VEHICLE_ADD_COPY.steps.photo.replaceLabel}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={VEHICLE_ADD_COPY.steps.photo.removeLabel}
              onPress={() => onChange(undefined)}
              className="items-center justify-center rounded-xl border border-app-outline bg-app-surface px-4 py-3"
            >
              <Icon icon={X} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={VEHICLE_ADD_COPY.steps.photo.addLabel}
          onPress={handlePick}
          disabled={busy}
          className="items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-app-outline-strong bg-app-surface px-6 py-10"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Icon
            icon={busy ? Camera : ImageIcon}
            size={32}
            color={colors.info}
            strokeWidth={1.6}
          />
          <Text tone="inverse" variant="label">
            {busy
              ? VEHICLE_ADD_COPY.steps.photo.uploading
              : VEHICLE_ADD_COPY.steps.photo.addLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Step: Basics (fuel + mileage + color) ─────────────────────────────────

function BasicsStep({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h2" tone="inverse">
          {VEHICLE_ADD_COPY.steps.basics.title}
        </Text>
      </View>

      <View className="gap-2">
        <Text variant="eyebrow" tone="subtle">
          {VEHICLE_ADD_COPY.steps.basics.fuelLabel}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {VEHICLE_FUEL_OPTIONS.map((opt) => (
            <ToggleChip
              key={opt.key}
              label={opt.label}
              selected={form.fuel === opt.key}
              onPress={() =>
                onChange("fuel", form.fuel === opt.key ? undefined : opt.key)
              }
            />
          ))}
        </View>
      </View>

      <View className="gap-3">
        <TextField
          value={form.mileage}
          onChangeText={(v) => onChange("mileage", v.replace(/[^0-9]/g, ""))}
          placeholder={VEHICLE_ADD_COPY.steps.basics.placeholders.mileage}
          placeholderColor={colors.textSubtle}
          keyboardType="number-pad"
          maxLength={7}
        />
        <TextField
          value={form.color}
          onChangeText={(v) => onChange("color", v)}
          placeholder={VEHICLE_ADD_COPY.steps.basics.placeholders.color}
          placeholderColor={colors.textSubtle}
          maxLength={32}
        />
      </View>
    </View>
  );
}

// ─── Step: Advanced (transmission + chassis + engine + note) ───────────────

function AdvancedStep({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h2" tone="inverse">
          {VEHICLE_ADD_COPY.steps.advanced.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted text-[12px]">
          {VEHICLE_ADD_COPY.steps.advanced.helper}
        </Text>
      </View>

      <View className="gap-2">
        <Text variant="eyebrow" tone="subtle">
          {VEHICLE_ADD_COPY.steps.advanced.transmissionLabel}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {VEHICLE_TRANSMISSIONS.map((t) => (
            <ToggleChip
              key={t}
              label={VEHICLE_TRANSMISSION_LABELS[t]}
              selected={form.transmission === t}
              onPress={() =>
                onChange(
                  "transmission",
                  form.transmission === t ? undefined : t,
                )
              }
            />
          ))}
        </View>
      </View>

      <View className="gap-3">
        <TextField
          value={form.chassisNo}
          onChangeText={(v) => onChange("chassisNo", v.toUpperCase())}
          placeholder={VEHICLE_ADD_COPY.steps.advanced.placeholders.chassis}
          placeholderColor={colors.textSubtle}
          autoCapitalize="characters"
          maxLength={VEHICLE_CHASSIS_MAX_LENGTH}
        />
        <TextField
          value={form.engineNo}
          onChangeText={(v) => onChange("engineNo", v.toUpperCase())}
          placeholder={VEHICLE_ADD_COPY.steps.advanced.placeholders.engine}
          placeholderColor={colors.textSubtle}
          autoCapitalize="characters"
          maxLength={VEHICLE_ENGINE_MAX_LENGTH}
        />
        <TextField
          value={form.note}
          onChangeText={(v) => onChange("note", v)}
          placeholder={VEHICLE_ADD_COPY.steps.advanced.placeholders.note}
          placeholderColor={colors.textSubtle}
          multiline
          maxLength={500}
          minHeight={96}
        />
      </View>
    </View>
  );
}

// ─── Step: Consent (single toggle) ─────────────────────────────────────────

function ConsentStep({
  granted,
  onToggle,
}: {
  granted: boolean;
  onToggle: () => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-5">
      <View className="gap-2">
        <Text variant="h2" tone="inverse">
          {VEHICLE_ADD_COPY.steps.consent.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted leading-6">
          {VEHICLE_ADD_COPY.steps.consent.body}
        </Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: granted }}
        accessibilityLabel={VEHICLE_ADD_COPY.steps.consent.toggleLabel}
        onPress={onToggle}
        className={[
          "flex-row items-center gap-3 rounded-2xl border px-4 py-4",
          granted
            ? "border-brand-500/40 bg-brand-500/10"
            : "border-app-outline bg-app-surface",
        ].join(" ")}
      >
        <View
          className={[
            "h-6 w-6 items-center justify-center rounded-md border",
            granted
              ? "border-brand-500 bg-brand-500"
              : "border-app-outline bg-app-surface",
          ].join(" ")}
        >
          {granted ? (
            <Icon icon={Check} size={14} color={colors.text} />
          ) : null}
        </View>
        <View className="flex-1">
          <Text variant="label" tone="inverse">
            {VEHICLE_ADD_COPY.steps.consent.toggleLabel}
          </Text>
        </View>
        <Icon
          icon={granted ? Eye : EyeOff}
          size={16}
          color={granted ? colors.info : colors.textSubtle}
        />
      </Pressable>
    </View>
  );
}

// ─── Shared TextField (theme-aware, no hardcoded hex) ──────────────────────

type TextFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  placeholderColor: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "number-pad" | "email-address";
  maxLength?: number;
  multiline?: boolean;
  minHeight?: number;
};

function TextField({
  value,
  onChangeText,
  placeholder,
  placeholderColor,
  autoCapitalize,
  keyboardType,
  maxLength,
  multiline,
  minHeight,
}: TextFieldProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      maxLength={maxLength}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "auto"}
      className="rounded-xl border border-app-outline bg-app-surface px-4 py-3 text-base text-app-text"
      style={multiline ? { minHeight: minHeight ?? 96 } : undefined}
    />
  );
}
