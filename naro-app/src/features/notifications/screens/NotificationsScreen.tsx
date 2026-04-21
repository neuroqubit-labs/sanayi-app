import { BackButton, Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  Bell,
  FileText,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Sparkles,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../api";
import type { NotificationItem, NotificationKind } from "../types";

type KindVisual = {
  icon: LucideIcon;
  color: string;
  backgroundClass: string;
  label: string;
};

const KIND_VISUAL: Record<NotificationKind, KindVisual> = {
  offer: {
    icon: Tag,
    color: "#2dd28d",
    backgroundClass: "bg-app-success/15",
    label: "Teklif",
  },
  case_status: {
    icon: Sparkles,
    color: "#0ea5e9",
    backgroundClass: "bg-brand-500/15",
    label: "Vaka durumu",
  },
  case_message: {
    icon: MessageSquare,
    color: "#83a7ff",
    backgroundClass: "bg-brand-500/15",
    label: "Mesaj",
  },
  case_document: {
    icon: FileText,
    color: "#8bd3a8",
    backgroundClass: "bg-app-success/15",
    label: "Belge",
  },
  maintenance_reminder: {
    icon: Wrench,
    color: "#f5b33f",
    backgroundClass: "bg-app-warning/15",
    label: "Hatırlatma",
  },
  invoice: {
    icon: Receipt,
    color: "#f5b33f",
    backgroundClass: "bg-app-warning/15",
    label: "Fatura",
  },
  system: {
    icon: ShieldCheck,
    color: "#83a7ff",
    backgroundClass: "bg-app-surface-2",
    label: "Sistem",
  },
};

export function NotificationsScreen() {
  const router = useRouter();
  const { data: notifications } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  const items = notifications ?? [];
  const hasUnread = items.some((item) => item.unread);

  function handleOpen(item: NotificationItem) {
    if (item.unread) {
      markRead.mutate(item.id);
    }
    if (item.route) {
      router.push(item.route as Href);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton onPress={() => router.back()} />
        <Text variant="h2" tone="inverse" className="flex-1 text-center">
          Bildirimler
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tümünü okundu olarak işaretle"
          onPress={() => {
            if (hasUnread) {
              markAllRead.mutate();
            }
          }}
          disabled={!hasUnread}
          className={`min-w-[72px] items-end ${hasUnread ? "" : "opacity-50"}`}
        >
          <Text variant="label" tone={hasUnread ? "accent" : "muted"}>
            Okundu
          </Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          contentContainerClassName="gap-3 px-4 pb-10 pt-2"
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onPress={() => handleOpen(item)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type NotificationRowProps = {
  item: NotificationItem;
  onPress: () => void;
};

function NotificationRow({ item, onPress }: NotificationRowProps) {
  const visual = KIND_VISUAL[item.kind];
  const borderClass = item.unread
    ? "border-brand-500/35 bg-app-surface-2"
    : "border-app-outline bg-app-surface";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} bildirimini aç`}
      onPress={onPress}
      className={`flex-row items-start gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90 ${borderClass}`}
    >
      <View className="relative">
        <View
          className={`h-11 w-11 items-center justify-center rounded-full ${visual.backgroundClass}`}
        >
          <Icon icon={visual.icon} size={18} color={visual.color} />
        </View>
        {item.unread ? (
          <View className="absolute -left-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-app-bg bg-brand-500" />
        ) : null}
      </View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-start gap-2">
          <Text
            variant="label"
            tone="inverse"
            className="flex-1 text-[14px] leading-[19px]"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
          >
            {visual.label}
          </Text>
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[17px]"
          numberOfLines={2}
        >
          {item.body}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          {item.timeAgo}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-10">
      <View className="h-16 w-16 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
        <Icon icon={Bell} size={22} color="#83a7ff" />
      </View>
      <View className="items-center gap-1.5">
        <Text variant="h3" tone="inverse" className="text-center">
          Şimdilik bir şey yok
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-center text-app-text-muted"
        >
          Teklifler, vaka güncellemeleri ve bakım hatırlatmaları burada görünür.
        </Text>
      </View>
    </View>
  );
}
