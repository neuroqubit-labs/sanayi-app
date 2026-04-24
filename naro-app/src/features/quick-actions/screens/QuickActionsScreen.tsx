import {
  GlassSurface,
  Icon,
  PressableCard,
  shellMotion,
  shellRadius,
  Text,
  useNaroTheme,
  type NaroThemePalette,
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
  const { height } = useWindowDimensions();
  const sheetMaxHeight = Math.round(
    Math.min(height - 48, Math.max(420, height * 0.78)),
  );

  const goTo = (route: Href) => {
    router.replace(route);
  };

  return (
    <View className="flex-1 justify-end">
      <Animated.View
        entering={FadeIn.duration(shellMotion.base)}
        exiting={FadeOut.duration(shellMotion.fast)}
        className="absolute inset-0"
        style={{ backgroundColor: colors.overlay }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          className="flex-1"
          onPress={() => router.back()}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.springify().damping(18).mass(0.8)}
        exiting={FadeOutDown.duration(shellMotion.base)}
        style={{ maxHeight: sheetMaxHeight }}
      >
        <GlassSurface
          variant="chrome"
          tint={scheme === "dark" ? "dark" : "light"}
          className="border-t border-app-outline-strong"
          style={{
            borderTopLeftRadius: shellRadius.sheet,
            borderTopRightRadius: shellRadius.sheet,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            backgroundColor: colors.surface,
          }}
        >
          <SafeAreaView edges={["bottom"]}>
            <View className="items-center pt-3">
              <View className="h-1 w-12 rounded-full bg-app-outline-strong" />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 18,
                paddingBottom: 22,
                gap: 16,
              }}
            >
              <View className="flex-row items-center justify-between gap-3">
                <Text
                  variant="h2"
                  tone="inverse"
                  className="text-[20px] leading-[24px]"
                >
                  Hızlı erişim
                </Text>
                <Text
                  variant="caption"
                  tone="subtle"
                  className="rounded-full border border-app-outline bg-app-surface-2 px-3 py-1 text-[11px]"
                >
                  4 işlem
                </Text>
              </View>

              <PrimaryActionsGrid
                actions={PRIMARY_ACTIONS}
                colors={colors}
                onSelect={goTo}
              />

              <View className="gap-2">
                <View className="gap-2">
                  {DISCOVERY_ITEMS.map((item) => (
                    <PressableCard
                      key={item.key}
                      variant="flat"
                      radius="lg"
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      onPress={() => goTo(item.route)}
                      className="flex-row items-center gap-3 px-4 py-3.5"
                    >
                      <View
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.infoSoft }}
                      >
                        <Icon icon={item.icon} size={16} color={colors.info} />
                      </View>
                      <Text
                        variant="label"
                        tone="inverse"
                        className="flex-1 text-[14px]"
                      >
                        {item.label}
                      </Text>
                      <Text
                        variant="caption"
                        tone="subtle"
                        className="rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1 text-[11px]"
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
  onSelect,
}: {
  actions: ActionTile[];
  colors: NaroThemePalette;
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
  onPress,
}: {
  action: ActionTile;
  colors: NaroThemePalette;
  onPress: () => void;
}) {
  const tone = getActionToneVisual(action.tone, colors);

  return (
    <PressableCard
      variant="flat"
      radius="lg"
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={onPress}
      className="flex-1 bg-app-surface active:bg-app-surface-2"
    >
      <View className="min-h-[106px] justify-between gap-3 px-4 py-4">
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: tone.surface }}
        >
          <Icon icon={action.icon} size={20} color={tone.icon} />
        </View>
        <Text
          variant="label"
          tone="inverse"
          className="text-[15px] leading-[19px]"
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
