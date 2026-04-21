import { BackButton, Icon, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { BadgeCheck, Quote, Star } from "lucide-react-native";
import { View } from "react-native";

import { MONTHLY_STATS } from "@/features/technicians";

const REVIEWS = [
  {
    id: "r-1",
    rating: 5,
    body:
      "Zamanlama kiti işimde adım adım fotoğraf paylaştılar. Faturası net, süresi sözündeydi.",
    author: "Mehmet A.",
    date: "2026-03-18",
  },
  {
    id: "r-2",
    rating: 5,
    body:
      "Elektrik arızasını hızlı tespit ettiler, gereksiz parça değişimine yönlendirmediler. Güvenli.",
    author: "Selin Y.",
    date: "2026-03-10",
  },
  {
    id: "r-3",
    rating: 4,
    body:
      "Teslim biraz gecikti ama teşhis raporu çok detaylıydı. Fotoğraflı teslim disiplini takdir ettim.",
    author: "Kaan Ö.",
    date: "2026-02-28",
  },
  {
    id: "r-4",
    rating: 5,
    body: "Sigorta dosyasını tamamen onlar yönetti. Stressiz bir süreçti.",
    author: "Elif D.",
    date: "2026-02-20",
  },
  {
    id: "r-5",
    rating: 5,
    body: "OBD teşhis sonucu şeffaf paylaştılar. Fiyat performans çok iyi.",
    author: "Serkan B.",
    date: "2026-02-14",
  },
];

export function ReviewsScreen() {
  const router = useRouter();
  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-4 pb-10">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Müşteri geri bildirimleri
          </Text>
          <Text variant="h2" tone="inverse">
            Yorumlar ({MONTHLY_STATS.review_count})
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-app-warning-soft">
          <Icon icon={Star} size={16} color="#f5b33f" strokeWidth={2.5} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[15px]">
            {MONTHLY_STATS.rating_avg.toFixed(1)} / 5
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
            {MONTHLY_STATS.review_count} yorum · son 12 ay
          </Text>
        </View>
      </View>

      <View className="gap-3">
        {REVIEWS.map((review) => (
          <View
            key={review.id}
            className="gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5"
          >
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500/15">
                <Icon icon={Quote} size={13} color="#0ea5e9" />
              </View>
              <View className="flex-1 flex-row items-center gap-1">
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
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-subtle text-[11px]"
              >
                {review.date}
              </Text>
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
        ))}
      </View>
    </Screen>
  );
}
