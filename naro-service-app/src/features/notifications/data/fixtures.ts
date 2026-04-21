import type { NotificationItem } from "../types";

export const mockNotifications: NotificationItem[] = [
  {
    id: "notif-appt-incoming-001",
    kind: "appointment_incoming",
    title: "Yeni randevu talebi — Mercedes C200",
    body: "Zeynep Aksoy yarın 10:00-13:00 için randevu istiyor. 24 saat içinde yanıt.",
    timeAgo: "15 dk önce",
    createdAt: "2026-04-20T11:45:00+03:00",
    unread: true,
    route: "/(tabs)/islerim",
  },
  {
    id: "notif-pool-lastik-002",
    kind: "pool_new_case",
    title: "Yakın bölgede yeni havuz vakası",
    body: "Lastik patlağı · Renault Clio · 1,4 km — acil eşleşme bekliyor.",
    timeAgo: "1 saat önce",
    createdAt: "2026-04-20T10:30:00+03:00",
    unread: true,
    route: "/havuz/case-pool-clio-002",
  },
  {
    id: "notif-parts-approved-003",
    kind: "parts_approval_response",
    title: "Parça onayı geldi",
    body: "Mehmet Demir BMW zincir kiti için parça onayını verdi.",
    timeAgo: "3 saat önce",
    createdAt: "2026-04-20T08:30:00+03:00",
    unread: true,
    route: "/is/case-bmw-breakdown-001",
  },
  {
    id: "notif-invoice-paid-004",
    kind: "invoice_paid",
    title: "Fatura ödendi — ₺2.850",
    body: "AutoPro Mart periyodik bakım ödemesi Naro güvencesinden serbest bırakıldı.",
    timeAgo: "Bugün 09:00",
    createdAt: "2026-04-20T09:00:00+03:00",
    unread: false,
  },
  {
    id: "notif-insurance-005",
    kind: "insurance_update",
    title: "Axa Sigorta dosyası kabul edildi",
    body: "Audi A4 kasko dosyası sigorta tarafından onaylandı; ödeme işlemde.",
    timeAgo: "Dün",
    createdAt: "2026-04-19T16:20:00+03:00",
    unread: false,
    route: "/is/case-insurance-audi-005",
  },
  {
    id: "notif-offer-accepted-006",
    kind: "offer_accepted",
    title: "Teklifin kabul edildi",
    body: "Motor revizyon teklifin — BMW 320i için müşteri randevu onayına düştü.",
    timeAgo: "Dün",
    createdAt: "2026-04-19T14:00:00+03:00",
    unread: false,
  },
  {
    id: "notif-campaign-007",
    kind: "campaign_stats",
    title: "Yaz Bakımı kampanyan ilgi gördü",
    body: "Bu hafta 12 görüntülenme, 3 talep. Fiyat bandını güncellemek ister misin?",
    timeAgo: "2 gün önce",
    createdAt: "2026-04-18T10:00:00+03:00",
    unread: false,
  },
];

export type NotificationPreferenceKey =
  | "pool_alerts"
  | "appointments"
  | "approvals"
  | "messages"
  | "campaigns"
  | "payouts";

export const NOTIFICATION_PREFERENCES: {
  key: NotificationPreferenceKey;
  title: string;
  description: string;
  defaultValue: boolean;
}[] = [
  {
    key: "pool_alerts",
    title: "Havuz uyarıları",
    description: "Yakın bölgede açılan yeni vakalar",
    defaultValue: true,
  },
  {
    key: "appointments",
    title: "Randevu talepleri",
    description: "Müşteri onayladığında / iptal ettiğinde anında",
    defaultValue: true,
  },
  {
    key: "approvals",
    title: "Parça / fatura onayları",
    description: "Müşterinin onay cevapları",
    defaultValue: true,
  },
  {
    key: "messages",
    title: "Mesajlar",
    description: "Müşteri thread'indeki yeni mesajlar",
    defaultValue: true,
  },
  {
    key: "campaigns",
    title: "Kampanya istatistikleri",
    description: "Haftalık performans ve ilgi raporları",
    defaultValue: false,
  },
  {
    key: "payouts",
    title: "Ödeme / fatura",
    description: "Ödeme serbest bırakıldığında SMS + push",
    defaultValue: true,
  },
];
