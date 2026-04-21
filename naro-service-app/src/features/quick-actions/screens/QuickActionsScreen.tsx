import type { QuickAction } from "@naro/domain";
import {
  ActionSheetSurface,
  Avatar,
  Icon,
  shellMotion,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  FileCheck,
  Layers,
  List,
  MapPinned,
  MessageSquare,
  Power,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClaimSourceSheetStore } from "@/features/insurance-claim";
import { useShellConfig } from "@/features/shell";
import { useTechnicianProfileStore } from "@/features/technicians";

type ActionTone = "accent" | "success" | "warning" | "info" | "neutral";

const ICON_MAP: Record<string, LucideIcon> = {
  power: Power,
  truck: Truck,
  layers: Layers,
  folder: ClipboardList,
  "shield-check": ShieldCheck,
  megaphone: Sparkles,
  sparkles: List,
  "bar-chart": BarChart3,
  "message-square": MessageSquare,
  "file-check": FileCheck,
  user: User,
  pool: Wrench,
  "map-pin": MapPinned,
};

const TONE_BY_ID: Record<string, ActionTone> = {
  availability: "success",
  active_job: "accent",
  pool: "accent",
  records: "neutral",
  insurance: "info",
  campaign_create: "warning",
  campaigns: "warning",
  revenue: "success",
  reviews: "neutral",
  certificate: "info",
  profile: "neutral",
};

export function QuickActionsScreen() {
  const router = useRouter();
  const shellConfig = useShellConfig();
  const profile = useTechnicianProfileStore();
  const openHasarSheet = useClaimSourceSheetStore((s) => s.show);
  const setAvailability = useTechnicianProfileStore(
    (state) => state.setAvailability,
  );

  const availabilityTone =
    profile.availability === "available"
      ? "success"
      : profile.availability === "busy"
        ? "warning"
        : "critical";
  const availabilityLabel =
    profile.availability === "available"
      ? "Açık"
      : profile.availability === "busy"
        ? "Yoğun"
        : "Çevrimdışı";

  const layoutTitle: Record<typeof shellConfig.home_layout, string> = {
    tow_focused: "Çekici hızlı erişim",
    full: "Hızlı erişim",
    business_lite: "Günlük işler",
    minimal: "Hızlı erişim",
    damage_shop: "Hasar operasyonu",
  };
  const layoutDescription: Record<typeof shellConfig.home_layout, string> = {
    tow_focused: "Aktif iş, müsaitlik, havuz ve kazanç tek yerde.",
    full: "Müsaitlik, kampanyalar, gelir ve havuz kısayolları.",
    business_lite: "İşletme günlük operasyonu için kısayollar.",
    minimal: "Günlük temel aksiyonlar.",
    damage_shop: "Kaza/hasar operasyonu için odaklanmış kısayollar.",
  };

  const handlePress = (action: { id: string; route: string }) => {
    if (action.id === "availability") {
      setAvailability(
        profile.availability === "available" ? "busy" : "available",
      );
      return;
    }
    if (action.id === "insurance") {
      router.back();
      setTimeout(() => openHasarSheet(), 150);
      return;
    }
    router.replace(action.route as Href);
  };

  const actions = shellConfig.quick_action_set.map((action) => {
    const disabled =
      action.requires_capability !== null &&
      !shellConfig.enabled_capabilities.includes(action.requires_capability);
    return {
      ...action,
      disabled,
      icon: ICON_MAP[action.icon] ?? Wrench,
      tone: TONE_BY_ID[action.id] ?? "neutral",
    };
  });

  const primaryActions = actions.slice(0, 3);
  const secondaryActions = actions.slice(3);

  return (
    <View className="flex-1 justify-end">
      <Animated.View
        entering={FadeIn.duration(shellMotion.base)}
        exiting={FadeOut.duration(shellMotion.fast)}
        className="absolute inset-0 bg-black/70"
      >
        <Pressable className="flex-1" onPress={() => router.back()} />
      </Animated.View>

      <SafeAreaView edges={["bottom"]} className="px-3 pb-3">
        <Animated.View
          entering={FadeInDown.duration(shellMotion.slow)}
          exiting={FadeOutDown.duration(shellMotion.base)}
        >
          <ActionSheetSurface
            title={layoutTitle[shellConfig.home_layout]}
            description={layoutDescription[shellConfig.home_layout]}
          >
            <View className="gap-3">
              <View className="gap-3 rounded-[26px] border border-white/8 bg-[#10192b] px-4 py-4">
                <View className="flex-row items-center gap-3">
                  <Avatar name={profile.name} size="lg" />
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text variant="h3" tone="inverse">
                        {profile.name}
                      </Text>
                      <TrustBadge
                        label={shellConfig.active_provider_type}
                        tone="accent"
                      />
                    </View>
                    <Text
                      tone="muted"
                      className="text-app-text-muted"
                      numberOfLines={2}
                    >
                      {profile.tagline}
                    </Text>
                  </View>
                  <StatusChip
                    label={availabilityLabel}
                    tone={availabilityTone}
                  />
                </View>
              </View>

              {primaryActions[0] ? (
                <PrimaryActionCard
                  action={primaryActions[0]}
                  onPress={() => handlePress(primaryActions[0]!)}
                />
              ) : null}

              {primaryActions.length > 1 ? (
                <View className="flex-row gap-3">
                  {primaryActions.slice(1).map((action) => (
                    <View key={action.id} className="flex-1">
                      <PrimaryActionCard
                        action={action}
                        onPress={() => handlePress(action)}
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              {secondaryActions.length > 0 ? (
                <View className="gap-2 pt-1">
                  <Text variant="eyebrow" tone="subtle">
                    Diğer Araçlar
                  </Text>
                  {secondaryActions.map((action) => (
                    <SecondaryActionRow
                      key={action.id}
                      action={action}
                      onPress={() => handlePress(action)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </ActionSheetSurface>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

type ResolvedAction = Omit<QuickAction, "icon"> & {
  disabled: boolean;
  icon: LucideIcon;
  tone: ActionTone;
};

const ACTION_TONE_STYLE: Record<
  ActionTone,
  {
    surface: string;
    iconSurface: string;
    iconColor: string;
  }
> = {
  accent: {
    surface: "border-brand-500/25 bg-brand-500/10",
    iconSurface: "bg-brand-500/15",
    iconColor: "#f45f25",
  },
  success: {
    surface: "border-app-success/25 bg-app-success-soft",
    iconSurface: "bg-app-success/10",
    iconColor: "#2dd28d",
  },
  warning: {
    surface: "border-app-warning/25 bg-app-warning-soft",
    iconSurface: "bg-app-warning/10",
    iconColor: "#f5b33f",
  },
  info: {
    surface: "border-app-info/25 bg-app-info-soft",
    iconSurface: "bg-app-info/10",
    iconColor: "#4aa8ff",
  },
  neutral: {
    surface: "border-app-outline bg-app-surface",
    iconSurface: "bg-app-surface-2",
    iconColor: "#aab6cf",
  },
};

function PrimaryActionCard({
  action,
  onPress,
}: {
  action: ResolvedAction;
  onPress: () => void;
}) {
  const style = ACTION_TONE_STYLE[action.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={onPress}
      className={[
        "min-h-[112px] gap-3 rounded-[24px] border px-4 py-4",
        style.surface,
        action.disabled ? "opacity-50" : "active:opacity-90",
      ].join(" ")}
    >
      <View
        className={[
          "h-11 w-11 items-center justify-center rounded-[16px]",
          style.iconSurface,
        ].join(" ")}
      >
        <Icon icon={action.icon} size={20} color={style.iconColor} />
      </View>
      <View className="gap-1">
        <Text variant="h3" tone="inverse" className="text-[17px] leading-[21px]">
          {action.label}
        </Text>
        {action.disabled ? (
          <Text
            tone="muted"
            className="text-[12px] leading-[17px] text-app-text-muted"
          >
            Yetkin değil — sertifika veya rol gerekli
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SecondaryActionRow({
  action,
  onPress,
}: {
  action: ResolvedAction;
  onPress: () => void;
}) {
  const style = ACTION_TONE_STYLE[action.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3",
        action.disabled ? "opacity-50" : "active:opacity-90",
      ].join(" ")}
    >
      <View
        className={[
          "h-10 w-10 items-center justify-center rounded-[14px]",
          style.iconSurface,
        ].join(" ")}
      >
        <Icon icon={action.icon} size={18} color={style.iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {action.label}
        </Text>
        {action.disabled ? (
          <Text
            tone="muted"
            variant="caption"
            className="text-app-text-muted"
          >
            Yetkin değil
          </Text>
        ) : null}
      </View>
      <Icon icon={ChevronRight} size={16} color="#7f8ba5" />
    </Pressable>
  );
}
