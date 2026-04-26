import { Avatar, Button, Icon, Text, TrustBadge } from "@naro/ui";
import { Href, useRouter } from "expo-router";
import { Clock, MapPin, Star } from "lucide-react-native";
import { Alert, Pressable, View, type ViewStyle } from "react-native";

import {
  attachTechnicianToCase,
  prefillDraftForTechnician,
  useNotifyCaseToTechnician,
  useTechnicianCaseAction,
} from "@/features/cases";
import { useUstaPreviewStore } from "@/features/ustalar";
import type { TechnicianMatch } from "@/features/ustalar/types";
import { useActiveVehicle } from "@/features/vehicles";

type TechnicianSuggestionCardProps = {
  technician: TechnicianMatch;
};

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";
const CARD_SHADOW_STYLE: ViewStyle = {
  shadowColor: "#020617",
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.35,
  shadowRadius: 28,
  elevation: 12,
};

export function TechnicianSuggestionCard({
  technician,
}: TechnicianSuggestionCardProps) {
  const router = useRouter();
  const action = useTechnicianCaseAction(technician.id);
  const notifyCase = useNotifyCaseToTechnician();
  const { data: activeVehicle } = useActiveVehicle();
  const openPreview = useUstaPreviewStore((state) => state.open);
  const primaryLabel =
    action.mode === "open_case" ? "Profili Gör" : action.primaryLabel;
  const buttonClassName = action.disabled
    ? "rounded-[18px] border border-white/10 bg-white/5 active:bg-white/5"
    : "rounded-[18px]";

  const showPreview = () => openPreview(technician.id);

  async function handlePrimary() {
    if (action.disabled || notifyCase.isPending) return;
    if (action.mode === "open_case") {
      showPreview();
      return;
    }
    if (action.mode === "notify_case" && action.caseId) {
      try {
        await notifyCase.mutateAsync({
          caseId: action.caseId,
          technicianId: technician.id,
        });
        router.push(action.primaryRoute as Href);
      } catch {
        Alert.alert(
          "Vaka bildirilemedi",
          "Usta bu vaka için uygun olmayabilir. Birazdan tekrar dene.",
        );
      }
      return;
    }
    if (action.attachOnPrimary && action.caseId) {
      attachTechnicianToCase(action.caseId, technician.id);
    }
    if (action.prefillOnPrimary) {
      prefillDraftForTechnician(
        action.kind,
        technician.id,
        activeVehicle?.id ?? DEFAULT_VEHICLE_ID,
      );
    }
    router.push(action.primaryRoute as Href);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${technician.name} profilini ac`}
      onPress={showPreview}
      style={CARD_SHADOW_STYLE}
      className="w-[286px] overflow-hidden rounded-[30px] border border-white/10 bg-app-surface active:opacity-95"
    >
      <View className="relative h-28 overflow-hidden border-b border-white/10 bg-brand-500/10">
        <View className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <View className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-brand-500/20" />
        <View className="absolute right-10 top-6 h-14 w-14 rounded-full bg-white/5" />
        <View className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-white/5" />

        <View className="absolute left-4 top-4 max-w-[170px]">
          <TrustBadge label={technician.reason} tone="info" />
        </View>

        <View className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
          <Text
            variant="caption"
            tone="muted"
            className="text-[11px] text-app-text"
          >
            {technician.availabilityLabel}
          </Text>
        </View>

        <View className="absolute -bottom-5 left-5">
          <View className="rounded-[24px] border border-white/10 bg-black/25 p-1.5">
            <Avatar
              name={technician.name}
              size="xl"
              className="border-white/10 bg-white/10"
            />
          </View>
        </View>
      </View>

      <View className="gap-4 px-5 pb-5 pt-7">
        <View className="gap-1.5">
          <Text
            variant="h3"
            tone="inverse"
            className="text-[28px] leading-[30px]"
          >
            {technician.name}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[13px] leading-[18px]"
          >
            {technician.tagline}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <MetricPill
            icon={Star}
            iconColor="#f5b33f"
            label={technician.rating.toFixed(1)}
          />
          <MetricPill
            icon={MapPin}
            iconColor="#83a7ff"
            label={`${technician.distanceKm.toFixed(1)} km`}
          />
          <MetricPill
            icon={Clock}
            iconColor="#2dd28d"
            label={`${technician.responseMinutes} dk yanıt`}
          />
        </View>

        <View className="gap-2 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3.5">
          <Text variant="eyebrow" tone="subtle" className="tracking-[0.28em]">
            Fiyat bandı
          </Text>
          <View className="flex-row items-end justify-between gap-3">
            <Text
              variant="h3"
              tone="inverse"
              className="flex-1 text-[30px] leading-[32px]"
            >
              {technician.priceLabel}
            </Text>
            <View className="rounded-full border border-app-success/20 bg-app-success/10 px-2.5 py-1">
              <Text variant="caption" tone="success" className="text-[11px]">
                {technician.availabilityLabel}
              </Text>
            </View>
          </View>
        </View>

        <Button
          label={primaryLabel}
          variant={action.disabled ? "outline" : "primary"}
          fullWidth
          size="lg"
          className={buttonClassName}
          labelClassName="text-[15px] font-semibold"
          disabled={action.disabled || notifyCase.isPending}
          onPress={(event) => {
            event.stopPropagation();
            void handlePrimary();
          }}
        />
        {action.helperText ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-subtle text-[11px]"
          >
            {action.helperText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type MetricPillProps = {
  icon: typeof Star;
  iconColor: string;
  label: string;
};

function MetricPill({ icon, iconColor, label }: MetricPillProps) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      <Icon icon={icon} size={12} color={iconColor} strokeWidth={2.4} />
      <Text
        variant="caption"
        tone="muted"
        className="text-[11px] text-app-text"
      >
        {label}
      </Text>
    </View>
  );
}
