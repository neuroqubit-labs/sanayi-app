import type { ViewStyle } from "react-native";

export const shellMotion = {
  fast: 160,
  base: 220,
  slow: 320,
} as const;

export const shellRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  sheet: 34,
  panel: 24,
  hero: 28,
  pill: 999,
} as const;

export type ShellRadiusKey = keyof typeof shellRadius;

type ElevationPreset = Pick<
  ViewStyle,
  | "shadowColor"
  | "shadowOffset"
  | "shadowOpacity"
  | "shadowRadius"
  | "elevation"
>;

export const shellElevation: Record<"low" | "medium" | "high", ElevationPreset> = {
  low: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  high: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 14,
  },
};

export type ShellElevationKey = keyof typeof shellElevation;

type MaterialPreset = {
  intensity: number;
  tint: "light" | "dark" | "default";
  fallbackBg: string;
};

export const shellMaterial: Record<"chrome" | "ultraThin" | "thin", MaterialPreset> = {
  chrome: { intensity: 70, tint: "dark", fallbackBg: "rgba(18, 20, 26, 0.88)" },
  ultraThin: { intensity: 40, tint: "dark", fallbackBg: "rgba(18, 20, 26, 0.64)" },
  thin: { intensity: 55, tint: "dark", fallbackBg: "rgba(18, 20, 26, 0.78)" },
};

export type ShellMaterialKey = keyof typeof shellMaterial;

type SpringPreset = {
  damping: number;
  stiffness: number;
  mass: number;
};

export const shellSpring: Record<"snappy" | "bouncy" | "smooth", SpringPreset> = {
  snappy: { damping: 22, stiffness: 260, mass: 0.7 },
  bouncy: { damping: 14, stiffness: 180, mass: 0.8 },
  smooth: { damping: 26, stiffness: 150, mass: 1 },
};

export type ShellSpringKey = keyof typeof shellSpring;
