import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/runtime";
import { mockDelay } from "@/shared/lib/mock";

import { mockTechnicianProfiles } from "./data/fixtures";
import {
  BrandOutSchema,
  ServiceDomainOutSchema,
  TechnicianFeedResponseSchema,
  PublicCaseShowcaseDetailSchema,
  TechnicianPublicViewSchema,
  type BrandOut,
  type ServiceDomainOut,
  type TechnicianFeedItem,
  type TechnicianFeedResponse,
  type PublicCaseShowcaseDetail,
  type TechnicianPublicView,
} from "./schemas";
import type { TechnicianProfile } from "./types";

export function useTechnicianProfile(technicianId: string) {
  // Legacy mock-only profile used by old composer/review surfaces.
  // Public profile and preview screens use useTechnicianPublicView.
  return useQuery<TechnicianProfile | null>({
    queryKey: ["technicians", "profile", technicianId],
    queryFn: () =>
      mockDelay(
        mockTechnicianProfiles.find(
          (technician) => technician.id === technicianId,
        ) ?? null,
      ),
  });
}

// ─── Live backend wrappers (brief PR-A3) ────────────────────────────────────

type FeedFilters = {
  domain?: string;
  brand?: string;
  district?: string;
  vehicleId?: string;
  caseId?: string;
  cursor?: string;
  limit?: number;
};

function buildFeedPath(filters: FeedFilters): string {
  const params = new URLSearchParams();
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.district) params.set("district", filters.district);
  if (filters.vehicleId) params.set("vehicle_id", filters.vehicleId);
  if (filters.caseId) params.set("case_id", filters.caseId);
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return `/technicians/public/feed${qs ? `?${qs}` : ""}`;
}

export function useTechniciansFeed(filters: FeedFilters = {}) {
  return useQuery<TechnicianFeedResponse>({
    queryKey: [
      "technicians",
      "public",
      "feed",
      filters.domain ?? null,
      filters.brand ?? null,
      filters.district ?? null,
      filters.vehicleId ?? null,
      filters.caseId ?? null,
      filters.cursor ?? null,
      filters.limit ?? 20,
    ],
    queryFn: async () => {
      const raw = await apiClient(buildFeedPath(filters));
      return TechnicianFeedResponseSchema.parse(raw);
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Paginated infinite feed — filter'a göre (domain + brand + district).
 * Cursor backend `next_cursor` string'i ile ilerler.
 */
export function useTechniciansInfiniteFeed(
  filters: Omit<FeedFilters, "cursor"> = {},
) {
  const limit = filters.limit ?? 20;
  return useInfiniteQuery({
    queryKey: [
      "technicians",
      "public",
      "feed",
      "infinite",
      filters.domain ?? null,
      filters.brand ?? null,
      filters.district ?? null,
      filters.vehicleId ?? null,
      filters.caseId ?? null,
      limit,
    ] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const raw = await apiClient(
        buildFeedPath({
          ...filters,
          limit,
          cursor: pageParam ?? undefined,
        }),
      );
      return TechnicianFeedResponseSchema.parse(raw);
    },
    getNextPageParam: (lastPage): string | null => lastPage.next_cursor,
    staleTime: 30 * 1000,
  });
}

export function useTechnicianPublicView(technicianId: string) {
  return useQuery<TechnicianPublicView>({
    queryKey: ["technicians", "public", "view", technicianId],
    enabled: technicianId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/technicians/public/${technicianId}`);
      return TechnicianPublicViewSchema.parse(raw);
    },
  });
}

export function useTechnicianShowcaseDetail(
  technicianId: string,
  showcaseId: string,
) {
  return useQuery<PublicCaseShowcaseDetail>({
    queryKey: [
      "technicians",
      "public",
      "showcase",
      technicianId,
      showcaseId,
    ],
    enabled: technicianId.length > 0 && showcaseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(
        `/technicians/public/${technicianId}/showcases/${showcaseId}`,
      );
      return PublicCaseShowcaseDetailSchema.parse(raw);
    },
  });
}

export type {
  BrandOut,
  PublicCaseShowcaseDetail,
  ServiceDomainOut,
  TechnicianFeedItem,
  TechnicianPublicView,
};

const TAXONOMY_STALE_TIME = 60 * 60 * 1000; // 1 saat

export function useServiceDomainsQuery() {
  return useQuery<ServiceDomainOut[]>({
    queryKey: ["taxonomy", "service-domains"],
    queryFn: async () => {
      const raw = await apiClient("/taxonomy/service-domains");
      return ServiceDomainOutSchema.array().parse(raw);
    },
    staleTime: TAXONOMY_STALE_TIME,
  });
}

export function useBrandsQuery() {
  return useQuery<BrandOut[]>({
    queryKey: ["taxonomy", "brands"],
    queryFn: async () => {
      const raw = await apiClient("/taxonomy/brands");
      return BrandOutSchema.array().parse(raw);
    },
    staleTime: TAXONOMY_STALE_TIME,
  });
}
