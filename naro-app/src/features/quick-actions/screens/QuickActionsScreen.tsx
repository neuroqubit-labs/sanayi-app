import {
  GlassIconBadge,
  GlassSurface,
  PressableCard,
  shellMotion,
  shellRadius,
  Text,
  useNaroTheme,
  withAlphaHex,
  type NaroThemePalette,
  type ThemeScheme,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  AlertTriangle,
  Heart,
  Sparkles,
  Truck,
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

import { useTowEntryRoute } from "@/features/tow/entry";
import { useActiveVehicle } from "@/features/vehicles";

type ActionKey = "bakim" | "hasar" | "ariza" | "cekici";
type ActionTone = "success" | "critical" | "warning" | "info";

type ActionTile = {
  key: ActionKey;
  label: string;
  icon: LucideIcon;
  route: Href;
  tone: ActionTone;
};

const PRIMARY_ACTIONS: ActionTile[] = [
  {
    key: "bakim",
    label: "Bakım planla",
    icon: Heart,
    route: "/(modal)/talep/maintenance" as Href,
    tone: "success",
  },
  {
    key: "hasar",
    label: "Hasar bildir",
    icon: AlertTriangle,
    route: "/(modal)/talep/accident" as Href,
    tone: "critical",
  },
  {
    key: "ariza",
    label: "Arıza bildir",
    icon: Wrench,
    route: "/(modal)/talep/breakdown" as Href,
    tone: "warning",
  },
  {
    key: "cekici",
    label: "Çekici çağır",
    icon: Truck,
    route: "/(modal)/talep/towing" as Href,
    tone: "info",
  },
];

const DISCOVERY_ITEMS: {
  key: string;
  label: string;
  badge: string;
  icon: LucideIcon;
  route: Href;
}[] = [
  {
    key: "ustalar",
    label: "Ustaları keşfet",
    badge: "Çarşı",
    icon: Sparkles,
    route: "/(tabs)/carsi" as Href,
  },
];

export function QuickActionsScreen() {
  const router = useRouter();
  const { colors, scheme } = useNaroTheme();
  const { data: activeVehicle } = useActiveVehicle();
  const towEntry = useTowEntryRoute({
    vehicleId: activeVehicle?.id,
  });
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
  const sheetMaxHeight = Math.round(
    Math.min(height - 48, Math.max(360, height * 0.72)),
  );

  const goTo = (route: Href) => {
    router.replace(route);
  };

  const primaryActions = PRIMARY_ACTIONS.map((action) =>
    action.key === "cekici"
      ? { ...action, route: towEntry.route }
      : action,
  );

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
                <Text
                  variant="h2"
                  tone="inverse"
                  className="text-[19px] leading-[23px]"
                  style={{ color: glassTextColor }}
                >
                  Hızlı erişim
                </Text>
                <Text
                  variant="caption"
                  tone="subtle"
                  className="rounded-full border px-3 py-1 text-[11px]"
                  style={{
                    backgroundColor: withAlphaHex(glassTextColor, 0.12),
                    borderColor: glassBorderColor,
                    color: glassMutedTextColor,
                  }}
                >
                  4 işlem
                </Text>
              </View>

              <PrimaryActionsGrid
                actions={primaryActions}
                colors={colors}
                scheme={scheme}
                onSelect={goTo}
              />

              <View className="gap-2">
                <View className="gap-2">
                  {DISCOVERY_ITEMS.map((item) => (
                    <PressableCard
                      key={item.key}
                      variant="elevated"
                      radius="lg"
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      onPress={() => goTo(item.route)}
                      className="flex-row items-center gap-3 bg-app-surface px-4 py-3"
                      style={{
                        backgroundColor: withAlphaHex(
                          colors.infoSoft,
                          scheme === "dark" ? 0.64 : 0.98,
                        ),
                        borderColor: withAlphaHex(
                          colors.info,
                          scheme === "dark" ? 0.32 : 0.22,
                        ),
                      }}
                    >
                      <GlassIconBadge
                        icon={item.icon}
                        color={colors.info}
                        surfaceColor={colors.infoSoft}
                        size="sm"
                      />
                      <Text
                        variant="label"
                        tone="inverse"
                        className="flex-1 text-[13px]"
                      >
                        {item.label}
                      </Text>
                      <Text
                        variant="caption"
                        tone="subtle"
                        className="rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-0.5 text-[11px]"
                      >
                        {item.badge}
                      </Text>
                    </PressableCard>
                  ))}
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

function PrimaryActionsGrid({
  actions,
  colors,
  scheme,
  onSelect,
}: {
  actions: ActionTile[];
  colors: NaroThemePalette;
  scheme: ThemeScheme;
  onSelect: (route: Href) => void;
}) {
  const rows: ActionTile[][] = [];
  for (let i = 0; i < actions.length; i += 2) {
    rows.push(actions.slice(i, i + 2));
  }

  return (
    <View className="gap-3">
      {rows.map((row, idx) => (
        <View key={idx} className="flex-row gap-3">
          {row.map((action) => (
            <ActionTileCard
              key={action.key}
              action={action}
              colors={colors}
              scheme={scheme}
              onPress={() => onSelect(action.route)}
            />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

function ActionTileCard({
  action,
  colors,
  scheme,
  onPress,
}: {
  action: ActionTile;
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
      onPress={onPress}
      className="flex-1 bg-app-surface active:bg-app-surface-2"
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
        <GlassIconBadge
          icon={action.icon}
          color={tone.icon}
          surfaceColor={tone.surface}
        />
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

function getActionToneVisual(tone: ActionTone, colors: NaroThemePalette) {
  switch (tone) {
    case "success":
      return { icon: colors.success, surface: colors.successSoft };
    case "critical":
      return { icon: colors.critical, surface: colors.criticalSoft };
    case "warning":
      return { icon: colors.warning, surface: colors.warningSoft };
    case "info":
      return { icon: colors.info, surface: colors.infoSoft };
  }
}
