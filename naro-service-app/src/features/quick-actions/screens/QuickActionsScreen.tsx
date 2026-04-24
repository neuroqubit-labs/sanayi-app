import type { QuickAction } from "@naro/domain";
import {
  Avatar,
  GlassIconBadge,
  GlassSurface,
  Icon,
  PressableCard,
  shellMotion,
  shellRadius,
  StatusChip,
  Text,
  useNaroTheme,
  withAlphaHex,
  type NaroThemePalette,
  type ThemeScheme,
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
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
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
  const { colors, scheme } = useNaroTheme();
  const { height } = useWindowDimensions();
  const glassBase = scheme === "dark" ? colors.bgMuted : colors.text;
  const glassTextColor = scheme === "dark" ? colors.text : colors.surface;
  const glassMutedTextColor = withAlphaHex(glassTextColor, 0.72);
  const glassBorderColor = withAlphaHex(colors.info, 0.34);
  const sheetBackground = withAlphaHex(
    glassBase,
    scheme === "dark" ? 0.76 : 0.74,
  );
  const blueFilmColor = withAlphaHex(
    colors.info,
    scheme === "dark" ? 0.14 : 0.16,
  );
  const glassHighlightColor = withAlphaHex(
    colors.infoSoft,
    scheme === "dark" ? 0.1 : 0.18,
  );
  const backdropOpacity = scheme === "dark" ? 0.1 : 0.028;
  const sheetShadowOpacity = scheme === "dark" ? 0.34 : 0.2;
  const openHasarSheet = useClaimSourceSheetStore((s) => s.show);
  const setAvailability = useTechnicianProfileStore(
    (state) => state.setAvailability,
  );
  const sheetMaxHeight = Math.round(
    Math.min(height - 48, Math.max(390, height * 0.78)),
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
        className="absolute inset-0"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          className="flex-1"
          style={{ backgroundColor: colors.overlay, opacity: backdropOpacity }}
          onPress={() => router.back()}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.springify().damping(18).mass(0.8)}
        exiting={FadeOutDown.duration(shellMotion.base)}
        style={{
          maxHeight: sheetMaxHeight,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: sheetShadowOpacity,
          shadowRadius: 24,
          elevation: 24,
        }}
      >
        <GlassSurface
          variant="thin"
          tint={scheme === "dark" ? "dark" : "light"}
          style={{
            borderTopLeftRadius: shellRadius.sheet,
            borderTopRightRadius: shellRadius.sheet,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderColor: glassBorderColor,
            borderTopWidth: 1,
            backgroundColor: sheetBackground,
          }}
        >
          <View
            pointerEvents="none"
            className="absolute inset-0"
            style={{ backgroundColor: blueFilmColor }}
          />
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-0 h-24"
            style={{ backgroundColor: glassHighlightColor }}
          />
          <SafeAreaView edges={["bottom"]}>
            <View className="items-center pt-3">
              <View
                className="h-1 w-12 rounded-full"
                style={{
                  backgroundColor: withAlphaHex(colors.info, 0.52),
                }}
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 14,
                paddingBottom: 18,
                gap: 12,
              }}
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  <Avatar name={profile.name} size="sm" />
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="h2"
                      tone="inverse"
                      className="text-[19px] leading-[23px]"
                      numberOfLines={1}
                      style={{ color: glassTextColor }}
                    >
                      {layoutTitle[shellConfig.home_layout]}
                    </Text>
                    <Text
                      variant="caption"
                      tone="subtle"
                      className="text-[11px]"
                      numberOfLines={1}
                      style={{ color: glassMutedTextColor }}
                    >
                      {profile.name}
                    </Text>
                  </View>
                </View>
                <StatusChip label={availabilityLabel} tone={availabilityTone} />
              </View>

              {primaryActions.length > 0 ? (
                <PrimaryActionsGrid
                  actions={primaryActions}
                  colors={colors}
                  scheme={scheme}
                  onSelect={handlePress}
                />
              ) : null}

              {secondaryActions.length > 0 ? (
                <View className="gap-3">
                  <Text
                    variant="eyebrow"
                    tone="subtle"
                    style={{ color: glassMutedTextColor }}
                  >
                    Diğer araçlar
                  </Text>
                  <View className="gap-2">
                    {secondaryActions.map((action) => (
                      <SecondaryActionRow
                        key={action.id}
                        action={action}
                        colors={colors}
                        scheme={scheme}
                        onPress={() => handlePress(action)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </GlassSurface>
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
  colors,
  scheme,
  onSelect,
}: {
  actions: ResolvedAction[];
  colors: NaroThemePalette;
  scheme: ThemeScheme;
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
              colors={colors}
              scheme={scheme}
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
  colors,
  scheme,
  onPress,
}: {
  action: ResolvedAction;
  colors: NaroThemePalette;
  scheme: ThemeScheme;
  onPress: () => void;
}) {
  const tone = getActionToneVisual(action.tone, colors);

  return (
    <PressableCard
      variant="elevated"
      radius="lg"
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={onPress}
      className={["flex-1 bg-app-surface", action.disabled ? "opacity-50" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: withAlphaHex(
          tone.surface,
          scheme === "dark" ? 0.68 : 0.98,
        ),
        borderColor: withAlphaHex(tone.icon, scheme === "dark" ? 0.34 : 0.24),
        shadowColor: tone.icon,
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: scheme === "dark" ? 0.2 : 0.12,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View
        className="min-h-[94px] justify-between gap-2.5 px-4 py-3.5"
        style={{ borderTopColor: tone.icon, borderTopWidth: 2 }}
      >
        <View className="flex-row items-start justify-between gap-2">
          <GlassIconBadge
            icon={action.icon}
            color={tone.icon}
            surfaceColor={tone.surface}
          />
          {action.disabled ? (
            <Text
              variant="caption"
              tone="subtle"
              className="rounded-full border border-app-outline bg-app-surface-2 px-2 py-0.5 text-[10px]"
            >
              Yetki
            </Text>
          ) : null}
        </View>
        <Text
          variant="label"
          tone="inverse"
          className="text-[14px] leading-[18px]"
          numberOfLines={2}
        >
          {action.label}
        </Text>
      </View>
    </PressableCard>
  );
}

function SecondaryActionRow({
  action,
  colors,
  scheme,
  onPress,
}: {
  action: ResolvedAction;
  colors: NaroThemePalette;
  scheme: ThemeScheme;
  onPress: () => void;
}) {
  const tone = getActionToneVisual(action.tone, colors);

  return (
    <PressableCard
      variant="elevated"
      radius="lg"
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 bg-app-surface px-4 py-3",
        action.disabled ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: withAlphaHex(
          tone.surface,
          scheme === "dark" ? 0.56 : 0.92,
        ),
        borderColor: withAlphaHex(tone.icon, scheme === "dark" ? 0.28 : 0.18),
      }}
    >
      <GlassIconBadge
        icon={action.icon}
        color={tone.icon}
        surfaceColor={tone.surface}
        size="sm"
      />
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {action.label}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={13} color={colors.info} />
    </PressableCard>
  );
}

function getActionToneVisual(tone: ActionTone, colors: NaroThemePalette) {
  switch (tone) {
    case "accent":
      return { icon: colors.info, surface: colors.infoSoft };
    case "success":
      return { icon: colors.success, surface: colors.successSoft };
    case "warning":
      return { icon: colors.warning, surface: colors.warningSoft };
    case "info":
      return { icon: colors.info, surface: colors.infoSoft };
    case "neutral":
      return { icon: colors.textSubtle, surface: colors.surface2 };
  }
}
