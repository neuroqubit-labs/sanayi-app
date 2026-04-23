import type { ReactNode } from "react";
import { Pressable, Text as RNText, View, type ViewStyle } from "react-native";

export type AppTabBarItem = {
  key: string;
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  icon: ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
};

export type AppTabBarCenterAction = {
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
};

export type AppTabBarTheme = {
  shellBackground: string;
  shellBorder: string;
  shellHairline: string;
  shellShadow: string;
  activeAccent: string;
  activeText: string;
  inactiveText: string;
  activeChip: string;
  centerButtonBackground: string;
  centerButtonBorder: string;
  centerButtonHighlight: string;
  centerButtonDepth: string;
  centerButtonShadow: string;
};

export type AppTabBarProps = {
  items: AppTabBarItem[];
  centerAction?: AppTabBarCenterAction;
  backgroundColor?: string;
  bottomInset?: number;
  theme?: Partial<AppTabBarTheme>;
};

const DEFAULT_THEME: AppTabBarTheme = {
  shellBackground: "#0d1424",
  shellBorder: "rgba(255,255,255,0.08)",
  shellHairline: "rgba(255,255,255,0.12)",
  shellShadow: "#030917",
  activeAccent: "#42c4ff",
  activeText: "#f7fbff",
  inactiveText: "#7c89a4",
  activeChip: "rgba(66,196,255,0.12)",
  centerButtonBackground: "#149ae8",
  centerButtonBorder: "rgba(141,230,255,0.24)",
  centerButtonHighlight: "rgba(255,255,255,0.18)",
  centerButtonDepth: "rgba(3,72,123,0.28)",
  centerButtonShadow: "#021726",
};

export function AppTabBar({
  items,
  centerAction,
  backgroundColor = "#060915",
  bottomInset = 0,
  theme,
}: AppTabBarProps) {
  const palette = { ...DEFAULT_THEME, ...theme };
  const splitIndex = centerAction ? Math.ceil(items.length / 2) : items.length;
  const leftItems = items.slice(0, splitIndex);
  const rightItems = items.slice(splitIndex);

  return (
    <View
      style={{
        backgroundColor,
        paddingBottom: Math.max(bottomInset, 8),
        borderTopWidth: 1,
        borderTopColor: palette.shellBorder,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          backgroundColor: palette.shellHairline,
        }}
      />

      <View
        style={{
          minHeight: 72,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 4,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        {leftItems.map((item) => (
          <TabBarItem key={item.key} item={item} theme={palette} />
        ))}

        {centerAction ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={centerAction.accessibilityLabel}
              onPress={centerAction.onPress}
              android_ripple={{ color: palette.centerButtonHighlight, borderless: false, radius: 32 }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                borderWidth: 1,
                borderColor: palette.centerButtonBorder,
                backgroundColor: palette.centerButtonBackground,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: palette.centerButtonShadow,
                shadowOffset: CENTER_BUTTON_SHADOW.shadowOffset,
                shadowOpacity: CENTER_BUTTON_SHADOW.shadowOpacity,
                shadowRadius: CENTER_BUTTON_SHADOW.shadowRadius,
                elevation: CENTER_BUTTON_SHADOW.elevation,
              }}
            >
              {centerAction.icon}
            </Pressable>
          </View>
        ) : null}

        {rightItems.map((item) => (
          <TabBarItem key={item.key} item={item} theme={palette} />
        ))}
      </View>
    </View>
  );
}

type TabBarItemProps = {
  item: AppTabBarItem;
  theme: AppTabBarTheme;
};

function TabBarItem({ item, theme }: TabBarItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
      accessibilityState={{ selected: item.selected }}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
      }}
    >
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 40,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: item.selected ? theme.activeChip : "transparent",
          }}
        >
          {item.icon}
        </View>
        <RNText
          style={{
            marginTop: 4,
            color: item.selected ? theme.activeText : theme.inactiveText,
            fontSize: 11,
            fontWeight: item.selected ? "700" : "600",
            letterSpacing: 0.15,
          }}
        >
          {item.label}
        </RNText>
        <View
          style={{
            marginTop: 4,
            width: 16,
            height: 3,
            borderRadius: 999,
            backgroundColor: item.selected ? theme.activeAccent : "transparent",
          }}
        />
      </View>
    </Pressable>
  );
}

const CENTER_BUTTON_SHADOW: ViewStyle = {
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.35,
  shadowRadius: 14,
  elevation: 10,
};
