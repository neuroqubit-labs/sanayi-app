import { vars } from "nativewind";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useColorScheme, View } from "react-native";

import { OverlayProvider } from "./OverlayPortal";

export type ThemeScheme = "light" | "dark";

export type NaroThemePalette = {
  bg: string;
  bgMuted: string;
  surface: string;
  surface2: string;
  surface3: string;
  outline: string;
  outlineStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  critical: string;
  criticalSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  overlayStrong: string;
  shadow: string;
  statusBarStyle: "light" | "dark";
};

export type NaroTheme = {
  scheme: ThemeScheme;
  colors: NaroThemePalette;
};

type ThemeToken = Exclude<
  keyof NaroThemePalette,
  "overlay" | "overlayStrong" | "shadow" | "statusBarStyle"
>;

const THEME_VARIABLES: Record<ThemeToken, string> = {
  bg: "--app-bg",
  bgMuted: "--app-bg-muted",
  surface: "--app-surface",
  surface2: "--app-surface-2",
  surface3: "--app-surface-3",
  outline: "--app-outline",
  outlineStrong: "--app-outline-strong",
  text: "--app-text",
  textMuted: "--app-text-muted",
  textSubtle: "--app-text-subtle",
  success: "--app-success",
  successSoft: "--app-success-soft",
  warning: "--app-warning",
  warningSoft: "--app-warning-soft",
  critical: "--app-critical",
  criticalSoft: "--app-critical-soft",
  info: "--app-info",
  infoSoft: "--app-info-soft",
};

export const themePalettes: Record<ThemeScheme, NaroThemePalette> = {
  light: {
    bg: "#F7F9FC",
    bgMuted: "#EEF3F8",
    surface: "#FFFFFF",
    surface2: "#F6F8FC",
    surface3: "#EEF3FA",
    outline: "#D8E1EE",
    outlineStrong: "#B8C6DA",
    text: "#101828",
    textMuted: "#475467",
    textSubtle: "#667085",
    success: "#087443",
    successSoft: "#DDFBEA",
    warning: "#B7791F",
    warningSoft: "#FFF4D6",
    critical: "#C2413A",
    criticalSoft: "#FFE4E2",
    info: "#0EA5E9",
    infoSoft: "#E0F2FE",
    overlay: "rgba(16, 24, 40, 0.38)",
    overlayStrong: "rgba(16, 24, 40, 0.52)",
    shadow: "#98A2B3",
    statusBarStyle: "dark",
  },
  dark: {
    bg: "#060915",
    bgMuted: "#0D1324",
    surface: "#11182A",
    surface2: "#182138",
    surface3: "#223154",
    outline: "#26344F",
    outlineStrong: "#3A527D",
    text: "#F5F7FF",
    textMuted: "#ACB7D2",
    textSubtle: "#6F7B97",
    success: "#2DD28D",
    successSoft: "#143526",
    warning: "#F5B33F",
    warningSoft: "#3F2B0B",
    critical: "#FF6B6B",
    criticalSoft: "#441A20",
    info: "#38BDF8",
    infoSoft: "#082F49",
    overlay: "rgba(0, 0, 0, 0.58)",
    overlayStrong: "rgba(0, 0, 0, 0.68)",
    shadow: "#020817",
    statusBarStyle: "light",
  },
};

export const themeVars: Record<ThemeScheme, Record<string, string>> = {
  light: buildThemeVars(themePalettes.light),
  dark: buildThemeVars(themePalettes.dark),
};

const DEFAULT_THEME: NaroTheme = {
  scheme: "light",
  colors: themePalettes.light,
};

const NaroThemeContext = createContext<NaroTheme>(DEFAULT_THEME);

export type NaroThemeProviderProps = {
  children: ReactNode;
};

export function NaroThemeProvider({ children }: NaroThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme: ThemeScheme = systemScheme === "dark" ? "dark" : "light";
  const colors = themePalettes[scheme];

  const value = useMemo<NaroTheme>(
    () => ({ scheme, colors }),
    [colors, scheme],
  );
  const rootVars = useMemo(() => vars(themeVars[scheme]), [scheme]);

  return (
    <NaroThemeContext.Provider value={value}>
      <View
        className="flex-1 bg-app-bg"
        style={[{ backgroundColor: colors.bg }, rootVars]}
      >
        <OverlayProvider>{children}</OverlayProvider>
      </View>
    </NaroThemeContext.Provider>
  );
}

export function useNaroTheme() {
  return useContext(NaroThemeContext);
}

function buildThemeVars(palette: NaroThemePalette): Record<string, string> {
  return Object.entries(THEME_VARIABLES).reduce<Record<string, string>>(
    (acc, [token, variable]) => {
      const color = palette[token as ThemeToken];
      acc[variable] = color;
      acc[`${variable}-rgb`] = hexToRgbTriplet(color);
      return acc;
    },
    {},
  );
}

function hexToRgbTriplet(hex: string) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => `${value}${value}`)
          .join("")
      : normalized;

  const value = Number.parseInt(expanded, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `${red} ${green} ${blue}`;
}
