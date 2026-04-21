import type { ServiceRequestDraft } from "@naro/domain";
import { Icon, Text } from "@naro/ui";
import { Calendar, MapPin, Zap } from "lucide-react-native";
import { Pressable, TextInput, View } from "react-native";

import { ComposerSection } from "./components/ComposerSection";
import type { ComposerFlow, ComposerStepRenderProps } from "./types";

const INPUT_CLASS =
  "flex-1 text-base text-app-text";

const NOTE_CLASS =
  "rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 text-base text-app-text min-h-[88px]";

const SCHEDULE_WINDOWS = [
  "1 saat içinde",
  "2-3 saat sonra",
  "Akşam",
  "Yarın sabah",
  "Yarın öğleden sonra",
];

type TowingEstimate = {
  distanceKm: number;
  priceLabel: string;
  etaLabel: string;
  amount: number;
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
  const amount = base + distanceKm * perKm + urgentBonus;

  return {
    distanceKm,
    amount,
    priceLabel: `₺${amount.toLocaleString("tr-TR")}`,
    etaLabel: draft.urgency === "urgent" ? "~35 dk" : "Planlı",
  };
}

function TowingScreenStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const isNow = draft.urgency === "urgent";
  const hasPickup = draft.location_label.trim().length >= 3;
  const estimate = estimateTowing(draft);

  return (
    <View className="gap-4">
      <MapHero />

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

      <View className="flex-row gap-2">
        <TimingPill
          icon={Zap}
          label="Hemen"
          selected={isNow}
          onPress={() =>
            updateDraft({ urgency: "urgent", preferred_window: undefined })
          }
        />
        <TimingPill
          icon={Calendar}
          label="Randevulu"
          selected={!isNow}
          onPress={() => updateDraft({ urgency: "today" })}
        />
      </View>

      {!isNow ? (
        <View className="flex-row flex-wrap gap-2">
          {SCHEDULE_WINDOWS.map((window) => (
            <Pressable
              key={window}
              accessibilityRole="button"
              onPress={() =>
                updateDraft({
                  preferred_window:
                    draft.preferred_window === window ? undefined : window,
                })
              }
              className={[
                "rounded-full border px-3.5 py-2 active:opacity-90",
                draft.preferred_window === window
                  ? "border-brand-500 bg-brand-500/15"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              <Text variant="label" tone="inverse" className="text-[13px]">
                {window}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        className={[
          "gap-2 rounded-[22px] border px-4 py-4",
          hasPickup
            ? "border-app-outline bg-app-surface-2"
            : "border-dashed border-app-outline bg-app-surface/50",
        ].join(" ")}
      >
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Tahmini mesafe
          </Text>
          <Text variant="label" tone="inverse">
            {hasPickup ? `~${estimate.distanceKm} km` : "Konumu gir"}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Tahmini ücret
          </Text>
          <Text variant="h3" tone={hasPickup ? "success" : "muted"}>
            {hasPickup ? estimate.priceLabel : "—"}
          </Text>
        </View>
        <Text variant="caption" tone="muted" className="text-app-text-subtle leading-5">
          Mesafe ve ödeme sistemi uygulama üzerinden yönetilir. Kesin ücret
          rota tamamlandığında belirlenir.
        </Text>
      </View>

      <ComposerSection title="Not (opsiyonel)">
        <TextInput
          value={draft.notes ?? ""}
          onChangeText={(value) => updateDraft({ notes: value })}
          placeholder="Örn: Araç otopark 2. katta, çift çeker gerekebilir..."
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className={NOTE_CLASS}
        />
      </ComposerSection>
    </View>
  );
}

function MapHero() {
  return (
    <View className="relative h-44 overflow-hidden rounded-[22px] border border-app-outline bg-app-surface-2">
      {/* Dekoratif grid — harita hissi */}
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
        <View className="h-1.5 w-1.5 rounded-full bg-app-success" />
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          Canlı konum yakında
        </Text>
      </View>
    </View>
  );
}

type TimingPillProps = {
  icon: typeof Zap;
  label: string;
  selected: boolean;
  onPress: () => void;
};

function TimingPill({ icon, label, selected, onPress }: TimingPillProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={[
        "flex-1 flex-row items-center justify-center gap-2 rounded-[18px] border px-4 py-3 active:opacity-90",
        selected
          ? "border-brand-500 bg-brand-500/15"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <Icon icon={icon} size={14} color={selected ? "#0ea5e9" : "#83a7ff"} />
      <Text
        variant="label"
        tone={selected ? "accent" : "inverse"}
        className="text-[14px]"
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const TOWING_FLOW: ComposerFlow = {
  kind: "towing",
  eyebrow: "Çekici çağır",
  title: "Yol desteği — tek ekran",
  description:
    "Konum + zaman + tahmini fiyat. Çağırdıktan sonra en yakın operatör atanır.",
  submitLabel: "Hemen Çekici Çağır",
  steps: [
    {
      key: "location",
      title: "Çekici",
      description: "Konum ve zaman",
      validate: (draft) => {
        if (draft.location_label.trim().length < 3) {
          return "Alınacak konumu yaz.";
        }
        if (draft.urgency !== "urgent" && !draft.preferred_window?.trim()) {
          return "Randevulu isek zaman aralığını seç.";
        }
        return null;
      },
      render: (props) => <TowingScreenStep {...props} />,
      isTerminal: true,
    },
  ],
};
