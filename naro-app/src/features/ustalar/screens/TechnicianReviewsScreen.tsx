import { BackButton, Button, Icon, Screen, Text } from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BadgeCheck, Quote, Star } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { useTechnicianProfile } from "../api";
import type { TechnicianReview } from "../types";

type RatingFilter = "all" | 5 | 4 | 3;
type SortKey = "newest" | "rating";

export function TechnicianReviewsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: technician } = useTechnicianProfile(id ?? "");

  const [rating, setRating] = useState<RatingFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const visible = useMemo(() => {
    const reviews = technician?.reviews ?? [];
    const filtered = rating === "all"
      ? reviews
      : reviews.filter((r) => (r.rating ?? 0) === rating);
    return [...filtered].sort((a, b) => {
      if (sort === "rating") {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
  }, [technician, rating, sort]);

  if (!technician) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="justify-center gap-4 px-6">
        <Text variant="h2" tone="inverse">
          Servis bulunamadı
        </Text>
        <Button label="Geri dön" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const fiveCount = technician.reviews.filter((r) => (r.rating ?? 0) === 5).length;
  const fourCount = technician.reviews.filter((r) => (r.rating ?? 0) === 4).length;
  const threeCount = technician.reviews.filter((r) => (r.rating ?? 0) === 3).length;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-4 pb-10">
      <View className="flex-row items-center gap-3">
        <BackButton variant="close" onPress={() => router.back()} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            {technician.name}
          </Text>
          <Text variant="h2" tone="inverse">
            Yorumlar ({technician.reviewCount})
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-app-warning-soft">
          <Icon icon={Star} size={18} color="#f5b33f" strokeWidth={2.5} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[17px]">
            {technician.rating.toFixed(1)} / 5
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
            {technician.reviewCount} yorum · son 12 ay
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Text variant="eyebrow" tone="subtle" className="px-1">
          Puan
        </Text>
        <View className="flex-row gap-2">
          <FilterChip
            label="Tümü"
            active={rating === "all"}
            onPress={() => setRating("all")}
          />
          <FilterChip
            label={`5★ (${fiveCount})`}
            active={rating === 5}
            onPress={() => setRating(5)}
          />
          <FilterChip
            label={`4★ (${fourCount})`}
            active={rating === 4}
            onPress={() => setRating(4)}
          />
          <FilterChip
            label={`3★ (${threeCount})`}
            active={rating === 3}
            onPress={() => setRating(3)}
          />
        </View>
      </View>

      <View className="gap-2">
        <Text variant="eyebrow" tone="subtle" className="px-1">
          Sırala
        </Text>
        <View className="flex-row gap-2">
          <FilterChip
            label="En yeni"
            active={sort === "newest"}
            onPress={() => setSort("newest")}
          />
          <FilterChip
            label="En yüksek puan"
            active={sort === "rating"}
            onPress={() => setSort("rating")}
          />
        </View>
      </View>

      {visible.length === 0 ? (
        <View className="items-center gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-8">
          <Icon icon={Quote} size={20} color="#83a7ff" />
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Bu filtreye uyan yorum yok.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {visible.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </View>
      )}

      <Text
        variant="caption"
        tone="muted"
        className="text-center text-app-text-subtle text-[11px]"
      >
        Yorumlar yalnızca tamamlanmış işleri olan müşteriler tarafından yazılabilir.
      </Text>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 active:opacity-85 ${
        active
          ? "border-brand-500/40 bg-brand-500/15"
          : "border-app-outline bg-app-surface"
      }`}
    >
      <Text
        variant="caption"
        tone="inverse"
        className={`text-[12px] ${active ? "" : "text-app-text-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ReviewCard({ review }: { review: TechnicianReview }) {
  return (
    <View className="gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={Quote} size={13} color="#0ea5e9" />
        </View>
        {review.rating ? (
          <View className="flex-row items-center gap-1">
            {Array.from({ length: review.rating }).map((_, idx) => (
              <Icon
                key={idx}
                icon={Star}
                size={12}
                color="#f5b33f"
                strokeWidth={2.5}
              />
            ))}
          </View>
        ) : null}
        {review.serviceLabel ? (
          <View className="rounded-full border border-app-outline bg-app-surface-2 px-2 py-0.5">
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[10px]"
            >
              {review.serviceLabel}
            </Text>
          </View>
        ) : null}
        {review.createdAt ? (
          <Text
            variant="caption"
            tone="muted"
            className="ml-auto text-app-text-subtle text-[11px]"
          >
            {formatDate(review.createdAt)}
          </Text>
        ) : null}
      </View>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text leading-[20px]"
      >
        "{review.body}"
      </Text>
      <View className="flex-row items-center gap-1.5">
        <Icon
          icon={BadgeCheck}
          size={11}
          color="#2dd28d"
          strokeWidth={2.5}
        />
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          {review.author}
        </Text>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
