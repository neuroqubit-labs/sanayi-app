import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/runtime";

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
