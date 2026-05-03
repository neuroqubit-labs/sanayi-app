import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

/**
 * Self-service hesap silme mutation. BE soft delete: deleted_at set,
 * phone/email anonymize, tüm session'lar revoke. 30g grace sonrası
 * hard-delete worker (workers/account_deletion_purge.py) gerçek
 * temizliği yapar (V1 log-only; V1.1'de cascade).
 *
 * Caller: 204 sonrası `useAuthStore.clear()` + login redirect yapmalı.
 * 410 (zaten silinmiş) durumunda da aynı clear+redirect uygulanır
 * (kullanıcı zombie token ile burada olamaz ama defansif).
 */
export function useDeleteAccount() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient("/users/me", { method: "DELETE" });
    },
  });
}
