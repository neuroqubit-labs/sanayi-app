import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";

type NavigationWithBeforeRemove = {
  addListener?: (
    event: "beforeRemove",
    handler: (event: {
      preventDefault: () => void;
      data: { action: unknown };
    }) => void,
  ) => () => void;
  dispatch?: (action: unknown) => void;
};

export type UseDraftGuardOptions = {
  /** When true, intercept back navigation. */
  enabled: boolean;
  /** Called when the user chooses to keep the draft alive. */
  onKeep?: () => void;
  /** Called when the user chooses to discard the draft. */
  onDiscard?: () => void;
  title?: string;
  message?: string;
};

export function useDraftGuard({
  enabled,
  onKeep,
  onDiscard,
  title = "Taslağı kaybetmek ister misin?",
  message = "Doldurduğun adımlar bu vaka için kayıtlı. Taslağı saklayıp daha sonra devam edebilir ya da tamamen silebilirsin.",
}: UseDraftGuardOptions) {
  const navigation = useNavigation() as unknown as NavigationWithBeforeRemove;

  useEffect(() => {
    if (!enabled || !navigation?.addListener || !navigation?.dispatch) {
      return;
    }

    const subscription = navigation.addListener("beforeRemove", (event) => {
      event.preventDefault();

      Alert.alert(title, message, [
        { text: "İptal", style: "cancel", onPress: () => {} },
        {
          text: "Taslağı sakla",
          onPress: () => {
            onKeep?.();
            navigation.dispatch?.(event.data.action);
          },
        },
        {
          text: "Sil ve çık",
          style: "destructive",
          onPress: () => {
            onDiscard?.();
            navigation.dispatch?.(event.data.action);
          },
        },
      ]);
    });

    return subscription;
  }, [enabled, navigation, title, message, onKeep, onDiscard]);
}
