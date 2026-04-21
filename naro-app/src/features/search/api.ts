import { useQuery } from "@tanstack/react-query";

import {
  CASE_CAMPAIGNS,
  CASE_NEARBY_SERVICES,
} from "@/features/cases/data/fixtures";
import { TIPS_POOL } from "@/features/home/feed";
import type { CampaignOffer, NearbyService } from "@/features/home/types";
import { mockTechnicianMatchesByVehicle } from "@/features/ustalar/data/fixtures";
import type { TechnicianMatch } from "@/features/ustalar/types";

import type { SearchCategory, SearchResult } from "./types";

function flatTechnicians(): TechnicianMatch[] {
  const seen = new Map<string, TechnicianMatch>();
  for (const list of Object.values(mockTechnicianMatchesByVehicle)) {
    for (const tech of list) {
      if (!seen.has(tech.id)) seen.set(tech.id, tech);
    }
  }
  return [...seen.values()];
}

function flatServices(): NearbyService[] {
  const seen = new Map<string, NearbyService>();
  for (const list of Object.values(CASE_NEARBY_SERVICES)) {
    for (const service of list) {
      if (!seen.has(service.id)) {
        seen.set(service.id, {
          id: service.id,
          name: service.name,
          distanceLabel: service.distanceLabel,
          ratingLabel: service.ratingLabel,
          badges: [...service.badges],
          route: service.route,
        });
      }
    }
  }
  return [...seen.values()];
}

function flatCampaigns(): CampaignOffer[] {
  const seen = new Map<string, CampaignOffer>();
  for (const list of Object.values(CASE_CAMPAIGNS)) {
    for (const campaign of list) {
      if (!seen.has(campaign.id)) {
        seen.set(campaign.id, { ...campaign });
      }
    }
  }
  return [...seen.values()];
}

function includesQuery(haystacks: (string | undefined)[], query: string) {
  const needle = query.toLowerCase().trim();
  if (!needle) return false;
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(needle));
}

export function useSearchResults(query: string, category: SearchCategory) {
  const trimmed = query.trim();
  return useQuery<SearchResult[]>({
    queryKey: ["search", "results", trimmed.toLowerCase(), category],
    enabled: trimmed.length > 0,
    queryFn: () => {
      if (!trimmed) return [];
      const results: SearchResult[] = [];

      if (
        category === "all" ||
        category === "rehber" ||
        category === "bakim"
      ) {
        for (const tip of TIPS_POOL) {
          if (
            includesQuery(
              [tip.title, tip.subtitle, tip.tag, tip.pullQuote],
              trimmed,
            )
          ) {
            results.push({ kind: "tip", item: tip });
          }
        }
      }

      if (category === "all" || category === "usta") {
        for (const tech of flatTechnicians()) {
          if (
            includesQuery(
              [
                tech.name,
                tech.tagline,
                tech.summary,
                tech.reason,
                ...tech.specialties,
              ],
              trimmed,
            )
          ) {
            results.push({ kind: "technician", item: tech });
          }
        }
      }

      if (category === "all" || category === "servis") {
        for (const service of flatServices()) {
          if (
            includesQuery([service.name, ...service.badges], trimmed)
          ) {
            results.push({ kind: "service", item: service });
          }
        }
      }

      if (category === "all" || category === "kampanya") {
        for (const campaign of flatCampaigns()) {
          if (
            includesQuery(
              [
                campaign.title,
                campaign.subtitle,
                campaign.categoryLabel,
              ],
              trimmed,
            )
          ) {
            results.push({ kind: "campaign", item: campaign });
          }
        }
      }

      return results;
    },
  });
}
