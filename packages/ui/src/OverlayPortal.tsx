import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

type OverlayEntry = {
  key: string;
  node: ReactNode;
};

type OverlayPortalApi = {
  mount: (key: string, node: ReactNode) => void;
  update: (key: string, node: ReactNode) => void;
  unmount: (key: string) => void;
};

const OverlayPortalContext = createContext<OverlayPortalApi | null>(null);

let nextOverlayId = 0;

export type OverlayProviderProps = {
  children: ReactNode;
};

export function OverlayProvider({ children }: OverlayProviderProps) {
  const [entries, setEntries] = useState<OverlayEntry[]>([]);

  const mount = useCallback((key: string, node: ReactNode) => {
    setEntries((current) => {
      if (current.some((entry) => entry.key === key)) {
        return current.map((entry) =>
          entry.key === key ? { key, node } : entry,
        );
      }
      return [...current, { key, node }];
    });
  }, []);

  const update = useCallback((key: string, node: ReactNode) => {
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { key, node } : entry)),
    );
  }, []);

  const unmount = useCallback((key: string) => {
    setEntries((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const api = useMemo(
    () => ({ mount, update, unmount }),
    [mount, update, unmount],
  );

  return (
    <OverlayPortalContext.Provider value={api}>
      <View className="flex-1">
        {children}
        <View pointerEvents="box-none" style={styles.host}>
          {entries.map((entry) => (
            <View key={entry.key} pointerEvents="box-none" style={styles.entry}>
              {entry.node}
            </View>
          ))}
        </View>
      </View>
    </OverlayPortalContext.Provider>
  );
}

export type OverlayPortalProps = {
  children: ReactNode;
};

export function OverlayPortal({ children }: OverlayPortalProps) {
  const api = useContext(OverlayPortalContext);
  const keyRef = useRef<string | null>(null);

  if (keyRef.current === null) {
    keyRef.current = `naro-overlay-${nextOverlayId++}`;
  }

  useEffect(() => {
    if (!api || !keyRef.current) return undefined;
    const key = keyRef.current;
    api.mount(key, null);
    return () => api.unmount(key);
  }, [api]);

  useEffect(() => {
    if (!api || !keyRef.current) return;
    api.update(keyRef.current, children);
  }, [api, children]);

  if (!api) {
    return <>{children}</>;
  }

  return null;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    elevation: 1000,
    zIndex: 1000,
  },
  entry: {
    ...StyleSheet.absoluteFillObject,
  },
});
