#!/usr/bin/env node
import { readFileSync } from "node:fs";
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
];

const FORBIDDEN_PATTERNS = [
  {
    label: "legacy jobs api import",
    pattern:
      /from\s+["'](?:\.\.\/api|\.\/api|@\/features\/jobs\/api)["']/g,
  },
  { label: "mock jobs store", pattern: /\buseJobsStore\b/g },
  { label: "mock delay", pattern: /\bmockDelay\b/g },
  { label: "fixture technician id", pattern: /\bPRIMARY_TECHNICIAN_ID\b/g },
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
