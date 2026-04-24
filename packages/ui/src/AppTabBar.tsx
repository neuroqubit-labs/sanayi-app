import type { ReactNode } from "react";
import { Pressable, Text as RNText, View, type ViewStyle } from "react-native";

import { useNaroTheme } from "./theme";

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

export function AppTabBar({
  items,
  centerAction,
  backgroundColor,
  bottomInset = 0,
  theme,
}: AppTabBarProps) {
  const { colors } = useNaroTheme();
  const defaultTheme: AppTabBarTheme = {
    shellBackground: colors.surface,
    shellBorder: colors.outline,
    shellHairline: colors.outlineStrong,
    shellShadow: colors.shadow,
    activeAccent: colors.info,
    activeText: colors.text,
    inactiveText: colors.textSubtle,
    activeChip: colors.infoSoft,
    centerButtonBackground: colors.info,
    centerButtonBorder: colors.outlineStrong,
    centerButtonHighlight: "rgba(255,255,255,0.18)",
    centerButtonDepth: "rgba(0,0,0,0.18)",
    centerButtonShadow: colors.shadow,
  };
  const palette = { ...defaultTheme, ...theme };
  const splitIndex = centerAction ? Math.ceil(items.length / 2) : items.length;
  const leftItems = items.slice(0, splitIndex);
  const rightItems = items.slice(splitIndex);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: backgroundColor ?? "transparent",
        paddingBottom: Math.max(bottomInset, 10),
        paddingTop: 8,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: palette.shellBackground,
          borderRadius: 36,
          borderWidth: 1,
          borderColor: palette.shellBorder,
          paddingHorizontal: 6,
          minHeight: 64,
          shadowColor: palette.shellShadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          elevation: 14,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            top: 0,
            height: 1,
            borderRadius: 999,
            backgroundColor: palette.shellHairline,
          }}
        />

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
              hitSlop={8}
              android_ripple={{
                color: palette.centerButtonHighlight,
                borderless: false,
                radius: 32,
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
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
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 1,
                  left: 1,
                  right: 1,
                  bottom: 1,
                  borderRadius: 17,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    left: 4,
                    right: 4,
                    top: 3,
                    height: 18,
                    borderRadius: 999,
                    backgroundColor: palette.centerButtonHighlight,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 22,
                    backgroundColor: palette.centerButtonDepth,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 17,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                  }}
                />
              </View>
              <View style={{ zIndex: 1 }}>{centerAction.icon}</View>
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
      hitSlop={{ bottom: 6, left: 4, right: 4, top: 6 }}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
      }}
    >
      <View style={{ alignItems: "center", gap: 6 }}>
        <View
          style={{
            height: 28,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.icon}
        </View>
        <RNText
          style={{
            color: item.selected ? theme.activeAccent : theme.inactiveText,
            fontSize: 11,
            fontWeight: item.selected ? "700" : "600",
            letterSpacing: 0,
          }}
        >
          {item.label}
        </RNText>
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
