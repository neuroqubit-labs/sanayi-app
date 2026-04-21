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

import {
  SERVICE_TAB_META,
  SERVICE_TAB_ORDER,
  type ServiceTabRouteName,
} from "./tab-config";

const ACTIVE_ACCENT = "#ff6b2c";
const ACTIVE_TEXT = "#fff7f2";
const INACTIVE_TEXT = "#8a94aa";

const SERVICE_TAB_THEME = {
  shellBackground: "#0f1622",
  shellBorder: "rgba(255,255,255,0.08)",
  shellHairline: "rgba(255,255,255,0.12)",
  shellShadow: "#050910",
  activeAccent: ACTIVE_ACCENT,
  activeText: ACTIVE_TEXT,
  inactiveText: INACTIVE_TEXT,
  activeChip: "rgba(255,107,44,0.13)",
  centerButtonBackground: "#f45f25",
  centerButtonBorder: "rgba(255,183,145,0.24)",
  centerButtonHighlight: "rgba(255,255,255,0.16)",
  centerButtonDepth: "rgba(125,41,4,0.24)",
  centerButtonShadow: "#230901",
} as const;

export function ServiceTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisibility();

  if (keyboardVisible) {
    return null;
  }

  const items: AppTabBarItem[] = SERVICE_TAB_ORDER.flatMap((routeName) => {
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
        label: SERVICE_TAB_META[routeName].label,
        accessibilityLabel:
          descriptors[route.key]?.options.tabBarAccessibilityLabel ??
          SERVICE_TAB_META[routeName].accessibilityLabel,
        selected: focused,
        icon: (
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
      backgroundColor="#060915"
      bottomInset={Math.max(insets.bottom, 10)}
      theme={SERVICE_TAB_THEME}
      centerAction={{
        accessibilityLabel: "Hızlı aksiyonlar",
        icon: <Icon icon={Plus} size={22} color="#ffffff" strokeWidth={2.4} />,
        onPress: () => router.push("/(modal)/quick-actions"),
      }}
    />
  );
}

function iconForRoute(routeName: ServiceTabRouteName) {
  switch (routeName) {
    case "index":
      return Home;
    case "havuz":
      return Store;
    case "islerim":
      return ClipboardList;
    case "profil":
      return User;
  }
}
