import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OverlayPortal } from "./OverlayPortal";
import { useNaroTheme } from "./theme";

export type BottomSheetOverlayProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  dismissible?: boolean;
  keyboardAvoiding?: boolean;
  maxHeight?: DimensionValue;
  contentStyle?: StyleProp<ViewStyle>;
};

export function BottomSheetOverlay({
  visible,
  onClose,
  children,
  accessibilityLabel = "Kapat",
  dismissible = true,
  keyboardAvoiding = false,
  maxHeight = "92%",
  contentStyle,
}: BottomSheetOverlayProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useNaroTheme();

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose, visible]);

  if (!visible) {
    return null;
  }

  const sheet = (
    <View pointerEvents="box-none" style={styles.overlayRoot}>
      <Pressable
        accessibilityRole={dismissible ? "button" : undefined}
        accessibilityLabel={dismissible ? accessibilityLabel : undefined}
        onPress={dismissible ? onClose : undefined}
        style={[styles.backdrop, { backgroundColor: colors.overlayStrong }]}
      />
      <KeyboardAvoidingView
        pointerEvents="box-none"
        behavior={
          keyboardAvoiding && Platform.OS === "ios" ? "padding" : undefined
        }
        style={[
          styles.sheetAnchor,
          {
            paddingBottom: Math.max(insets.bottom, 10) + 8,
          },
        ]}
      >
        <View style={[{ maxHeight }, contentStyle]}>{children}</View>
      </KeyboardAvoidingView>
    </View>
  );

  return <OverlayPortal>{sheet}</OverlayPortal>;
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetAnchor: {
    bottom: 0,
    justifyContent: "flex-end",
    left: 0,
    paddingHorizontal: 10,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
