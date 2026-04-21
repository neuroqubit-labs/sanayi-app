import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useKeyboardVisibility() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () =>
      setIsVisible(true),
    );
    const hideSubscription = Keyboard.addListener(hideEvent, () =>
      setIsVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isVisible;
}
