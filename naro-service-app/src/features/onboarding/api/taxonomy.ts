import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/runtime";

import {
  BrandOutSchema,
  DrivetrainOutSchema,
  ProcedureOutSchema,
  ServiceDomainOutSchema,
  type BrandOut,
  type DrivetrainOut,
  type ProcedureOut,
  type ServiceDomainOut,
} from "../coverage-schema";

const TAXONOMY_STALE_TIME = 60 * 60 * 1000; // 1 saat — backend cache'e paralel

const ServiceDomainListSchema = z.array(ServiceDomainOutSchema);
const ProcedureListSchema = z.array(ProcedureOutSchema);
const BrandListSchema = z.array(BrandOutSchema);
const DrivetrainListSchema = z.array(DrivetrainOutSchema);

async function fetchList<T>(
  path: string,
  parser: (raw: unknown) => T,
): Promise<T> {
  const raw = await apiClient(path);
  return parser(raw);
}

export function useServiceDomainsQuery() {
  return useQuery<ServiceDomainOut[]>({
    queryKey: ["taxonomy", "service-domains"],
    queryFn: () =>
      fetchList("/taxonomy/service-domains", (raw) =>
        ServiceDomainListSchema.parse(raw),
      ),
    staleTime: TAXONOMY_STALE_TIME,
  });
}

export function useProceduresQuery(domainKey: string | null) {
  return useQuery<ProcedureOut[]>({
    queryKey: ["taxonomy", "procedures", domainKey],
    enabled: domainKey !== null,
    queryFn: () =>
      fetchList(
        `/taxonomy/procedures?domain=${encodeURIComponent(domainKey ?? "")}`,
        (raw) => ProcedureListSchema.parse(raw),
      ),
    staleTime: TAXONOMY_STALE_TIME,
  });
}

export function useBrandsQuery() {
  return useQuery<BrandOut[]>({
    queryKey: ["taxonomy", "brands"],
    queryFn: () =>
      fetchList("/taxonomy/brands", (raw) => BrandListSchema.parse(raw)),
    staleTime: TAXONOMY_STALE_TIME,
  });
}

export function useDrivetrainsQuery() {
  return useQuery<DrivetrainOut[]>({
    queryKey: ["taxonomy", "drivetrains"],
    queryFn: () =>
      fetchList("/taxonomy/drivetrains", (raw) =>
        DrivetrainListSchema.parse(raw),
      ),
    staleTime: TAXONOMY_STALE_TIME,
  });
}
