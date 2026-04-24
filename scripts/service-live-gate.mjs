#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const ACTIVE_SERVICE_FILES = [
  "naro-service-app/src/features/jobs/screens/JobsScreen.tsx",
  "naro-service-app/src/features/jobs/screens/JobDetailScreen.tsx",
  "naro-service-app/src/features/jobs/screens/JobTaskScreen.tsx",
  "naro-service-app/src/features/jobs/screens/JobThreadScreen.tsx",
  "naro-service-app/src/features/jobs/screens/JobDocumentsScreen.tsx",
  "naro-service-app/src/features/jobs/screens/JobOfferScreen.tsx",
  "naro-service-app/src/features/jobs/screens/JobInsuranceScreen.tsx",
  "naro-service-app/src/features/jobs/useJobEvidenceUploader.ts",
  "naro-service-app/src/features/cases/screens/CaseProfileScreen.tsx",
  "naro-service-app/src/features/home/api.ts",
  "naro-service-app/src/features/home/screens/HomeScreen.tsx",
  "naro-service-app/src/features/home/components/HomeHeroCard.tsx",
  "naro-service-app/src/features/home/components/ActiveJobsCountCard.tsx",
  "naro-service-app/src/features/home/components/ActiveTowJobHero.tsx",
  "naro-service-app/src/features/home/components/AvailabilityToggleCard.tsx",
  "naro-service-app/src/features/home/components/DamagePoolCard.tsx",
  "naro-service-app/src/features/search/screens/SearchScreen.tsx",
  "naro-service-app/src/features/appointments/screens/AppointmentRequestDetailScreen.tsx",
  "naro-service-app/src/features/insurance-claim/components/HasarSourceSheet.tsx",
  "naro-service-app/src/features/insurance-claim/screens/InsuranceClaimComposerScreen.tsx",
  "naro-service-app/src/features/tow/api.ts",
  "naro-service-app/src/features/tow/index.ts",
  "naro-service-app/src/features/tow/useDispatchTakeover.ts",
  "naro-service-app/src/features/tow/components/TowCapabilityCard.tsx",
  "naro-service-app/src/features/tow/hooks/useTechTowBroadcaster.ts",
  "naro-service-app/src/features/tow/screens/TowDispatchSheet.tsx",
  "naro-service-app/src/features/tow/screens/TowActiveJobScreenLive.tsx",
  "naro-service-app/app/(modal)/cekici-dispatch.tsx",
  "naro-service-app/app/cekici/[id].tsx",
];

const FORBIDDEN_PATTERNS = [
  {
    label: "legacy jobs api import",
    pattern:
      /from\s+["'](?:@\/features\/jobs\/api(?:\.mock)?|@\/features\/jobs\/store(?:\.mock)?)["']/g,
  },
  {
    label: "direct case-live import outside facade",
    pattern: /api\.case-live/g,
  },
  { label: "mock jobs store", pattern: /\buseJobsStore\b/g },
  { label: "mock tow store", pattern: /\buseTowServiceStore\b/g },
  { label: "mock tow dispatch simulator", pattern: /\bsimulateIncomingDispatch\b/g },
  { label: "mock delay", pattern: /\bmockDelay\b/g },
  { label: "fixture technician id", pattern: /\bPRIMARY_TECHNICIAN_ID\b/g },
];

const JOBS_RELATIVE_FORBIDDEN_PATTERNS = [
  {
    label: "relative legacy jobs api import",
    pattern: /from\s+["'](?:\.\.\/api|\.\/api)["']/g,
  },
];

const failures = [];

for (const file of ACTIVE_SERVICE_FILES) {
  const source = readFileSync(path.join(ROOT, file), "utf8");
  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    const matches = source.match(pattern) ?? [];
    if (matches.length > 0) {
      failures.push(`${file}: ${matches.length} ${label} match(es)`);
    }
  }
  if (file.includes("naro-service-app/src/features/jobs/")) {
    for (const { label, pattern } of JOBS_RELATIVE_FORBIDDEN_PATTERNS) {
      const matches = source.match(pattern) ?? [];
      if (matches.length > 0) {
        failures.push(`${file}: ${matches.length} ${label} match(es)`);
      }
    }
  }
}

const TOW_ROUTE_DIR = path.join(ROOT, "naro-backend/app/api/v1/routes/tow");
for (const entry of readdirSync(TOW_ROUTE_DIR)) {
  if (!entry.endsWith(".py")) continue;
  const file = path.join(TOW_ROUTE_DIR, entry);
  const stat = statSync(file);
  if (!stat.isFile()) continue;
  const lineCount = readFileSync(file, "utf8").split("\n").length;
  if (lineCount > 350) {
    failures.push(
      `naro-backend/app/api/v1/routes/tow/${entry}: ${lineCount} lines exceeds 350 line route module limit`,
    );
  }
}

if (failures.length > 0) {
  console.error("Service live gate failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Service live gate passed (${ACTIVE_SERVICE_FILES.length} active files).`,
);
