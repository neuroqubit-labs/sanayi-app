import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { mockDelay } from "@/shared/lib/mock";
import { queryClient } from "@/shared/lib/query";

import { mockNotifications } from "./data/fixtures";
import type { NotificationItem, NotificationKind } from "./types";

const NOTIFICATIONS_KEY = ["notifications", "list"] as const;

let runtimeNotifications: NotificationItem[] = [...mockNotifications];

function timeAgoLabel(): string {
  return "Az önce";
}

export function pushNotification(input: {
  kind: NotificationKind;
  title: string;
  body: string;
  route?: string;
}) {
  const now = new Date().toISOString();
  const entry: NotificationItem = {
    id: `notif-${Math.random().toString(36).slice(2, 10)}`,
    kind: input.kind,
    title: input.title,
    body: input.body,
    timeAgo: timeAgoLabel(),
    createdAt: now,
    unread: true,
    route: input.route,
  };
  runtimeNotifications = [entry, ...runtimeNotifications];
  queryClient.setQueryData<NotificationItem[]>(NOTIFICATIONS_KEY, [
    ...runtimeNotifications,
  ]);
}

export function useNotifications() {
  return useQuery<NotificationItem[]>({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => mockDelay([...runtimeNotifications]),
  });
}

export function useUnreadNotificationCount() {
  const { data } = useNotifications();
  return useMemo(
    () => (data ?? []).filter((item) => item.unread).length,
    [data],
  );
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      runtimeNotifications = runtimeNotifications.map((item) => ({
        ...item,
        unread: false,
      }));
      return mockDelay(runtimeNotifications);
    },
    onSuccess: () => {
      qc.setQueryData<NotificationItem[]>(NOTIFICATIONS_KEY, [
        ...runtimeNotifications,
      ]);
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      runtimeNotifications = runtimeNotifications.map((item) =>
        item.id === notificationId ? { ...item, unread: false } : item,
      );
      return mockDelay(runtimeNotifications);
    },
    onSuccess: () => {
      qc.setQueryData<NotificationItem[]>(NOTIFICATIONS_KEY, [
        ...runtimeNotifications,
      ]);
    },
  });
}
