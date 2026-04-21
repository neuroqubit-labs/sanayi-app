import {
  GlassSurface,
  Icon,
  PressableCard,
  shellMotion,
  shellRadius,
  Text,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowRight,
  Heart,
  Sparkles,
  Truck,
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

type ActionKey = "bakim" | "hasar" | "ariza" | "cekici";

type ActionTile = {
  key: ActionKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  route: Href;
  gradient: [string, string];
  iconColor: string;
};

const PRIMARY_ACTIONS: ActionTile[] = [
  {
    key: "bakim",
    label: "Bakım planla",
    hint: "Periyodik bakım, paket veya hatırlatıcı",
    icon: Heart,
    route: "/(modal)/talep/maintenance" as Href,
    gradient: ["rgba(45,210,141,0.18)", "rgba(45,210,141,0.05)"],
    iconColor: "#2dd28d",
  },
  {
    key: "hasar",
    label: "Hasar bildir",
    hint: "Kaza, darbe, cam veya kasko dosyası",
    icon: AlertTriangle,
    route: "/(modal)/talep/accident" as Href,
    gradient: ["rgba(255,107,107,0.18)", "rgba(255,107,107,0.05)"],
    iconColor: "#ff6b6b",
  },
  {
    key: "ariza",
    label: "Arıza bildir",
    hint: "Ses, titreşim, sızıntı veya uyarı ışığı",
    icon: Wrench,
    route: "/(modal)/talep/breakdown" as Href,
    gradient: ["rgba(245,179,63,0.18)", "rgba(245,179,63,0.05)"],
    iconColor: "#f5b33f",
  },
  {
    key: "cekici",
    label: "Çekici çağır",
    hint: "Anında veya randevulu kurtarma",
    icon: Truck,
    route: "/(modal)/talep/towing" as Href,
    gradient: ["rgba(14,165,233,0.18)", "rgba(14,165,233,0.05)"],
    iconColor: "#0ea5e9",
  },
];

const DISCOVERY_ITEMS: {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  route: Href;
}[] = [
  {
    key: "ustalar",
    label: "Ustaları keşfet",
    hint: "Çarşıda yakınındaki servisler ve puanlar",
    icon: Sparkles,
    route: "/(tabs)/carsi" as Href,
  },
];

export function QuickActionsScreen() {
  const router = useRouter();
  const { height } = Dimensions.get("window");
  const sheetMaxHeight = Math.round(height * 0.78);

  const goTo = (route: Href) => {
    router.replace(route);
  };

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
        entering={FadeInDown.springify().damping(18).mass(0.8)}
        exiting={FadeOutDown.duration(shellMotion.base)}
        style={{ maxHeight: sheetMaxHeight }}
      >
        <GlassSurface
          variant="chrome"
          className="border-t border-app-outline-strong"
          style={{
            borderTopLeftRadius: shellRadius.sheet,
            borderTopRightRadius: shellRadius.sheet,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
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
                  Ne yapmak istiyorsun?
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px]"
                >
                  En sık aksiyonlar tek dokunuşta açılır.
                </Text>
              </View>

              <PrimaryActionsGrid actions={PRIMARY_ACTIONS} onSelect={goTo} />

              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text variant="eyebrow" tone="subtle">
                    Keşfet
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-subtle text-[10px]"
                  >
                    İsteğe bağlı
                  </Text>
                </View>
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
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
                        <Icon icon={item.icon} size={16} color="#0ea5e9" />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text
                          variant="label"
                          tone="inverse"
                          className="text-[13px]"
                        >
                          {item.label}
                        </Text>
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-app-text-muted text-[11px]"
                        >
                          {item.hint}
                        </Text>
                      </View>
                      <Icon icon={ArrowRight} size={13} color="#83a7ff" />
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
  onSelect,
}: {
  actions: ActionTile[];
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
  onPress,
}: {
  action: ActionTile;
  onPress: () => void;
}) {
  return (
    <PressableCard
      variant="elevated"
      radius="lg"
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={onPress}
      className="flex-1 overflow-hidden"
    >
      <View
        className="gap-3 px-4 py-4"
        style={{ backgroundColor: action.gradient[0] }}
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${action.iconColor}26` }}
        >
          <Icon icon={action.icon} size={22} color={action.iconColor} />
        </View>
        <View className="gap-1">
          <Text
            variant="h3"
            tone="inverse"
            className="text-[15px] leading-[19px]"
          >
            {action.label}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px] leading-[15px]"
            numberOfLines={2}
          >
            {action.hint}
          </Text>
        </View>
      </View>
    </PressableCard>
  );
}
