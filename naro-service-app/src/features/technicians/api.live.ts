import { useQuery } from "@tanstack/react-query";
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
