export type CampaignStatus = "active" | "draft" | "archived";

export type CampaignItem = {
  id: string;
  title: string;
  subtitle: string;
  category:
    | "periodic"
    | "tire"
    | "package_summer"
    | "package_winter"
    | "detail_wash";
  price_label: string;
  price_amount: number;
  status: CampaignStatus;
  views: number;
  requests: number;
  valid_from: string;
  valid_to?: string;
};

export const CAMPAIGN_FIXTURES: CampaignItem[] = [
  {
    id: "cmp-summer-001",
    title: "Yaz Bakımı Paketi",
    subtitle: "Yağ + filtre + klima kontrolü",
    category: "package_summer",
    price_label: "₺699",
    price_amount: 699,
    status: "active",
    views: 248,
    requests: 12,
    valid_from: "2026-04-01",
    valid_to: "2026-06-30",
  },
  {
    id: "cmp-oil-002",
    title: "Yağ Değişimi Hızlı Servis",
    subtitle: "Yağ + yağ filtresi · 45 dk",
    category: "periodic",
    price_label: "₺450",
    price_amount: 450,
    status: "active",
    views: 156,
    requests: 8,
    valid_from: "2026-03-15",
  },
  {
    id: "cmp-tire-003",
    title: "Lastik Rotasyon & Balans",
    subtitle: "4 lastik · balans dahil",
    category: "tire",
    price_label: "₺199",
    price_amount: 199,
    status: "active",
    views: 89,
    requests: 3,
    valid_from: "2026-04-10",
  },
  {
    id: "cmp-winter-draft-004",
    title: "Kışlık Paket",
    subtitle: "Antifriz + akü + lastik geçişi",
    category: "package_winter",
    price_label: "₺1.299",
    price_amount: 1299,
    status: "draft",
    views: 0,
    requests: 0,
    valid_from: "2026-10-01",
    valid_to: "2026-12-31",
  },
  {
    id: "cmp-detail-archive-005",
    title: "Detaylı İç Yıkama",
    subtitle: "Sezon sonu kampanyası",
    category: "detail_wash",
    price_label: "₺349",
    price_amount: 349,
    status: "archived",
    views: 412,
    requests: 24,
    valid_from: "2025-11-01",
    valid_to: "2026-02-28",
  },
];

export const MAINTENANCE_TEMPLATES: {
  category: CampaignItem["category"];
  title: string;
  subtitle: string;
  starter_price: number;
}[] = [
  {
    category: "package_summer",
    title: "Yaz Bakımı Paketi",
    subtitle: "Yağ + klima + soğutma sistemi",
    starter_price: 699,
  },
  {
    category: "package_winter",
    title: "Kışlık Paket",
    subtitle: "Antifriz + akü + lastik",
    starter_price: 1299,
  },
  {
    category: "periodic",
    title: "Periyodik Bakım",
    subtitle: "Yağ + filtreler + genel kontrol",
    starter_price: 450,
  },
  {
    category: "tire",
    title: "Lastik Hizmetleri",
    subtitle: "Değişim / rotasyon / balans",
    starter_price: 199,
  },
];
