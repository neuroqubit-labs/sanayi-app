/**
 * Onboarding profile bootstrap + business + capabilities mutation hook'ları.
 *
 * Review step submit zinciri sıralaması:
 *   1. POST /technicians/me/profile  (varsa skip; 409 conflict tolerated)
 *   2. PATCH /technicians/me/business
 *   3. PATCH /technicians/me/capabilities
 *   4. POST /technicians/me/certificates × N
 *   5. (mevcut) service-area + schedule + capacity
 *
 * BE: app/api/v1/routes/technicians.py
 */

import type { ProviderMode, ProviderType } from "@naro/domain";
import { ApiError } from "@naro/mobile-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

// ─── Profile bootstrap (POST /technicians/me/profile) ──────────────────────

export type ProfileBootstrapPayload = {
  display_name: string;
  provider_type: ProviderType;
  provider_mode: ProviderMode;
  secondary_provider_types?: ProviderType[];
  active_provider_type?: ProviderType | null;
};

export function useCreateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ProfileBootstrapPayload>({
    mutationFn: async (payload) => {
      try {
        await apiClient(`/technicians/me/profile`, {
          method: "POST",
          body: payload,
        });
      } catch (err) {
        // 409 profile_exists: yeni başvuru değil, mevcut user — sessiz tolere
        // (idempotent gibi davran). Diğer hatalar yeniden fırlatılır.
        if (err instanceof ApiError && err.status === 409) {
          return;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
      queryClient.invalidateQueries({ queryKey: ["shell-config"] });
    },
  });
}

// ─── Business info (PATCH /technicians/me/business) ────────────────────────

export type BusinessPatchPayload = {
  legal_name?: string;
  tax_number?: string;
  iban?: string;
  phone?: string;
  email?: string;
  address?: string;
  city_code?: string;
  district_label?: string;
};

export function useUpdateBusinessMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, BusinessPatchPayload>({
    mutationFn: async (payload) => {
      // BE extra=forbid → undefined alanları gönderme (apiClient zaten skip
      // ediyor JSON.stringify ile, ama defansif filtrele)
      const filtered = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined && v !== ""),
      );
      await apiClient(`/technicians/me/business`, {
        method: "PATCH",
        body: filtered,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
      queryClient.invalidateQueries({ queryKey: ["shell-config"] });
    },
  });
}

// ─── Capabilities (PATCH /technicians/me/capabilities) ─────────────────────

export type CapabilitiesPayload = {
  insurance_case_handler?: boolean;
  on_site_repair?: boolean;
  valet_service?: boolean;
  towing_coordination?: boolean;
};

export function useUpdateCapabilitiesMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, CapabilitiesPayload>({
    mutationFn: async (payload) => {
      await apiClient(`/technicians/me/capabilities`, {
        method: "PATCH",
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
      queryClient.invalidateQueries({ queryKey: ["shell-config"] });
    },
  });
}
