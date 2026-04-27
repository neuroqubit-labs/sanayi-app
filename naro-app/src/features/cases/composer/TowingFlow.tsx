import type {
  ServiceRequestDraft,
  ServiceRequestUrgency,
  TowVehicleEquipment,
} from "@naro/domain";
import {
  FieldInput,
  GesturePressable as Pressable,
  Icon,
  StatusChip,
  Text,
  ToggleChip,
} from "@naro/ui";
import {
  AlertCircle,
  Calendar,
  Car,
  CarFront,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { ComposerSection } from "./components/ComposerSection";
import { LocationPicker } from "./components/LocationPicker";
import type { ComposerFlow, ComposerStepRenderProps } from "./types";

const PREFERRED_WINDOWS = [
  "Bugün öğleden sonra",
  "Bugün akşam",
  "Yarın sabah",
  "Yarın öğleden sonra",
  "Hafta içi gün seç",
  "Esnek",
];

const LUXURY_KEYWORDS = [
  "bmw",
  "mercedes",
  "audi",
  "lexus",
  "porsche",
  "jaguar",
  "volvo",
];

type EquipmentHint = Extract<
  TowVehicleEquipment,
  "flatbed" | "hook" | "wheel_lift"
>;

const EQUIPMENT_OPTIONS: {
  id: EquipmentHint;
  label: string;
  hint: string;
}[] = [
  { id: "flatbed", label: "Flatbed", hint: "Lüks / hasarlı / uzun mesafe" },
  { id: "hook", label: "Hook", hint: "Kısa mesafe, sağlam araç" },
  { id: "wheel_lift", label: "Tekerlek-kaldıran", hint: "Otopark içi hareket" },
];

type TowingEstimate = {
  distanceKm: number;
  capAmount: number;
  capLabel: string;
  suggestedEquipment: EquipmentHint;
  equipmentReason: string;
};

function estimateTowing(draft: ServiceRequestDraft): TowingEstimate {
  const pickup = draft.location_label.toLowerCase();
  const dropoff = (draft.dropoff_label ?? "").toLowerCase();
  const longHaul =
    pickup.includes("otoyol") ||
    pickup.includes("tem") ||
    dropoff.includes("otoyol");
  const distanceKm = longHaul ? 22 : 8;
  const base = 950;
  const perKm = 70;
  const urgentBonus = draft.urgency === "urgent" ? 80 : 0;
  const buffer = 0.1;
  const rawAmount = base + distanceKm * perKm + urgentBonus;
  const capAmount = Math.round(rawAmount * (1 + buffer));

  const hint = `${pickup} ${dropoff}`.toLowerCase();
  const isLuxury = LUXURY_KEYWORDS.some((kw) => hint.includes(kw));
  const needsFlatbed = isLuxury || distanceKm > 15;
  const suggestedEquipment: EquipmentHint = needsFlatbed ? "flatbed" : "hook";

  return {
    distanceKm,
    capAmount,
    capLabel: `₺${capAmount.toLocaleString("tr-TR")}`,
    suggestedEquipment,
    equipmentReason: needsFlatbed
      ? isLuxury
        ? "Lüks araç yatay platform"
        : "Uzun mesafe"
      : "Kısa mesafe yeterli",
  };
}

function LocationsStep({ draft, updateDraft }: ComposerStepRenderProps) {
  return (
    <View className="gap-4">
      <Text
        tone="muted"
        className="text-app-text-muted text-[13px] leading-[18px]"
      >
        Nereden nereye? Teslim noktası çekici eşleşmesi ve tavan ücret için
        gerekli.
      </Text>

      <LocationPicker
        value={draft.location_label}
        onChange={(next) => updateDraft({ location_label: next })}
        coord={draft.location_lat_lng ?? null}
        onCoordChange={(next) => updateDraft({ location_lat_lng: next })}
        description="Alınacak konum — şu an nereden?"
        mapPurpose="pickup"
      />

      <LocationPicker
        value={draft.dropoff_label ?? ""}
        onChange={(next) =>
          updateDraft({ dropoff_label: next.length === 0 ? undefined : next })
        }
        coord={draft.dropoff_lat_lng ?? null}
        onCoordChange={(next) => updateDraft({ dropoff_lat_lng: next })}
        description="Teslim noktası — servis, ev ya da güvenli bırakma alanı"
        mapPurpose="dropoff"
      />
    </View>
  );
}

function VehicleStateStep({
  draft,
  updateDraft,
}: ComposerStepRenderProps) {
  const drivable = draft.vehicle_drivable;
  const equipmentPreference =
    (draft.tow_required_equipment[0] as EquipmentHint | undefined) ?? null;

  return (
    <View className="gap-4">
      <Text
        tone="muted"
        className="text-app-text-muted text-[13px] leading-[18px]"
      >
        Aracın durumu? Çekme ekipmanını usta kesin olarak karar verir — bu
        sadece ipucu.
      </Text>

      <ComposerSection title="Araç çalışıyor mu?">
        <View className="gap-2">
          <DrivableOption
            title="Çalışıyor / sürülebiliyor"
            subtitle="Marş alıyor, kısa hareket edebilir"
            selected={drivable === true}
            onPress={() =>
              updateDraft({
                vehicle_drivable: true,
                tow_incident_reason: "other",
              })
            }
          />
          <DrivableOption
            title="Çalışmıyor / sürülemiyor"
            subtitle="Marş almıyor, hasarlı veya hareket edemiyor"
            selected={drivable === false}
            onPress={() =>
              updateDraft({
                vehicle_drivable: false,
                tow_incident_reason: "not_running",
              })
            }
          />
        </View>
      </ComposerSection>

      <ComposerSection
        title="Çekme tipi tercihin (opsiyonel)"
        description="Usta karar verir; bu sadece sinyal."
      >
        <View className="flex-row flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((option) => (
            <ToggleChip
              key={option.id}
              label={option.label}
              selected={equipmentPreference === option.id}
              onPress={() =>
                updateDraft({
                  tow_required_equipment:
                    equipmentPreference === option.id ? [] : [option.id],
                })
              }
            />
          ))}
        </View>
        {equipmentPreference ? (
          <View className="flex-row items-center gap-2 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2">
            <Icon icon={Info} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px]"
            >
              {EQUIPMENT_OPTIONS.find((o) => o.id === equipmentPreference)?.hint}
            </Text>
          </View>
        ) : null}
      </ComposerSection>

      <ComposerSection title="Not (opsiyonel)">
        <FieldInput
          value={draft.notes ?? ""}
          onChangeText={(value) => updateDraft({ notes: value })}
          placeholder="Örn: Araç otopark 2. katta, çift çeker gerekebilir…"
          textarea
          rows={3}
          inputClassName="rounded-[20px]"
        />
      </ComposerSection>
    </View>
  );
}

function ScheduleStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const urgency = draft.urgency;

  const setUrgency = (next: ServiceRequestUrgency) => {
    updateDraft({
      urgency: next,
      // urgent veya today'den planned'a dönerken preferred_window temizle
      ...(next === "urgent" ? { preferred_window: undefined } : {}),
    });
  };

  return (
    <View className="gap-4">
      <Text
        tone="muted"
        className="text-app-text-muted text-[13px] leading-[18px]"
      >
        Ne zaman?
      </Text>

      <ComposerSection title="Aciliyet">
        <View className="gap-2">
          <UrgencyOption
            icon={Calendar}
            title="Planlanmış"
            subtitle="Haftalık veya sonraki bir tarihe"
            selected={urgency === "planned"}
            onPress={() => setUrgency("planned")}
          />
          <UrgencyOption
            icon={Clock}
            title="Bugün"
            subtitle="Bugün içinde; zamanlama belirt"
            selected={urgency === "today"}
            onPress={() => setUrgency("today")}
          />
          <UrgencyOption
            icon={Zap}
            title="Acil — şimdi"
            subtitle="5-30 dk içinde yola çıksın"
            selected={urgency === "urgent"}
            onPress={() => setUrgency("urgent")}
            tone="warning"
          />
        </View>
      </ComposerSection>

      {urgency === "urgent" ? (
        <View className="gap-3 rounded-[22px] border border-app-warning/40 bg-app-warning-soft px-4 py-4">
          <View className="flex-row items-center gap-2">
            <Icon icon={AlertCircle} size={16} color="#f5b33f" />
            <Text variant="label" tone="warning" className="text-[14px]">
              Acil çekici modu
            </Text>
          </View>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[17px]"
          >
            Bu akıştan devam ettiğinde vaka yine canonical olarak açılır;
            ödeme ön provizyonu sonrası en yakın uygun çekiciye dispatch başlar.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Planlı çekici olarak devam et"
            onPress={() => setUrgency("today")}
            className="flex-row items-center justify-center gap-2 rounded-[16px] border border-app-outline bg-app-surface px-3 py-2.5 active:bg-app-surface-2"
          >
            <Text variant="label" tone="inverse" className="text-[12px]">
              Planlı devam et
            </Text>
          </Pressable>
        </View>
      ) : null}

      {urgency !== "urgent" ? (
        <ComposerSection title="Zaman tercihi">
          <View className="flex-row flex-wrap gap-2">
            {PREFERRED_WINDOWS.map((window) => (
              <ToggleChip
                key={window}
                label={window}
                selected={draft.preferred_window === window}
                onPress={() =>
                  updateDraft({
                    preferred_window:
                      draft.preferred_window === window ? undefined : window,
                  })
                }
              />
            ))}
          </View>
        </ComposerSection>
      ) : null}
    </View>
  );
}

function ReviewStep({ draft }: ComposerStepRenderProps) {
  const estimate = useMemo(() => estimateTowing(draft), [draft]);
  const hasPickup = draft.location_label.trim().length >= 3;
  const urgencyLabel: Record<ServiceRequestUrgency, string> = {
    planned: "Planlanmış",
    today: "Bugün",
    urgent: "Acil — şimdi",
  };
  const drivableLabel =
    draft.vehicle_drivable === false
      ? "Sürülemiyor"
      : draft.vehicle_drivable === true
        ? "Sürülebiliyor"
        : "Belirtilmedi";

  return (
    <View className="gap-4">
      <View
        className={[
          "gap-3 overflow-hidden rounded-[22px] border",
          hasPickup
            ? "border-app-success/30 bg-app-success-soft"
            : "border-dashed border-app-outline bg-app-surface/50",
        ].join(" ")}
      >
        <View className="flex-row items-start gap-3 px-4 py-4">
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: hasPickup ? "#2dd28d26" : "#6f7b9726",
            }}
          >
            <Icon
              icon={ShieldCheck}
              size={20}
              color={hasPickup ? "#2dd28d" : "#6f7b97"}
            />
          </View>
          <View className="flex-1 gap-1">
            <Text variant="eyebrow" tone="subtle">
              {hasPickup ? "En fazla ödeyeceğin" : "Konum girince hesaplanır"}
            </Text>
            <Text
              variant="display"
              tone={hasPickup ? "success" : "muted"}
              className="text-[22px] leading-[26px]"
            >
              {hasPickup ? estimate.capLabel : "—"}
            </Text>
            {hasPickup ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px] leading-[17px]"
              >
                ~{estimate.distanceKm} km · Gerçek ücret mesafeye göre
                hesaplanır; bu tavan aşılmaz.
              </Text>
            ) : null}
          </View>
        </View>
        {hasPickup ? (
          <View className="flex-row items-center gap-2 border-t border-app-success/20 bg-app-surface/50 px-4 py-2.5">
            <Icon icon={CarFront} size={13} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text-muted text-[11px]"
            >
              Önerilen ekipman:{" "}
              <Text variant="label" tone="inverse" className="text-[11px]">
                {estimate.suggestedEquipment === "flatbed"
                  ? "Flatbed"
                  : "Hook"}
              </Text>
            </Text>
            <StatusChip label={estimate.equipmentReason} tone="neutral" />
          </View>
        ) : null}
      </View>

      <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
        <SummaryRow
          label="Alım"
          value={draft.location_label || "—"}
          tone={draft.location_label ? "neutral" : "warning"}
        />
        <SummaryRow
          label="Teslim"
          value={draft.dropoff_label || "Usta ile anlaşırız"}
          tone={draft.dropoff_label ? "neutral" : "neutral"}
        />
        <SummaryRow label="Aciliyet" value={urgencyLabel[draft.urgency]} />
        <SummaryRow
          label="Zaman"
          value={
            draft.urgency === "urgent"
              ? "5-30 dk"
              : (draft.preferred_window ?? "Belirtilmedi")
          }
        />
        <SummaryRow
          label="Araç durumu"
          value={drivableLabel}
          tone={draft.vehicle_drivable === false ? "warning" : "neutral"}
        />
      </View>

      {draft.notes ? (
        <AccordionRow title="Not" icon={Info} defaultOpen>
          <View className="rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
            <Text tone="muted" className="text-app-text-muted leading-5">
              {draft.notes}
            </Text>
          </View>
        </AccordionRow>
      ) : null}
    </View>
  );
}

type DrivableOptionProps = {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
};

function DrivableOption({
  title,
  subtitle,
  selected,
  onPress,
}: DrivableOptionProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
        selected
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "h-10 w-10 items-center justify-center rounded-full border",
          selected
            ? "border-brand-500/40 bg-brand-500/20"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        <Icon
          icon={selected ? Check : Car}
          size={18}
          color={selected ? "#0ea5e9" : "#83a7ff"}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px]"
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

type UrgencyOptionProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  tone?: "default" | "warning";
};

function UrgencyOption({
  icon,
  title,
  subtitle,
  selected,
  onPress,
  tone = "default",
}: UrgencyOptionProps) {
  const accentColor = tone === "warning" ? "#f5b33f" : "#0ea5e9";
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
        selected
          ? tone === "warning"
            ? "border-app-warning/40 bg-app-warning-soft"
            : "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "h-10 w-10 items-center justify-center rounded-full border",
          selected
            ? tone === "warning"
              ? "border-app-warning/40 bg-app-warning/20"
              : "border-brand-500/40 bg-brand-500/20"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        <Icon icon={icon} size={18} color={selected ? accentColor : "#83a7ff"} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px]"
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "critical" | "accent";
};

function SummaryRow({ label, value, tone = "neutral" }: SummaryRowProps) {
  const valueTone: "inverse" | "success" | "warning" | "critical" | "accent" =
    tone === "neutral" ? "inverse" : tone;
  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-app-outline/60 pb-2 last:border-0 last:pb-0">
      <Text variant="caption" tone="muted" className="text-app-text-muted">
        {label}
      </Text>
      <Text variant="label" tone={valueTone}>
        {value}
      </Text>
    </View>
  );
}

type AccordionRowProps = {
  title: string;
  icon: LucideIcon;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function AccordionRow({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: AccordionRowProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((prev) => !prev)}
        className="flex-row items-center gap-3"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
          <Icon icon={icon} size={16} color="#83a7ff" />
        </View>
        <Text variant="label" tone="inverse" className="flex-1">
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </Text>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} color="#83a7ff" />
      </Pressable>
      {open ? <View className="gap-3 pt-1">{children}</View> : null}
    </View>
  );
}

export const TOWING_FLOW: ComposerFlow = {
  kind: "towing",
  eyebrow: "",
  title: "Çekici çağır",
  description: "",
  progressVariant: "bar-thin",
  submitLabel: "Çekiciyi çağır",
  steps: [
    {
      key: "location",
      title: "Alım + teslim",
      description: "Nereden nereye?",
      validate: (draft) => {
        if (draft.location_label.trim().length < 3) {
          return "Alınacak konumu gir.";
        }
        if (!draft.location_lat_lng) {
          return "Alınacak konumu haritadan seç.";
        }
        if ((draft.dropoff_label ?? "").trim().length < 3) {
          return "Teslim noktasını gir.";
        }
        if (!draft.dropoff_lat_lng) {
          return "Teslim noktasını haritadan seç.";
        }
        return null;
      },
      render: (props) => <LocationsStep {...props} />,
    },
    {
      key: "breakdown_drivable",
      title: "Araç durumu",
      description: "Aracın durumu?",
      validate: (draft) =>
        draft.vehicle_drivable === null ? "Araç durumunu seç." : null,
      render: (props) => <VehicleStateStep {...props} />,
    },
    {
      key: "timing",
      title: "Zaman",
      description: "Ne zaman?",
      validate: (draft) => {
        if (draft.urgency === "urgent") return null;
        return draft.preferred_window
          ? null
          : "Zaman tercihini seç.";
      },
      render: (props) => <ScheduleStep {...props} />,
    },
    {
      key: "review",
      title: "Önizleme",
      description: "Son kontrol",
      validate: () => null,
      render: (props) => <ReviewStep {...props} />,
      isTerminal: true,
    },
  ],
};
