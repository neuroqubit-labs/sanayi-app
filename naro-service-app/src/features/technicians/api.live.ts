import {
  MyTechnicianCertificateSchema,
  MyTechnicianProfileSchema as MyTechnicianProfileFullSchema,
  type MyTechnicianCertificate,
  type MyTechnicianProfile as MyTechnicianProfileFull,
} from "@naro/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";

import { apiClient, useAuthStore } from "@/runtime";

import { useTechnicianProfileStore } from "./profile-store";

/**
 * Canonical /technicians/me/profile minimal parse — P1-4 launch migration.
 * Offer submit + approval create için technician_id (TechnicianProfile.id)
 * gerekli; auth token user ID'den farklı (TechnicianProfile.user_id).
 *
 * Full shape (display_name, tagline, verified_level, vs.) ShellConfig +
 * TechnicianProfileStore üstünden zaten tüketiliyor; bu hook sadece `id`
 * için (offer wire-up).
 */
const MyTechnicianProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
});
export type MyTechnicianProfile = z.infer<typeof MyTechnicianProfileSchema>;

export function useMyTechnicianProfile() {
  return useQuery<MyTechnicianProfile>({
    queryKey: ["technicians", "me", "profile", "live"],
    queryFn: async () => {
      const raw = await apiClient(`/technicians/me/profile`);
      return MyTechnicianProfileSchema.parse(raw);
    },
    staleTime: 5 * 60 * 1000,
  });
}

const ShowcaseStatusSchema = z.enum([
  "pending_customer",
  "pending_technician",
  "published",
  "revoked",
  "hidden",
]);

const MyTechnicianShowcaseSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  kind: z.string(),
  status: ShowcaseStatusSchema,
  title: z.string(),
  summary: z.string(),
  month_label: z.string().nullable().optional(),
  location_label: z.string().nullable().optional(),
  rating: z.number().int().nullable().optional(),
});
export type MyTechnicianShowcase = z.infer<
  typeof MyTechnicianShowcaseSchema
>;

export function useMyTechnicianShowcases() {
  return useQuery<MyTechnicianShowcase[]>({
    queryKey: ["technicians", "me", "showcases"],
    queryFn: async () => {
      const raw = await apiClient(`/technicians/me/showcases`);
      return MyTechnicianShowcaseSchema.array().parse(raw);
    },
    staleTime: 30 * 1000,
  });
}

export function useRevokeTechnicianShowcase() {
  const queryClient = useQueryClient();
  return useMutation<MyTechnicianShowcase, Error, string>({
    mutationFn: async (showcaseId) => {
      const raw = await apiClient(
        `/technicians/me/showcases/${showcaseId}/revoke`,
        { method: "POST" },
      );
      return MyTechnicianShowcaseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["technicians", "me", "showcases"],
      });
    },
  });
}

// ─── Profile store hydrate (/me/profile + /me/certificates) ─────────────────
//
// Customer-app `useMe` pattern'in teknisyen ikizi:
// naro-app/src/features/user/api.ts::useMe().
//
// Root shell'de bir kez `useTechnicianProfileHydrator()` çağrılır; auth
// hazır olduğunda iki endpoint'i fetch eder, sonucu Zustand store'a yazar.
// Fixture INITIAL_TECHNICIAN_PROFILE yalnızca login öncesi/seed fallback.
//
// Eski `useMyTechnicianProfile` küçük scope (id + user_id + display_name)
// offer wire-up için dependency olduğundan break etmiyoruz; full shape bu
// yeni query'lerde.

const PROFILE_FULL_KEY = ["technicians", "me", "profile", "full"] as const;
const CERTS_KEY = ["technicians", "me", "certificates"] as const;

function useAuthReady() {
  return useAuthStore((s) => s.hydrated && Boolean(s.accessToken));
}

async function fetchMyTechnicianProfileFull(): Promise<MyTechnicianProfileFull> {
  const raw = await apiClient(`/technicians/me/profile`);
  return MyTechnicianProfileFullSchema.parse(raw);
}

async function fetchMyTechnicianCertificates(): Promise<MyTechnicianCertificate[]> {
  const raw = await apiClient(`/technicians/me/certificates`);
  return MyTechnicianCertificateSchema.array().parse(raw);
}

export function useMyTechnicianProfileFull() {
  const authReady = useAuthReady();
  return useQuery<MyTechnicianProfileFull>({
    queryKey: PROFILE_FULL_KEY,
    enabled: authReady,
    queryFn: fetchMyTechnicianProfileFull,
    staleTime: 60 * 1000,
  });
}

export function useMyTechnicianCertificates() {
  const authReady = useAuthReady();
  return useQuery<MyTechnicianCertificate[]>({
    queryKey: CERTS_KEY,
    enabled: authReady,
    queryFn: fetchMyTechnicianCertificates,
    staleTime: 60 * 1000,
  });
}

/**
 * Root shell'de bir kez çağrılır; iki query + store hydrate wiring tek yerde.
 * Profile ve certs birlikte hazır olduğunda store'a yazılır — KYC gate (shell
 * config `required_onboarding_steps`) DB'deki gerçek cert status'lerine göre
 * hesaplanır.
 */
export function useTechnicianProfileHydrator(): void {
  const profileQuery = useMyTechnicianProfileFull();
  const certsQuery = useMyTechnicianCertificates();
  const hydrate = useTechnicianProfileStore((s) => s.hydrate);

  useEffect(() => {
    if (profileQuery.data && certsQuery.data) {
      hydrate(profileQuery.data, certsQuery.data);
    }
  }, [profileQuery.data, certsQuery.data, hydrate]);
}
