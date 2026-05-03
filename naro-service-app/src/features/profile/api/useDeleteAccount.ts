import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

/**
 * Self-service hesap silme mutation. BE soft delete: deleted_at set,
 * phone/email anonymize, tüm session'lar revoke, technician profile
 * cascade. 30g grace sonrası hard-delete worker gerçek temizliği yapar.
 *
 * Caller: 204 sonrası `useAuthStore.clear()` + login redirect yapmalı.
 */
export function useDeleteAccount() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient("/users/me", { method: "DELETE" });
    },
  });
}
