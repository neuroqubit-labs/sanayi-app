import type { QuickAction } from "@naro/domain";
import {
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
import { Dimensions, Pressable, ScrollView, View } from "react-native";
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

const TILE_GRADIENT: Record<ActionTone, string> = {
  accent: "rgba(14,165,233,0.18)",
  success: "rgba(45,210,141,0.18)",
  warning: "rgba(245,179,63,0.18)",
  info: "rgba(74,168,255,0.18)",
  neutral: "rgba(131,167,255,0.12)",
};

const TILE_ICON_COLOR: Record<ActionTone, string> = {
  accent: "#0ea5e9",
  success: "#2dd28d",
  warning: "#f5b33f",
  info: "#4aa8ff",
  neutral: "#aab6cf",
};

export function QuickActionsScreen() {
  const router = useRouter();
  const shellConfig = useShellConfig();
  const profile = useTechnicianProfileStore();
  const openHasarSheet = useClaimSourceSheetStore((s) => s.show);
  const setAvailability = useTechnicianProfileStore(
    (state) => state.setAvailability,
  );
  const { height } = Dimensions.get("window");
  const sheetMaxHeight = Math.round(height * 0.82);

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

  const actions: ResolvedAction[] = shellConfig.quick_action_set.map(
    (action) => {
      const disabled =
        action.requires_capability !== null &&
        !shellConfig.enabled_capabilities.includes(action.requires_capability);
      return {
        ...action,
        disabled,
        icon: ICON_MAP[action.icon] ?? Wrench,
        tone: TONE_BY_ID[action.id] ?? "neutral",
      };
    },
  );

  // İlk 4 primary grid (2×2); kalan secondary list
  const primaryActions = actions.slice(0, 4);
  const secondaryActions = actions.slice(4);

  return (
    <View className="flex-1 justify-end">
      <Animated.View
        entering={FadeIn.duration(shellMotion.base)}
        exiting={FadeOut.duration(shellMotion.fast)}
        className="absolute inset-0 bg-black/35"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          className="flex-1"
          onPress={() => router.back()}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(shellMotion.slow)}
        exiting={FadeOutDown.duration(shellMotion.base)}
        style={{ maxHeight: sheetMaxHeight }}
        className="overflow-hidden rounded-t-[32px] border-t border-app-outline-strong bg-app-bg"
      >
        <SafeAreaView edges={["bottom"]}>
          <View className="items-center pt-3">
            <View className="h-1 w-12 rounded-full bg-app-outline-strong" />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 24,
              gap: 20,
            }}
          >
            <View className="gap-1">
              <Text
                variant="h2"
                tone="inverse"
                className="text-[22px] leading-[26px]"
              >
                {layoutTitle[shellConfig.home_layout]}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
              >
                {layoutDescription[shellConfig.home_layout]}
              </Text>
            </View>

            {/* Atölye profil rozeti — servis app'e özgü bağlam */}
            <View className="flex-row items-center gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3">
              <Avatar name={profile.name} size="md" />
              <View className="flex-1 gap-0.5">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text
                    variant="label"
                    tone="inverse"
                    className="text-[14px]"
                    numberOfLines={1}
                  >
                    {profile.name}
                  </Text>
                  <TrustBadge
                    label={shellConfig.active_provider_type}
                    tone="accent"
                  />
                </View>
                <Text
                  tone="muted"
                  className="text-app-text-muted text-[11px]"
                  numberOfLines={1}
                >
                  {profile.tagline}
                </Text>
              </View>
              <StatusChip label={availabilityLabel} tone={availabilityTone} />
            </View>

            {primaryActions.length > 0 ? (
              <PrimaryActionsGrid
                actions={primaryActions}
                onSelect={handlePress}
              />
            ) : null}

            {secondaryActions.length > 0 ? (
              <View className="gap-3">
                <Text variant="eyebrow" tone="subtle">
                  Diğer araçlar
                </Text>
                <View className="gap-2">
                  {secondaryActions.map((action) => (
                    <SecondaryActionRow
                      key={action.id}
                      action={action}
                      onPress={() => handlePress(action)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

type ResolvedAction = Omit<QuickAction, "icon"> & {
  disabled: boolean;
  icon: LucideIcon;
  tone: ActionTone;
};

function PrimaryActionsGrid({
  actions,
  onSelect,
}: {
  actions: ResolvedAction[];
  onSelect: (action: ResolvedAction) => void;
}) {
  const rows: ResolvedAction[][] = [];
  for (let i = 0; i < actions.length; i += 2) {
    rows.push(actions.slice(i, i + 2));
  }
  return (
    <View className="gap-3">
      {rows.map((row, idx) => (
        <View key={idx} className="flex-row gap-3">
          {row.map((action) => (
            <PrimaryActionTile
              key={action.id}
              action={action}
              onPress={() => onSelect(action)}
            />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

function PrimaryActionTile({
  action,
  onPress,
}: {
  action: ResolvedAction;
  onPress: () => void;
}) {
  const gradient = TILE_GRADIENT[action.tone];
  const iconColor = TILE_ICON_COLOR[action.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={onPress}
      className={[
        "flex-1 overflow-hidden rounded-[24px] border border-app-outline bg-app-surface",
        action.disabled ? "opacity-50" : "active:opacity-90",
      ].join(" ")}
    >
      <View
        className="gap-3 px-4 py-4"
        style={{ backgroundColor: gradient, minHeight: 118 }}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${iconColor}26` }}
        >
          <Icon icon={action.icon} size={20} color={iconColor} />
        </View>
        <Text
          variant="h3"
          tone="inverse"
          className="text-[15px] leading-[19px]"
        >
          {action.label}
        </Text>
        {action.disabled ? (
          <Text
            tone="muted"
            className="text-[11px] leading-[15px] text-app-text-muted"
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
  const iconColor = TILE_ICON_COLOR[action.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5",
        action.disabled ? "opacity-50" : "active:bg-app-surface-2",
      ].join(" ")}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${iconColor}22` }}
      >
        <Icon icon={action.icon} size={16} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {action.label}
        </Text>
        {action.disabled ? (
          <Text
            tone="muted"
            variant="caption"
            className="text-app-text-muted text-[11px]"
          >
            Yetkin değil
          </Text>
        ) : null}
      </View>
      <Icon icon={ChevronRight} size={13} color="#83a7ff" />
    </Pressable>
  );
}
