import type { ServiceCase } from "@naro/domain";
import { Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  AlertCircle,
  ChevronRight,
  Hourglass,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

type TilePreview = {
  title: string;
  meta?: string;
};

type TileSpec = {
  id: string;
  label: string;
  count: number;
  preview: TilePreview | null;
  icon: LucideIcon;
  tone: "accent" | "warning";
  route: Href;
};

type Props = {
  urgent: { caseItem: ServiceCase; title: string; meta: string }[];
  waiting: { caseItem: ServiceCase; title: string; meta: string }[];
};

export function QuickActionTileRow({ urgent, waiting }: Props) {
  const router = useRouter();

  const tiles: TileSpec[] = [
    {
      id: "urgent",
      label: "Sıradaki adımın",
      count: urgent.length,
      preview: urgent[0]
        ? { title: urgent[0].title, meta: urgent[0].meta }
        : null,
      icon: AlertCircle,
      tone: "accent",
      route: "/(tabs)/islerim" as Href,
    },
    {
      id: "waiting",
      label: "Müşteride bekliyor",
      count: waiting.length,
      preview: waiting[0]
        ? { title: waiting[0].title, meta: waiting[0].meta }
        : null,
      icon: Hourglass,
      tone: "warning",
      route: "/(tabs)/islerim" as Href,
    },
  ];

  return (
    <View className="flex-row gap-3">
      {tiles.map((tile) => (
        <QuickActionTile
          key={tile.id}
          tile={tile}
          onPress={() => router.push(tile.route)}
        />
      ))}
    </View>
  );
}

function QuickActionTile({
  tile,
  onPress,
}: {
  tile: TileSpec;
  onPress: () => void;
}) {
  const isEmpty = tile.count === 0;
  const toneClass =
    tile.tone === "accent"
      ? "border-brand-500/30 bg-brand-500/10"
      : "border-app-warning/30 bg-app-warning-soft";
  const iconColor = tile.tone === "accent" ? "#0ea5e9" : "#f5b33f";
  const countTone = tile.tone === "accent" ? "accent" : "warning";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tile.label} · ${tile.count} iş`}
      onPress={onPress}
      className={[
        "flex-1 gap-2 rounded-[22px] border px-4 py-4 active:opacity-90",
        isEmpty ? "border-app-outline bg-app-surface" : toneClass,
      ].join(" ")}
    >
      <View className="flex-row items-center gap-2">
        <Icon
          icon={tile.icon}
          size={14}
          color={isEmpty ? "#6f7b97" : iconColor}
        />
        <Text
          variant="eyebrow"
          tone={isEmpty ? "subtle" : tile.tone === "accent" ? "accent" : "warning"}
          className="text-[11px]"
        >
          {tile.label}
        </Text>
      </View>

      <Text
        variant="h2"
        tone={isEmpty ? "muted" : countTone}
        className="text-[28px] leading-[32px]"
      >
        {tile.count}
      </Text>

      {tile.preview ? (
        <View className="gap-0.5">
          <Text
            variant="label"
            tone="inverse"
            className="text-[12px]"
            numberOfLines={1}
          >
            {tile.preview.title}
          </Text>
          {tile.preview.meta ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[10px]"
              numberOfLines={1}
            >
              {tile.preview.meta}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          {isEmpty ? "Aksiyon bekleyen yok" : "Tümünü aç →"}
        </Text>
      )}

      {!isEmpty ? (
        <View className="flex-row items-center justify-end gap-1 pt-1">
          <Text
            variant="caption"
            tone={tile.tone === "accent" ? "accent" : "warning"}
            className="text-[11px]"
          >
            Tümünü aç
          </Text>
          <Icon
            icon={ChevronRight}
            size={10}
            color={tile.tone === "accent" ? "#0ea5e9" : "#f5b33f"}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
