import {
  AppTabBar,
  Icon,
  createAppTabBarTheme,
  type AppTabBarItem,
  useNaroTheme,
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

export function ServiceTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisibility();
  const { colors, scheme } = useNaroTheme();
  const tabTheme = createAppTabBarTheme({
    brand: "service",
    colors,
    scheme,
  });
  const centerIconColor = scheme === "dark" ? colors.text : colors.surface;

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
    const iconColor = focused ? tabTheme.activeAccent : tabTheme.inactiveText;

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
      backgroundColor={colors.bg}
      bottomInset={Math.max(insets.bottom, 10)}
      theme={tabTheme}
      centerAction={{
        accessibilityLabel: "Hızlı aksiyonlar",
        icon: (
          <Icon
            icon={Plus}
            size={22}
            color={centerIconColor}
            strokeWidth={2.4}
          />
        ),
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
