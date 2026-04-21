import type { ServiceRequestKind } from "@naro/domain";

import type { TechnicianProfile } from "./types";

type TechnicianCaseEntryKind = Exclude<ServiceRequestKind, "towing">;

export type TechnicianCaseEntryOption = {
  kind: ServiceRequestKind;
  label: string;
  subtitle: string;
  recommended: boolean;
};

const CASE_ENTRY_META: Record<
  TechnicianCaseEntryKind,
  { label: string; subtitle: string }
> = {
  accident: {
    label: "Kaza Vakası",
    subtitle: "Hasar, sigorta ve ekspertiz işini bu akıştan başlat.",
  },
  breakdown: {
    label: "Arıza Vakası",
    subtitle: "Belirti, teşhis ve arıza detayını toplayarak ilerle.",
  },
  maintenance: {
    label: "Bakım Vakası",
    subtitle: "Planlı bakım, parça değişimi veya servis işini başlat.",
  },
};

const KIND_PRIORITY: TechnicianCaseEntryKind[] = [
  "maintenance",
  "breakdown",
  "accident",
];

const DEFAULT_SECONDARY_KIND: Record<
  TechnicianCaseEntryKind,
  TechnicianCaseEntryKind
> = {
  accident: "breakdown",
  breakdown: "maintenance",
  maintenance: "breakdown",
};

const KEYWORDS: Record<TechnicianCaseEntryKind, string[]> = {
  accident: ["hasar", "kaporta", "boya", "kasko", "sigorta", "ekspertiz"],
  maintenance: [
    "bakim",
    "periyodik",
    "yag",
    "filtre",
    "balata",
    "aku",
    "klima",
    "cam filmi",
    "ppf",
    "seramik",
    "detay",
    "yikama",
    "lastik",
    "balans",
    "jant",
  ],
  breakdown: [
    "motor",
    "elektrik",
    "obd",
    "sensor",
    "turbo",
    "sanziman",
    "mekanik",
    "sizinti",
  ],
};

const TIRE_KEYWORDS = ["lastik", "balans", "jant"];

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u");
}

function scoreKeywords(haystack: string, keywords: string[]) {
  return keywords.reduce(
    (score, keyword) => score + (haystack.includes(keyword) ? 2 : 0),
    0,
  );
}

export function getTechnicianCaseEntryOptions(
  profile: TechnicianProfile,
): TechnicianCaseEntryOption[] {
  const haystack = normalizeText(
    [
      profile.tagline,
      ...profile.categories,
      ...profile.specialties,
      ...profile.expertise,
    ].join(" "),
  );

  const scores: Record<TechnicianCaseEntryKind, number> = {
    accident: scoreKeywords(haystack, KEYWORDS.accident),
    maintenance: scoreKeywords(haystack, KEYWORDS.maintenance),
    breakdown: scoreKeywords(haystack, KEYWORDS.breakdown),
  };

  const hasTireFocus = TIRE_KEYWORDS.some((keyword) =>
    haystack.includes(keyword),
  );

  if (hasTireFocus) {
    scores.maintenance += 2;
    scores.breakdown = Math.max(scores.breakdown, 2);
  }

  let ranked = KIND_PRIORITY.filter((kind) => scores[kind] > 0).sort(
    (left, right) => scores[right] - scores[left],
  );

  if (ranked.length === 0) {
    ranked = ["breakdown", "maintenance"];
  } else if (ranked.length === 1) {
    const primaryKind = ranked[0] ?? "breakdown";
    ranked = [primaryKind, DEFAULT_SECONDARY_KIND[primaryKind]];
  }

  const visibleKinds = ranked.slice(0, 3);

  return visibleKinds.map((kind, index) => ({
    kind,
    label: CASE_ENTRY_META[kind].label,
    subtitle: CASE_ENTRY_META[kind].subtitle,
    recommended: index === 0,
  }));
}
