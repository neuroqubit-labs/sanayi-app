/**
 * GET/PATCH /users/me — authenticated user's own profile.
 *
 * Backend contract: `app/schemas/user.py::UserResponse` + `UserUpdate`.
 * Endpoint kayıt dokümanı: docs/audits/2026-04-24-register-login-schema-alignment.md
 */

import {
  UserSchema,
  UserUpdatePayloadSchema,
  type User,
  type UserUpdatePayload,
} from "@naro/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiClient, useAuthStore } from "@/runtime";

import { useUserProfileStore } from "../profile/user-store";

const USER_ME_KEY = ["user", "me"] as const;

async function fetchMe(): Promise<User> {
  const raw = await apiClient("/users/me");
  return UserSchema.parse(raw);
}

async function patchMe(payload: UserUpdatePayload): Promise<User> {
  const body = UserUpdatePayloadSchema.parse(payload);
  const raw = await apiClient("/users/me", {
    method: "PATCH",
    body,
  });
  return UserSchema.parse(raw);
}

/**
 * Canlı `/users/me` verisini döndürür. Auth tamamlandıktan sonra fetch;
 * sonuç profile store'una hydrate edilir (diğer ekranlar store'dan okur).
 */
export function useMe() {
  const hydrate = useUserProfileStore((s) => s.hydrate);
  const authReady = useAuthStore(
    (s) => s.hydrated && Boolean(s.accessToken),
  );

  const query = useQuery<User>({
    queryKey: USER_ME_KEY,
    enabled: authReady,
    queryFn: fetchMe,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      hydrate(query.data);
    }
  }, [query.data, hydrate]);

  return query;
}

/**
 * PATCH /users/me mutation — başarılı yanıt store'a yazılır ve cache güncellenir.
 */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  const hydrate = useUserProfileStore((s) => s.hydrate);

  return useMutation<User, Error, UserUpdatePayload>({
    mutationFn: patchMe,
    onSuccess: (user) => {
      queryClient.setQueryData(USER_ME_KEY, user);
      hydrate(user);
    },
  });
}
