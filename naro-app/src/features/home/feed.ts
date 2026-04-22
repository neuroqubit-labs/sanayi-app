import { useInfiniteQuery } from "@tanstack/react-query";

export type FeedTipTone = "info" | "warning" | "accent" | "success";

export type FeedTip = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  readMinutes: number;
  tone: FeedTipTone;
  pullQuote?: string;
  route?: string;
};

export type FeedCommunityPost = {
  id: string;
  author: string;
  authorTag: string;
  body: string;
  rating: number;
  serviceName?: string;
  serviceRoute?: string;
  meta: string;
  upvotes: number;
};

export type FeedInsightTone = "info" | "success" | "warning";

export type FeedInsight = {
  id: string;
  title: string;
  description: string;
  metricValue: string;
  metricLabel: string;
  tone: FeedInsightTone;
  series?: number[];
  seriesLabel?: string;
  route?: string;
};

export type FeedItem =
  | { kind: "tip"; id: string; tip: FeedTip }
  | { kind: "community"; id: string; post: FeedCommunityPost }
  | { kind: "insight"; id: string; insight: FeedInsight }
  | { kind: "feed_end"; id: string };

export type FeedPage = {
  cursor: number;
  nextCursor: number | null;
  items: FeedItem[];
};

/**
 * Naro Rehber editorial içerik — pilot süresince static (BE editorial CMS
 * Faz C). Mock kullanıcı/yorum/insight kartları kaldırıldı; sadece
 * pilot için sahte olmayan eğitim içeriği gösterilir.
 */
export const TIPS_POOL: FeedTip[] = [
  {
    id: "tip-bmw-klima",
    title: "Yaz öncesi klima kontrolü neden kritik?",
    subtitle: "Kompresör basıncı, gaz şarjı ve kabin filtresi sırası.",
    tag: "Sezon ipucu",
    readMinutes: 3,
    tone: "info",
    pullQuote:
      "Gaz kaçağı olan bir klima 15°C yerine 22°C üflüyorsa kompresör çalışmaya devam ederek yakıtı 3–5% daha fazla tüketir.",
    route: "/(modal)/bakim-talebi",
  },
  {
    id: "tip-lastik-alis",
    title: "Lastik ömrünü 2 bin km uzatan 4 alışkanlık",
    subtitle: "Basınç, rotasyon, balans ve doğru depolama.",
    tag: "Bakım",
    readMinutes: 4,
    tone: "success",
    pullQuote:
      "Doğru basınçta çalışmayan bir lastik orta diş hattından değil, omuzlardan aşınır — bu ömrünü üçte bire indirir.",
    route: "/(modal)/bakim-talebi",
  },
  {
    id: "tip-kaza-ilk",
    title: "Kaza anında ilk 10 dakikanın sırası",
    subtitle: "Sigorta, tutanak, kanıt — panik yapmadan akış.",
    tag: "Güvenlik",
    readMinutes: 5,
    tone: "warning",
    pullQuote:
      "İlk 10 dakika sigorta dosyasının %80'ini belirler; fotoğraf açısı ve tutanak detayı sonradan geri alınamaz.",
    route: "/(modal)/kaza-bildir",
  },
  {
    id: "tip-fren-balata",
    title: "Fren balatası değişim zamanı nasıl anlaşılır?",
    subtitle: "Ses, titreşim, pedal mesafesi — üç net sinyal.",
    tag: "Rehber",
    readMinutes: 3,
    tone: "accent",
    pullQuote:
      "Balata kalınlığı 3 mm'nin altına düştüğünde disk de hasar görmeye başlar; değişim maliyeti iki katına çıkar.",
    route: "/(modal)/bakim-talebi",
  },
  {
    id: "tip-yakit-disiplin",
    title: "%10 yakıt tasarrufu için 5 sürüş disiplini",
    subtitle: "Şehir içi ve otoyolda değişen alışkanlıklar.",
    tag: "Ekonomi",
    readMinutes: 4,
    tone: "info",
    pullQuote:
      "Otoyolda 110–120 km/s bandı, 130 km/s'e göre yaklaşık %12 daha az yakıt demek — motor devri eşiği belirleyici.",
  },
  {
    id: "tip-aku-kis",
    title: "Kış öncesi akü sağlık testi",
    subtitle: "Voltaj eşiği, CCA değeri, değişim kararı.",
    tag: "Sezon ipucu",
    readMinutes: 3,
    tone: "success",
    pullQuote:
      "Akü 12.4V altına düştüğünde soğuk havada ilk marşta zorlanma başlar; CCA %70'in altındaysa değişim vakti.",
    route: "/(modal)/bakim-talebi",
  },
  {
    id: "tip-yag-seviye",
    title: "Yağ seviyesi kontrolü: doğru yöntem",
    subtitle: "Soğuk mu sıcak mı — gerçek seviyeyi ne zaman okursun?",
    tag: "Rehber",
    readMinutes: 2,
    tone: "accent",
    pullQuote:
      "Motor soğukken ve 10 dakika düz zeminde durduktan sonra yapılan ölçüm, sıcak motor okumasına göre 200 ml farkı yakalar.",
    route: "/(modal)/bakim-talebi",
  },
];

const TIPS_PER_PAGE = 3;
const MAX_FEED_CURSOR = Math.ceil(TIPS_POOL.length / TIPS_PER_PAGE) - 1;

function tipsForPage(cursor: number): FeedTip[] {
  const start = cursor * TIPS_PER_PAGE;
  return TIPS_POOL.slice(start, start + TIPS_PER_PAGE);
}

export function useHomeFeed() {
  return useInfiniteQuery<FeedPage>({
    queryKey: ["home", "feed", "tips"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === "number" ? pageParam : 0;
      const tips = tipsForPage(cursor);
      const items: FeedItem[] = tips.map((tip) => ({
        kind: "tip" as const,
        id: `tip-${cursor}-${tip.id}`,
        tip,
      }));
      const nextCursor = cursor >= MAX_FEED_CURSOR ? null : cursor + 1;
      if (nextCursor === null) {
        items.push({ kind: "feed_end", id: `feed-end-${cursor}` });
      }
      return { cursor, nextCursor, items };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
