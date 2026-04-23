import {
  AppTabBar,
  Icon,
  type AppTabBarItem,
  useKeyboardVisibility,
} from "@naro/ui";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { ClipboardList, Home, Plus, Store, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useActiveVehicle } from "@/features/vehicles";

import {
  CUSTOMER_TAB_META,
  CUSTOMER_TAB_ORDER,
  type CustomerTabRouteName,
} from "./tab-config";
import { VehicleProfileTabVisual } from "./vehicle-tab";

const ACTIVE_ACCENT = "#42c4ff";
const ACTIVE_TEXT = "#f7fbff";
const INACTIVE_TEXT = "#7c89a4";

const CUSTOMER_TAB_THEME = {
  shellBackground: "rgba(13,20,36,0.82)",
  shellBorder: "rgba(255,255,255,0.10)",
  shellHairline: "rgba(255,255,255,0.14)",
  shellShadow: "#030917",
  activeAccent: ACTIVE_ACCENT,
  activeText: ACTIVE_TEXT,
  inactiveText: INACTIVE_TEXT,
  activeChip: "rgba(66,196,255,0.12)",
  centerButtonBackground: "#149ae8",
  centerButtonBorder: "rgba(141,230,255,0.24)",
  centerButtonHighlight: "rgba(255,255,255,0.18)",
  centerButtonDepth: "rgba(3,72,123,0.28)",
  centerButtonShadow: "#021726",
} as const;

export function CustomerTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisibility();
  const { data: activeVehicle } = useActiveVehicle();

  if (keyboardVisible) {
    return null;
  }

  const items: AppTabBarItem[] = CUSTOMER_TAB_ORDER.flatMap((routeName) => {
    const route = state.routes.find(
      (candidate) => candidate.name === routeName,
    ) as (typeof state.routes)[number] | undefined;

    if (!route) {
      return [];
    }

    const focused = state.routes[state.index]?.name === route.name;
    const iconColor = focused ? ACTIVE_ACCENT : INACTIVE_TEXT;

    return [
      {
        key: route.key,
        label: CUSTOMER_TAB_META[routeName].label,
        accessibilityLabel:
          descriptors[route.key]?.options.tabBarAccessibilityLabel ??
          CUSTOMER_TAB_META[routeName].accessibilityLabel,
        selected: focused,
        icon:
          routeName === "profil" ? (
            <VehicleProfileTabVisual
              vehicle={activeVehicle}
              focused={focused}
              fallback={<Icon icon={User} size={18} color={iconColor} />}
            />
          ) : (
            <Icon
              icon={iconForRoute(routeName)}
              size={18}
              color={iconColor}
              strokeWidth={2}
            />
          ),
        onPress: () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        },
        onLongPress: () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        },
      },
    ];
  });

  return (
    <AppTabBar
      items={items}
      bottomInset={Math.max(insets.bottom, 10)}
      theme={CUSTOMER_TAB_THEME}
      centerAction={{
        accessibilityLabel: "Hızlı aksiyonlar",
        icon: <Icon icon={Plus} size={22} color="#ffffff" strokeWidth={2.4} />,
        onPress: () => router.push("/(modal)/quick-actions"),
      }}
    />
  );
}

function iconForRoute(routeName: CustomerTabRouteName) {
  switch (routeName) {
    case "index":
      return Home;
    case "carsi":
      return Store;
    case "kayitlar":
      return ClipboardList;
    case "profil":
      return User;
  }
}
