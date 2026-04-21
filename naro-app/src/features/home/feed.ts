import { useInfiniteQuery } from "@tanstack/react-query";

import {
  CASE_CAMPAIGNS,
  CASE_NEARBY_SERVICES,
} from "@/features/cases/data/fixtures";
import { mockTechnicianMatchesByVehicle } from "@/features/ustalar/data/fixtures";
import type { TechnicianMatch } from "@/features/ustalar/types";
import { useActiveVehicle } from "@/features/vehicles";
import { mockDelay } from "@/shared/lib/mock";

import type { CampaignOffer, NearbyService } from "./types";

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
  | {
      kind: "technician_rail";
      id: string;
      title: string;
      description: string;
      technicians: TechnicianMatch[];
    }
  | {
      kind: "campaign_hero";
      id: string;
      eyebrow: string;
      campaign: CampaignOffer;
      highlightLabel: string;
    }
  | {
      kind: "campaign_rail";
      id: string;
      title: string;
      description: string;
      campaigns: CampaignOffer[];
    }
  | {
      kind: "service_rail";
      id: string;
      title: string;
      description: string;
      services: NearbyService[];
    }
  | { kind: "tip"; id: string; tip: FeedTip }
  | { kind: "community"; id: string; post: FeedCommunityPost }
  | { kind: "insight"; id: string; insight: FeedInsight }
  | { kind: "feed_end"; id: string };

export type FeedPage = {
  cursor: number;
  nextCursor: number | null;
  items: FeedItem[];
};

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";
const MAX_FEED_CURSOR = 2;

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

const COMMUNITY_POOL: FeedCommunityPost[] = [
  {
    id: "post-autopro-bmw",
    author: "Mehmet K.",
    authorTag: "BMW 320i · 120.000 km",
    body: "AutoPro Servis'te zamanlama kaynaklı sesi bütçemi aşmadan çözdüler. Süreç şeffaf, yedek parça kaynağı belgeli.",
    rating: 5,
    serviceName: "AutoPro Servis",
    serviceRoute: "/usta/tech-autopro-servis",
    meta: "2 gün önce",
    upvotes: 14,
  },
  {
    id: "post-cekici-selin",
    author: "Selin D.",
    authorTag: "Toyota Corolla · 58.000 km",
    body: "Çekici çağırma akışı çok kolay. 23 dakikada yanımdalardı, bu uygulama olmadan ne yapardım bilmiyorum.",
    rating: 5,
    meta: "4 gün önce",
    upvotes: 22,
  },
  {
    id: "post-mekanik-burak",
    author: "Burak T.",
    authorTag: "VW Passat · 203.000 km",
    body: "Bakım paketini aldım; kampanya fiyatı hesap dışı yağ/filtre olmadan bitirdi. Puan da doldu.",
    rating: 4,
    serviceName: "Mekanik Mehmet",
    meta: "1 hafta önce",
    upvotes: 9,
  },
  {
    id: "post-hizli-didem",
    author: "Didem A.",
    authorTag: "Renault Clio · 72.000 km",
    body: "Uygulamadaki tahmini tutar ile fatura arasında %5'ten az fark oldu. Güvenim arttı.",
    rating: 5,
    serviceName: "Hızlı Tamir",
    meta: "2 hafta önce",
    upvotes: 31,
  },
];

const INSIGHTS_POOL: FeedInsight[] = [
  {
    id: "insight-km-month",
    title: "Bu ay 412 km sürdün",
    description: "Ortalama aylık kullanımının hafif üstündesin. Bakım aralıkları buna göre güncellenecek.",
    metricValue: "+%8",
    metricLabel: "Geçen aya göre",
    tone: "info",
    series: [385, 401, 378, 395, 412],
    seriesLabel: "Son 5 ay · km",
    route: "/(tabs)/kayitlar",
  },
  {
    id: "insight-cost-6m",
    title: "Son 6 ayda ortalama servis maliyetin",
    description: "Benzer BMW 3 Serisi kullanıcılarından %12 daha az ödedin.",
    metricValue: "₺3.240",
    metricLabel: "6 ay toplam",
    tone: "success",
    series: [420, 680, 240, 1100, 450, 350],
    seriesLabel: "Son 6 ay · ₺",
    route: "/(tabs)/kayitlar",
  },
  {
    id: "insight-muayene",
    title: "Muayene tarihine 24 gün kaldı",
    description: "Muayene öncesi kontrol randevusu planlamak istersen şimdi uygun bir zaman.",
    metricValue: "24 gün",
    metricLabel: "Kalan süre",
    tone: "warning",
    route: "/(modal)/bakim-talebi",
  },
];

type FeedContext = {
  suggestions: TechnicianMatch[];
  campaigns: CampaignOffer[];
  services: NearbyService[];
};

function cloneServices(source: readonly NearbyServiceLike[]): NearbyService[] {
  return source.map((service) => ({
    id: service.id,
    name: service.name,
    distanceLabel: service.distanceLabel,
    ratingLabel: service.ratingLabel,
    badges: [...service.badges],
    route: service.route,
  }));
}

type NearbyServiceLike = {
  id: string;
  name: string;
  distanceLabel: string;
  ratingLabel: string;
  badges: readonly string[];
  route: string;
};

function pick<T>(pool: readonly T[], index: number): T {
  const item = pool[index % pool.length];
  if (!item) {
    throw new Error("feed pool boş olmamalı");
  }
  return item;
}

const TIPS_PER_PAGE = 2;

function tipsForPage(cursor: number): FeedTip[] {
  const start = cursor * TIPS_PER_PAGE;
  const picks: FeedTip[] = [];
  for (let offset = 0; offset < TIPS_PER_PAGE; offset += 1) {
    const index = start + offset;
    if (index >= TIPS_POOL.length) break;
    picks.push(pick(TIPS_POOL, index));
  }
  return picks;
}

function buildFirstPage(ctx: FeedContext): FeedItem[] {
  const items: FeedItem[] = [];
  const [tipA, tipB] = tipsForPage(0);

  if (ctx.suggestions.length) {
    items.push({
      kind: "technician_rail",
      id: "rail-ustalar-top",
      title: "Sana özel ustalar",
      description: "Aracına ve açık vakana göre güvenli adaylar.",
      technicians: ctx.suggestions,
    });
  }

  if (ctx.campaigns[0]) {
    items.push({
      kind: "campaign_hero",
      id: `hero-${ctx.campaigns[0].id}`,
      eyebrow: "Bu haftanın kampanyası",
      campaign: ctx.campaigns[0],
      highlightLabel: "Sınırlı süre",
    });
  }

  if (tipA) {
    items.push({ kind: "tip", id: `tip-0-${tipA.id}`, tip: tipA });
  }

  if (ctx.services.length) {
    items.push({
      kind: "service_rail",
      id: "rail-services-near",
      title: "Yakınındaki servisler",
      description: "Konumuna yakın, doğrulanmış servis kısa listesi.",
      services: ctx.services.slice(0, 6),
    });
  }

  items.push({
    kind: "community",
    id: "community-0",
    post: pick(COMMUNITY_POOL, 0),
  });

  if (ctx.campaigns.length > 1) {
    items.push({
      kind: "campaign_rail",
      id: "rail-campaigns-main",
      title: "Bakım kampanyaları",
      description: "Bu ay aracına yakın hissettiren kısa yollar.",
      campaigns: ctx.campaigns.slice(1),
    });
  }

  items.push({
    kind: "insight",
    id: "insight-0",
    insight: pick(INSIGHTS_POOL, 0),
  });

  if (tipB) {
    items.push({ kind: "tip", id: `tip-0-${tipB.id}`, tip: tipB });
  }

  return items;
}

function buildNextPage(cursor: number): FeedItem[] {
  const items: FeedItem[] = [];
  const [tipA, tipB] = tipsForPage(cursor);
  const community = pick(COMMUNITY_POOL, cursor);
  const insight = pick(INSIGHTS_POOL, cursor);

  if (tipA) {
    items.push({ kind: "tip", id: `tip-${cursor}-${tipA.id}`, tip: tipA });
  }

  items.push({
    kind: "community",
    id: `community-${cursor}-${community.id}`,
    post: community,
  });

  items.push({
    kind: "insight",
    id: `insight-${cursor}-${insight.id}`,
    insight,
  });

  if (tipB) {
    items.push({ kind: "tip", id: `tip-${cursor}-${tipB.id}`, tip: tipB });
  }

  return items;
}

export function useHomeFeed() {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  const suggestions =
    mockTechnicianMatchesByVehicle[vehicleId] ??
    mockTechnicianMatchesByVehicle[DEFAULT_VEHICLE_ID] ??
    [];
  const campaignsRaw =
    CASE_CAMPAIGNS[vehicleId as keyof typeof CASE_CAMPAIGNS] ??
    CASE_CAMPAIGNS[DEFAULT_VEHICLE_ID];
  const servicesRaw =
    CASE_NEARBY_SERVICES[vehicleId as keyof typeof CASE_NEARBY_SERVICES] ??
    CASE_NEARBY_SERVICES[DEFAULT_VEHICLE_ID];

  return useInfiniteQuery<FeedPage>({
    queryKey: ["home", "feed", vehicleId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === "number" ? pageParam : 0;
      const ctx: FeedContext = {
        suggestions,
        campaigns: [...campaignsRaw],
        services: cloneServices(servicesRaw),
      };
      const items =
        cursor === 0 ? buildFirstPage(ctx) : buildNextPage(cursor);
      const nextCursor = cursor >= MAX_FEED_CURSOR ? null : cursor + 1;
      if (nextCursor === null) {
        items.push({ kind: "feed_end", id: `feed-end-${cursor}` });
      }
      return mockDelay<FeedPage>({ cursor, nextCursor, items });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
