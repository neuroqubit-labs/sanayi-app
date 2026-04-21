import type { BreakdownCategory } from "@naro/domain";
import { useQuery } from "@tanstack/react-query";

import { useActiveCase } from "@/features/cases";
import { useActiveVehicle } from "@/features/vehicles";

import { mockTechnicianProfiles } from "./data/fixtures";
import type { TechnicianProfile, UstalarCategory } from "./types";

export type UstalarFeedItem =
  | { kind: "section_label"; id: string; label: string; hint?: string }
  | {
      kind: "profile";
      id: string;
      profile: TechnicianProfile;
      section: "case_match" | "maintenance" | "personal" | "discover";
      reason: string;
    };

type UstalarFeedInput = {
  category?: UstalarCategory | null;
  query?: string;
};

type RelatedCase = {
  breakdownCategory: BreakdownCategory | null;
  kind: "accident" | "breakdown" | "maintenance" | "towing" | null;
};

type MaintenanceSignal = {
  hasReminder: boolean;
  reminderLabel: string | null;
};

const MAINTENANCE_KEYWORDS = [
  "Yağ",
  "Filtre",
  "Balata",
  "Periyodik",
  "Bakım",
  "Triger",
];

function profilesForMaintenance(
  filtered: TechnicianProfile[],
): TechnicianProfile[] {
  return filtered
    .filter(
      (profile) =>
        profile.expertise.some((entry) =>
          MAINTENANCE_KEYWORDS.some((kw) =>
            entry.toLowerCase().includes(kw.toLowerCase()),
          ),
        ) ||
        profile.specialties.some((entry) =>
          MAINTENANCE_KEYWORDS.some((kw) =>
            entry.toLowerCase().includes(kw.toLowerCase()),
          ),
        ) ||
        profile.categories.includes("servis") ||
        profile.categories.includes("usta"),
    )
    .sort((left, right) => composeScore(right) - composeScore(left))
    .slice(0, 3);
}

function includesQuery(haystacks: string[], query: string): boolean {
  const needle = query.toLowerCase().trim();
  if (!needle) return true;
  return haystacks.some((entry) => entry.toLowerCase().includes(needle));
}

function matchesCategory(
  profile: TechnicianProfile,
  category: UstalarCategory | null | undefined,
): boolean {
  if (!category) return true;
  return profile.categories.includes(category);
}

function matchesQuery(profile: TechnicianProfile, query: string): boolean {
  if (!query.trim()) return true;
  return includesQuery(
    [
      profile.name,
      profile.tagline,
      profile.summary,
      profile.reason,
      ...profile.specialties,
      ...profile.expertise,
      ...profile.categories,
    ],
    query,
  );
}

function composeScore(profile: TechnicianProfile): number {
  // Rating weight + yakınlık + hızlı yanıt
  return (
    profile.rating * 20 -
    Math.min(profile.distanceKm, 20) -
    Math.min(profile.responseMinutes, 15) * 0.5
  );
}

function profilesForCaseMatch(
  related: RelatedCase,
  filtered: TechnicianProfile[],
): TechnicianProfile[] {
  if (!related.kind || !filtered.length) return [];

  // Kaza vakası → kaportacı + kasko uzmanı ön sırada
  if (related.kind === "accident") {
    return filtered
      .filter((profile) =>
        profile.categories.includes("hasar"),
      )
      .sort((left, right) => composeScore(right) - composeScore(left));
  }

  // Arıza vakası → kategori-bazlı öneri
  if (related.kind === "breakdown" && related.breakdownCategory) {
    const category = related.breakdownCategory;
    const categoryMap: Partial<Record<BreakdownCategory, string[]>> = {
      tire: ["Lastik", "Balans", "Jant"],
      electric: ["Elektrik", "Sensör", "OBD", "Akü", "Check engine"],
      engine: ["Motor", "Turbo", "Revizyon"],
      mechanic: ["Fren", "Süspansiyon", "Direksiyon"],
      transmission: ["Şanzıman", "Diferansiyel"],
      climate: ["Klima"],
      fluid: ["Motor", "Yağ"],
      other: [],
    };
    const keywords = categoryMap[category] ?? [];
    return filtered
      .filter((profile) =>
        profile.expertise.some((entry) =>
          keywords.some((kw) =>
            entry.toLowerCase().includes(kw.toLowerCase()),
          ),
        ) ||
        profile.specialties.some((entry) =>
          keywords.some((kw) =>
            entry.toLowerCase().includes(kw.toLowerCase()),
          ),
        ),
      )
      .sort((left, right) => composeScore(right) - composeScore(left));
  }

  return [];
}

function buildFeed(
  input: UstalarFeedInput,
  related: RelatedCase,
  maintenance: MaintenanceSignal,
): UstalarFeedItem[] {
  const query = input.query ?? "";
  const category = input.category ?? null;

  const filtered = mockTechnicianProfiles.filter(
    (profile) => matchesCategory(profile, category) && matchesQuery(profile, query),
  );

  if (filtered.length === 0) {
    return [];
  }

  const caseMatched = profilesForCaseMatch(related, filtered);
  const caseMatchedIds = new Set(caseMatched.map((profile) => profile.id));

  const maintenanceCandidates =
    !related.kind && maintenance.hasReminder
      ? profilesForMaintenance(
          filtered.filter((profile) => !caseMatchedIds.has(profile.id)),
        )
      : [];
  const maintenanceIds = new Set(
    maintenanceCandidates.map((profile) => profile.id),
  );

  const personal = filtered
    .filter(
      (profile) =>
        !caseMatchedIds.has(profile.id) && !maintenanceIds.has(profile.id),
    )
    .sort((left, right) => composeScore(right) - composeScore(left))
    .slice(0, 3);
  const personalIds = new Set(personal.map((profile) => profile.id));

  const discover = filtered.filter(
    (profile) =>
      !caseMatchedIds.has(profile.id) &&
      !maintenanceIds.has(profile.id) &&
      !personalIds.has(profile.id),
  );

  const items: UstalarFeedItem[] = [];

  if (caseMatched.length) {
    items.push({
      kind: "section_label",
      id: "section-case-match",
      label: "Vakan için seçilenler",
      hint: "Açık vakana göre ilk sırada önerilenler.",
    });
    for (const profile of caseMatched) {
      items.push({
        kind: "profile",
        id: `profile-case-${profile.id}`,
        profile,
        section: "case_match",
        reason: profile.reason,
      });
    }
  }

  if (maintenanceCandidates.length) {
    items.push({
      kind: "section_label",
      id: "section-maintenance",
      label: "Bakım zamanın yaklaşıyor",
      hint:
        maintenance.reminderLabel ??
        "Aracın bakım takviminde sırada olan iş için önerilenler.",
    });
    for (const profile of maintenanceCandidates) {
      items.push({
        kind: "profile",
        id: `profile-maint-${profile.id}`,
        profile,
        section: "maintenance",
        reason: "Bakım için uygun",
      });
    }
  }

  if (personal.length) {
    // §2 revizyon: "Sana özel" eyebrow + in-card badge duplicate'i kaldırıldı.
    // Profiller doğal akışta devam eder; kart içi rozetler (Doğrulandı, Pickup,
    // marka vb.) kategorilemeyi zaten taşıyor.
    for (const profile of personal) {
      items.push({
        kind: "profile",
        id: `profile-personal-${profile.id}`,
        profile,
        section: "personal",
        reason: `${profile.rating.toFixed(1)}★ · ${profile.distanceKm.toFixed(1)} km · ${profile.responseMinutes} dk yanıt`,
      });
    }
  }

  if (discover.length) {
    items.push({
      kind: "section_label",
      id: "section-discover",
      label: "Keşfet",
      hint: "Sanayide gezinti — belki bugün lazım olmaz ama gündemde kalır.",
    });
    for (const profile of discover) {
      items.push({
        kind: "profile",
        id: `profile-discover-${profile.id}`,
        profile,
        section: "discover",
        reason: profile.tagline,
      });
    }
  }

  return items;
}

export function useUstalarFeed(input: UstalarFeedInput = {}) {
  const { data: activeCase } = useActiveCase();
  const { data: activeVehicle } = useActiveVehicle();
  const related: RelatedCase = {
    breakdownCategory: activeCase?.request?.breakdown_category ?? null,
    kind: activeCase?.request?.kind ?? null,
  };
  const firstReminder = activeVehicle?.maintenanceReminders?.[0];
  const maintenance: MaintenanceSignal = {
    hasReminder: Boolean(firstReminder),
    reminderLabel: firstReminder
      ? `${firstReminder.title} — ${firstReminder.dueLabel}`
      : null,
  };
  const query = input.query?.trim() ?? "";
  const category = input.category ?? null;

  return useQuery<UstalarFeedItem[]>({
    queryKey: [
      "ustalar",
      "feed",
      query.toLowerCase(),
      category,
      related.kind,
      related.breakdownCategory,
      maintenance.hasReminder,
    ],
    queryFn: () => buildFeed({ query, category }, related, maintenance),
    initialData: () => buildFeed({ query, category }, related, maintenance),
  });
}
