import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";

let initialized = false;

type WebNavigatorLike = {
  onLine?: boolean;
};

type WebWindowLike = {
  navigator?: WebNavigatorLike;
  addEventListener?: (type: "online" | "offline", listener: () => void) => void;
  removeEventListener?: (type: "online" | "offline", listener: () => void) => void;
};

type WebDocumentLike = {
  visibilityState?: string;
  addEventListener?: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener?: (type: "visibilitychange", listener: () => void) => void;
};

function getWebNavigator(): WebNavigatorLike | undefined {
  return (globalThis as typeof globalThis & { navigator?: WebNavigatorLike }).navigator;
}

function getWebWindow(): WebWindowLike | undefined {
  return (globalThis as typeof globalThis & { window?: WebWindowLike }).window;
}

function getWebDocument(): WebDocumentLike | undefined {
  return (globalThis as typeof globalThis & { document?: WebDocumentLike }).document;
}

export function getIsOnline(): boolean | undefined {
  const webNavigator = getWebNavigator();
  if (Platform.OS === "web" && typeof webNavigator?.onLine === "boolean") {
    return webNavigator.onLine;
  }

  return undefined;
}

export function initializeNetworkManagers() {
  if (initialized) {
    return;
  }

  initialized = true;

  onlineManager.setEventListener((setOnline) => {
    const webWindow = getWebWindow();
    if (Platform.OS === "web" && webWindow?.addEventListener && webWindow?.navigator) {
      const updateOnlineStatus = () => setOnline(Boolean(webWindow.navigator?.onLine));

      webWindow.addEventListener("online", updateOnlineStatus);
      webWindow.addEventListener("offline", updateOnlineStatus);
      updateOnlineStatus();

      return () => {
        webWindow.removeEventListener?.("online", updateOnlineStatus);
        webWindow.removeEventListener?.("offline", updateOnlineStatus);
      };
    }

    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && (state.isInternetReachable ?? true)));
    });
  });

  const webDocument = getWebDocument();
  if (Platform.OS === "web" && webDocument?.addEventListener) {
    const onVisibilityChange = () => {
      focusManager.setFocused(webDocument.visibilityState === "visible");
    };

    webDocument.addEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange();

    return () => {
      webDocument.removeEventListener?.("visibilitychange", onVisibilityChange);
    };
  }

  const subscription = AppState.addEventListener("change", (state) => {
    focusManager.setFocused(state === "active");
  });

  focusManager.setFocused(AppState.currentState === "active");

  return () => {
    subscription.remove();
  };
}
