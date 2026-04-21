import type { ServiceRequestDraft } from "@naro/domain";
import { Icon, StatusChip, Text } from "@naro/ui";
import {
  AlertCircle,
  Battery,
  Calendar,
  CarFront,
  Clock,
  Droplet,
  Gauge,
  Key,
  MapPin,
  ShieldCheck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { ComposerSection } from "./components/ComposerSection";
import type { ComposerFlow, ComposerStepRenderProps } from "./types";

const INPUT_CLASS = "flex-1 text-base text-app-text";
const NOTE_CLASS =
  "rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 text-base text-app-text min-h-[88px]";

type IncidentId =
  | "not_running"
  | "accident"
  | "flat_tire"
  | "battery"
  | "fuel"
  | "locked_keys"
  | "stuck";

const INCIDENT_OPTIONS: {
  id: IncidentId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "not_running", label: "Çalışmıyor", icon: AlertCircle },
  { id: "accident", label: "Kaza", icon: ShieldCheck },
  { id: "flat_tire", label: "Lastik", icon: Gauge },
  { id: "battery", label: "Akü", icon: Battery },
  { id: "fuel", label: "Yakıt", icon: Droplet },
  { id: "locked_keys", label: "Anahtar", icon: Key },
  { id: "stuck", label: "Hendek/Saplandı", icon: Wrench },
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

type TowingEstimate = {
  distanceKm: number;
  capLabel: string;
  capAmount: number;
  equipmentLabel: string;
  equipmentReason: string;
};

function estimateTowing(
  draft: ServiceRequestDraft,
  incident: IncidentId | null,
): TowingEstimate {
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
  const needsFlatbed = incident === "accident" || isLuxury || distanceKm > 15;

  return {
    distanceKm,
    capAmount,
    capLabel: `₺${capAmount.toLocaleString("tr-TR")}`,
    equipmentLabel: needsFlatbed ? "Flatbed" : "Hook",
    equipmentReason: needsFlatbed
      ? incident === "accident"
        ? "Kaza için güvenli taşıma"
        : isLuxury
          ? "Lüks araç yatay platform"
          : "Uzun mesafe"
      : "Kısa mesafe yeterli",
  };
}

function TowingScreenStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const [incident, setIncident] = useState<IncidentId | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const isNow = draft.urgency === "urgent";
  const hasPickup = draft.location_label.trim().length >= 3;
  const estimate = estimateTowing(draft, incident);

  const switchToNow = () => {
    updateDraft({ urgency: "urgent", preferred_window: undefined });
    setScheduledDate("");
    setScheduledTime("");
  };
  const switchToScheduled = () => {
    updateDraft({ urgency: "today" });
  };

  const applyIncident = (id: IncidentId) => {
    setIncident(id === incident ? null : id);
  };

  const applySchedule = (date: string, time: string) => {
    setScheduledDate(date);
    setScheduledTime(time);
    if (date && time) {
      updateDraft({ preferred_window: `${date} ${time}` });
    } else {
      updateDraft({ preferred_window: undefined });
    }
  };

  return (
    <View className="gap-4">
      {/* TAB — Hemen / Randevulu */}
      <View className="flex-row gap-1 rounded-[18px] border border-app-outline-strong bg-app-surface p-1">
        <ModeTab
          icon={Zap}
          label="Hemen"
          description="5-30 dk"
          selected={isNow}
          onPress={switchToNow}
        />
        <ModeTab
          icon={Calendar}
          label="Randevulu"
          description="min 2 sa sonra"
          selected={!isNow}
          onPress={switchToScheduled}
        />
      </View>

      <MapHero isNow={isNow} />

      {/* Konum */}
      <View className="overflow-hidden rounded-[22px] border border-app-outline bg-app-surface">
        <View className="flex-row items-center gap-3 border-b border-app-outline px-4 py-3.5">
          <View className="h-2.5 w-2.5 rounded-full bg-app-success" />
          <TextInput
            value={draft.location_label}
            onChangeText={(value) => updateDraft({ location_label: value })}
            placeholder="Alınacak konum — şu an nereden?"
            placeholderTextColor="#6f7b97"
            className={INPUT_CLASS}
          />
        </View>
        <View className="flex-row items-center gap-3 px-4 py-3.5">
          <View className="h-2.5 w-2.5 rounded-full bg-app-critical" />
          <TextInput
            value={draft.dropoff_label ?? ""}
            onChangeText={(value) => updateDraft({ dropoff_label: value })}
            placeholder="Varış noktası (opsiyonel)"
            placeholderTextColor="#6f7b97"
            className={INPUT_CLASS}
          />
        </View>
      </View>

      {/* Randevulu → tarih + saat */}
      {!isNow ? (
        <View className="flex-row gap-2">
          <View className="flex-1 overflow-hidden rounded-[18px] border border-app-outline bg-app-surface">
            <View className="flex-row items-center gap-2 border-b border-app-outline px-3 py-2">
              <Icon icon={Calendar} size={12} color="#83a7ff" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-subtle text-[11px]"
              >
                Tarih
              </Text>
            </View>
            <TextInput
              value={scheduledDate}
              onChangeText={(v) => applySchedule(v, scheduledTime)}
              placeholder="26 Nis"
              placeholderTextColor="#6f7b97"
              className="px-3 py-2.5 text-base text-app-text"
            />
          </View>
          <View className="flex-1 overflow-hidden rounded-[18px] border border-app-outline bg-app-surface">
            <View className="flex-row items-center gap-2 border-b border-app-outline px-3 py-2">
              <Icon icon={Clock} size={12} color="#83a7ff" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-subtle text-[11px]"
              >
                Saat (min 2 sa)
              </Text>
            </View>
            <TextInput
              value={scheduledTime}
              onChangeText={(v) => applySchedule(scheduledDate, v)}
              placeholder="14:00"
              placeholderTextColor="#6f7b97"
              className="px-3 py-2.5 text-base text-app-text"
            />
          </View>
        </View>
      ) : null}

      {/* İncident — 7 pill */}
      <View className="gap-2">
        <Text variant="eyebrow" tone="subtle">
          Durum
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {INCIDENT_OPTIONS.map((option) => {
            const selected = incident === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => applyIncident(option.id)}
                className={[
                  "flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-90",
                  selected
                    ? "border-brand-500 bg-brand-500/15"
                    : "border-app-outline bg-app-surface",
                ].join(" ")}
              >
                <Icon
                  icon={option.icon}
                  size={13}
                  color={selected ? "#0ea5e9" : "#83a7ff"}
                />
                <Text
                  variant="label"
                  tone={selected ? "accent" : "inverse"}
                  className="text-[12px]"
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {incident === "accident" ? (
          <View className="flex-row items-start gap-2 rounded-[14px] border border-app-critical/30 bg-app-critical-soft px-3 py-2.5">
            <Icon icon={AlertCircle} size={14} color="#ff7e7e" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text text-[12px] leading-[17px]"
            >
              Kazanın kayıt dosyası (kasko, tutanak, fotoğraflar) için "Kaza
              bildir" akışını da başlatmak ister misin? Zincirli süreç daha
              güçlü kanıt izi bırakır.
            </Text>
          </View>
        ) : null}
      </View>

      {/* CAP — HONK pattern */}
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
                hesaplanır; bu tavan aşılmaz. Aşılırsa platform üstlenir.
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
              Otomatik ekipman:{" "}
              <Text variant="label" tone="inverse" className="text-[11px]">
                {estimate.equipmentLabel}
              </Text>
            </Text>
            <StatusChip label={estimate.equipmentReason} tone="neutral" />
          </View>
        ) : null}
      </View>

      <ComposerSection title="Not (opsiyonel)">
        <TextInput
          value={draft.notes ?? ""}
          onChangeText={(value) => updateDraft({ notes: value })}
          placeholder="Örn: Araç otopark 2. katta, çift çeker gerekebilir…"
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className={NOTE_CLASS}
        />
      </ComposerSection>
    </View>
  );
}

function MapHero({ isNow }: { isNow: boolean }) {
  return (
    <View className="relative h-44 overflow-hidden rounded-[22px] border border-app-outline bg-app-surface-2">
      <View className="absolute inset-0 opacity-30">
        <View className="absolute left-0 right-0 top-[25%] h-px bg-app-outline" />
        <View className="absolute left-0 right-0 top-[50%] h-px bg-app-outline" />
        <View className="absolute left-0 right-0 top-[75%] h-px bg-app-outline" />
        <View className="absolute bottom-0 top-0 left-[25%] w-px bg-app-outline" />
        <View className="absolute bottom-0 top-0 left-[50%] w-px bg-app-outline" />
        <View className="absolute bottom-0 top-0 left-[75%] w-px bg-app-outline" />
      </View>
      <View className="absolute inset-0 items-center justify-center">
        <View className="h-14 w-14 items-center justify-center rounded-full border border-brand-500/40 bg-brand-500/20">
          <Icon icon={MapPin} size={24} color="#0ea5e9" />
        </View>
      </View>
      <View className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface/80 px-3 py-1.5">
        <View
          className={[
            "h-1.5 w-1.5 rounded-full",
            isNow ? "bg-app-success" : "bg-app-warning",
          ].join(" ")}
        />
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {isNow ? "Canlı konum yakında" : "Randevu zamanı aktif olacak"}
        </Text>
      </View>
    </View>
  );
}

function ModeTab({
  icon,
  label,
  description,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={[
        "flex-1 flex-row items-center justify-center gap-2 rounded-[14px] px-3 py-3 active:opacity-90",
        selected ? "bg-brand-500/15" : "bg-transparent",
      ].join(" ")}
    >
      <Icon icon={icon} size={15} color={selected ? "#0ea5e9" : "#83a7ff"} />
      <View>
        <Text
          variant="label"
          tone={selected ? "accent" : "inverse"}
          className="text-[13px]"
        >
          {label}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[10px]"
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

export const TOWING_FLOW: ComposerFlow = {
  kind: "towing",
  eyebrow: "Çekici çağır",
  title: "Yol desteği",
  description:
    "Hemen veya randevulu — maksimum ücret vaadimizle. Çağırdıktan sonra en yakın çekici atanır.",
  submitLabel: "Çekici Çağır",
  steps: [
    {
      key: "location",
      title: "Çekici",
      description: "Mod + konum + durum",
      validate: (draft) => {
        if (draft.location_label.trim().length < 3) {
          return "Alınacak konumu yaz.";
        }
        if (draft.urgency !== "urgent" && !draft.preferred_window?.trim()) {
          return "Randevulu ise tarih + saat gir (min 2 sa sonrası).";
        }
        return null;
      },
      render: (props) => <TowingScreenStep {...props} />,
      isTerminal: true,
    },
  ],
};
