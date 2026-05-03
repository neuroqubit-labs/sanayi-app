import { Button, Icon, Text, TrustBadge } from "@naro/ui";
import { Href, useRouter } from "expo-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Quote,
  Sparkles,
  Triangle,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

import type { FeedItem, FeedTip, FeedTipTone } from "../feed";

type FeedItemViewProps = {
  item: FeedItem;
};

export function FeedItemView({ item }: FeedItemViewProps) {
  switch (item.kind) {
    case "tip":
      return <FeedTipCard tip={item.tip} />;
    case "feed_end":
      return <FeedEnd />;
    default:
      return null;
  }
}

const TIP_ICONS: Record<FeedTipTone, LucideIcon> = {
  info: BookOpen,
  warning: Triangle,
  accent: Sparkles,
  success: CheckCircle2,
};

const TIP_BG: Record<FeedTipTone, string> = {
  info: "bg-app-info-soft",
  warning: "bg-app-warning-soft",
  accent: "bg-brand-500/15",
  success: "bg-app-success-soft",
};

const TIP_ICON_COLOR: Record<FeedTipTone, string> = {
  info: "#83a7ff",
  warning: "#f5b33f",
  accent: "#0ea5e9",
  success: "#2dd28d",
};

type FeedTipCardProps = { tip: FeedTip };

function FeedTipCard({ tip }: FeedTipCardProps) {
  const router = useRouter();
  const IconComponent = TIP_ICONS[tip.tone];
  const hasRoute = Boolean(tip.route);
  return (
    <Pressable
      accessibilityRole={hasRoute ? "button" : undefined}
      accessibilityLabel={hasRoute ? `${tip.title} yazısını aç` : undefined}
      onPress={hasRoute ? () => router.push(tip.route as Href) : undefined}
      className="gap-5 overflow-hidden rounded-[24px] border border-app-outline bg-app-surface active:bg-app-surface-2"
    >
      <View
        className={["relative h-36 overflow-hidden", TIP_BG[tip.tone]].join(
          " ",
        )}
      >
        <View
          className={[
            "absolute -right-8 -top-8 h-40 w-40 rounded-full",
            TIP_BG[tip.tone],
          ].join(" ")}
        />
        <View className="absolute left-5 top-5 flex-row items-center gap-2">
          <TrustBadge label={tip.tag} tone="neutral" />
          <View className="flex-row items-center gap-1 rounded-full border border-app-outline bg-app-surface/60 px-2.5 py-1">
            <Icon icon={Clock} size={11} color="#acb7d2" />
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              {tip.readMinutes} dk okuma
            </Text>
          </View>
        </View>
        <View className="absolute inset-x-0 bottom-4 items-center">
          <View className="h-16 w-16 items-center justify-center rounded-[20px] border border-app-outline bg-app-surface-2">
            <Icon
              icon={IconComponent}
              size={30}
              color={TIP_ICON_COLOR[tip.tone]}
            />
          </View>
        </View>
      </View>

      <View className="gap-4 px-5 pb-5">
        <Text variant="display" tone="inverse" className="text-[24px] leading-[30px]">
          {tip.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted leading-6">
          {tip.subtitle}
        </Text>

        {tip.pullQuote ? (
          <View className="flex-row items-start gap-3 rounded-[18px] border border-app-outline bg-app-surface-2 px-4 py-3">
            <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-brand-500/15">
              <Icon icon={Quote} size={14} color="#0ea5e9" />
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text-muted leading-5"
            >
              {tip.pullQuote}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted" className="text-app-text-subtle">
            Naro Rehber · {tip.tag}
          </Text>
          {hasRoute ? (
            <View className="flex-row items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 px-3.5 py-2">
              <Text variant="label" tone="accent">
                Okumaya başla
              </Text>
              <Icon icon={ArrowRight} size={14} color="#0ea5e9" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function FeedEnd() {
  const router = useRouter();
  return (
    <View className="items-center gap-3 rounded-[24px] border border-dashed border-app-outline bg-app-surface/50 px-5 py-6">
      <Text variant="eyebrow" tone="subtle">
        Akışın sonu
      </Text>
      <Text variant="h3" tone="inverse" className="text-center">
        Yeni bir şey açmak ister misin?
      </Text>
      <Text tone="muted" className="text-app-text-muted text-center">
        Aracınla ilgili bir talep oluştur veya mevcut vakalarını takip et.
      </Text>
      <Button
        label="Yeni talep başlat"
        onPress={() => router.push("/(modal)/quick-actions")}
      />
    </View>
  );
}
