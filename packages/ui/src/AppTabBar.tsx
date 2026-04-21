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
  maxWidth?: number;
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
  maxWidth = 560,
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
        paddingTop: 8,
        paddingBottom: Math.max(bottomInset, 10),
        paddingHorizontal: 12,
      }}
    >
      <View style={{ width: "100%", maxWidth, alignSelf: "center" }}>
        <View
          style={[
            SHELL_SHADOW,
            {
              backgroundColor: palette.shellBackground,
              borderColor: palette.shellBorder,
              borderRadius: 30,
              shadowColor: palette.shellShadow,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 18,
              right: 18,
              top: 0,
              height: 1,
              backgroundColor: palette.shellHairline,
            }}
          />

          <View
            style={{
              minHeight: 84,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 6,
              paddingVertical: 10,
            }}
          >
            {leftItems.map((item) => (
              <TabBarItem key={item.key} item={item} theme={palette} />
            ))}

            {centerAction ? (
              <View
                style={{
                  width: 74,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={centerAction.accessibilityLabel}
                  onPress={centerAction.onPress}
                  style={({ pressed }) => [
                    CENTER_BUTTON_SHADOW,
                    {
                      width: 58,
                      height: 58,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: palette.centerButtonBorder,
                      backgroundColor: palette.centerButtonBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ translateY: pressed ? 1 : 0 }],
                      shadowColor: palette.centerButtonShadow,
                    },
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      inset: 1,
                      borderRadius: 19,
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: 6,
                        right: 6,
                        top: 4,
                        height: 16,
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
                        height: 20,
                        borderBottomLeftRadius: 19,
                        borderBottomRightRadius: 19,
                        backgroundColor: palette.centerButtonDepth,
                      }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 19,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                      }}
                    />
                  </View>
                  <View style={{ position: "relative", zIndex: 1 }}>
                    {centerAction.icon}
                  </View>
                </Pressable>
              </View>
            ) : null}

            {rightItems.map((item) => (
              <TabBarItem key={item.key} item={item} theme={palette} />
            ))}
          </View>
        </View>
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
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.86 : 1,
        transform: [{ translateY: pressed ? 1 : 0 }],
      })}
    >
      <View style={{ alignItems: "center", minWidth: 48 }}>
        <View
          style={{
            minWidth: 40,
            height: 32,
            paddingHorizontal: 10,
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
            marginTop: 6,
            width: 14,
            height: 3,
            borderRadius: 999,
            backgroundColor: item.selected ? theme.activeAccent : "transparent",
          }}
        />
      </View>
    </Pressable>
  );
}

const SHELL_SHADOW: ViewStyle = {
  borderWidth: 1,
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.32,
  shadowRadius: 20,
  elevation: 14,
};

const CENTER_BUTTON_SHADOW: ViewStyle = {
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.28,
  shadowRadius: 18,
  elevation: 12,
};
