#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SOURCE_ROOTS = [
  "naro-app/src/",
  "naro-service-app/src/",
  "packages/ui/src/",
  "packages/config/",
];

const STRICT_FILES = new Set([
  "naro-app/src/features/ustalar/screens/UstalarScreen.tsx",
  "naro-service-app/src/features/jobs/screens/JobsScreen.tsx",
  "naro-service-app/src/features/pool/components/PoolReelsCardLive.tsx",
  "naro-service-app/src/features/pool/screens/PoolScreen.tsx",
  "packages/ui/src/ActionRow.tsx",
  "packages/ui/src/FieldInput.tsx",
  "packages/ui/src/FilterPillButton.tsx",
  "packages/ui/src/FilterRail.tsx",
  "packages/ui/src/Input.tsx",
  "packages/ui/src/ReelsFeed.tsx",
  "packages/ui/src/SearchFilterHeader.tsx",
  "packages/ui/src/SearchPillInput.tsx",
  "packages/ui/src/SectionHeader.tsx",
  "packages/ui/src/SelectableTile.tsx",
  "packages/ui/src/StatusChip.tsx",
  "packages/ui/src/Text.tsx",
  "packages/ui/src/ToggleChip.tsx",
  "packages/ui/src/tone.ts",
]);

const HARDCODED_COLOR_ALLOWLIST = new Set([
  "packages/ui/src/theme.tsx",
  "packages/ui/src/tokens.ts",
  "packages/ui/src/map/tokens.ts",
]);

const rawFiles = execFileSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ...SOURCE_ROOTS,
  ],
  {
    cwd: ROOT,
    encoding: "utf8",
  },
)
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => /\.(tsx?|jsx?)$/.test(file));

const patterns = {
  arbitraryMeasure:
    /\b(?:h|w|min-h|min-w|max-h|max-w|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|rounded|text|leading|top|right|bottom|left|inset|basis)-\[[^\]]+\]/g,
  hardcodedColor: /(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g,
  rawDimensions: /\bDimensions\.get\s*\(/g,
  rawModal: /(?:<Modal\b|\bModal\b.*from\s+["']react-native["'])/g,
  rawTextInput: /(?:<TextInput\b|\bTextInput\b.*from\s+["']react-native["'])/g,
};

const totals = Object.fromEntries(
  Object.keys(patterns).map((key) => [key, { count: 0, files: new Map() }]),
);
const failures = [];

for (const file of rawFiles) {
  const source = readFileSync(path.join(ROOT, file), "utf8");

  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = source.match(pattern) ?? [];
    if (!matches.length) continue;
    totals[key].count += matches.length;
    totals[key].files.set(file, matches.length);
  }

  if (!STRICT_FILES.has(file)) continue;

  const hardcodedColorCount = HARDCODED_COLOR_ALLOWLIST.has(file)
    ? 0
    : (source.match(patterns.hardcodedColor) ?? []).length;
  if (hardcodedColorCount > 0) {
    failures.push(
      `${file}: ${hardcodedColorCount} hardcoded color match(es). Use theme tokens/useNaroTheme.`,
    );
  }

  const rawModalCount = (source.match(patterns.rawModal) ?? []).length;
  if (rawModalCount > 0 && file !== "packages/ui/src/BottomSheetOverlay.tsx") {
    failures.push(
      `${file}: raw Modal detected. Use BottomSheetOverlay/OverlayPortal.`,
    );
  }

  const isAppFile =
    file.startsWith("naro-app/src/") ||
    file.startsWith("naro-service-app/src/");
  if (isAppFile) {
    const rawTextInputCount = (source.match(patterns.rawTextInput) ?? [])
      .length;
    if (rawTextInputCount > 0) {
      failures.push(
        `${file}: raw TextInput detected. Use SearchPillInput/FieldInput/Input.`,
      );
    }

    const rawDimensionsCount = (source.match(patterns.rawDimensions) ?? [])
      .length;
    if (rawDimensionsCount > 0) {
      failures.push(
        `${file}: Dimensions.get detected. Use useWindowDimensions/safe-area aware primitives.`,
      );
    }
  }
}

function topFiles(metric, limit = 6) {
  return [...totals[metric].files.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, count]) => `  - ${file}: ${count}`)
    .join("\n");
}

console.log("UI audit report");
console.log(`- Files scanned: ${rawFiles.length}`);
console.log(`- Hardcoded colors (#/rgb/rgba): ${totals.hardcodedColor.count}`);
console.log(`- Arbitrary measure classes: ${totals.arbitraryMeasure.count}`);
console.log(`- Raw Modal matches: ${totals.rawModal.count}`);
console.log(`- Raw TextInput matches: ${totals.rawTextInput.count}`);
console.log(`- Dimensions.get matches: ${totals.rawDimensions.count}`);

for (const metric of ["hardcodedColor", "arbitraryMeasure", "rawTextInput"]) {
  const top = topFiles(metric);
  if (top) {
    console.log(`\nTop ${metric} files:\n${top}`);
  }
}

if (failures.length > 0) {
  console.error("\nUI audit failed for strict-scope files:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nUI audit passed for strict-scope files.");
