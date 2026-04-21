import type { LucideIcon } from "lucide-react-native";
import {
  Bell,
  CircleUserRound,
  CreditCard,
  FileBadge2,
  FileText,
  HelpCircle,
  Receipt,
  ShieldCheck,
  Smartphone,
} from "lucide-react-native";

export type ProfileSectionKey =
  | "kisisel-bilgiler"
  | "odeme-yontemleri"
  | "faturalar"
  | "bildirimler"
  | "cihaz"
  | "destek"
  | "guven"
  | "belgeler";

export type ProfileMenuItem = {
  key: ProfileSectionKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

export const ACCOUNT_ITEMS: ProfileMenuItem[] = [
  {
    key: "kisisel-bilgiler",
    title: "Kişisel bilgiler",
    subtitle: "Ad, telefon ve güvenlik tercihleri",
    icon: CircleUserRound,
  },
  {
    key: "odeme-yontemleri",
    title: "Ödeme yöntemleri",
    subtitle: "Kart ve havale bilgileri",
    icon: CreditCard,
  },
  {
    key: "faturalar",
    title: "Faturalarım",
    subtitle: "Geçmiş fatura ve makbuzlar",
    icon: Receipt,
  },
];

export const PREFERENCE_ITEMS: ProfileMenuItem[] = [
  {
    key: "bildirimler",
    title: "Bildirim tercihleri",
    subtitle: "Push, SMS ve e-posta",
    icon: Bell,
  },
  {
    key: "cihaz",
    title: "Cihaz güveni",
    subtitle: "Oturum, gizlilik ve bağlı cihazlar",
    icon: Smartphone,
  },
];

export const SUPPORT_ITEMS: ProfileMenuItem[] = [
  {
    key: "destek",
    title: "Yardım merkezi",
    subtitle: "SSS ve canlı destek",
    icon: HelpCircle,
  },
  {
    key: "guven",
    title: "Platform güvencesi",
    subtitle: "Ödeme ve servis şeffaflığı",
    icon: ShieldCheck,
  },
  {
    key: "belgeler",
    title: "Kullanım ve gizlilik",
    subtitle: "Koşullar, izinler ve veri politikası",
    icon: FileBadge2,
  },
];

export const PROFILE_MENU_SECTIONS = [
  { title: "Hesap & ödeme", items: ACCOUNT_ITEMS },
  { title: "Tercihler", items: PREFERENCE_ITEMS },
  { title: "Destek & hakkında", items: SUPPORT_ITEMS },
] as const;

export function findProfileMenuItem(
  key: string,
): ProfileMenuItem | undefined {
  for (const section of PROFILE_MENU_SECTIONS) {
    const match = section.items.find((item) => item.key === key);
    if (match) return match;
  }
  return undefined;
}

export type FavoriteTechnician = {
  id: string;
  name: string;
  specialty: string;
  distanceLabel: string;
  ratingLabel: string;
};

export const FAVORITE_TECHNICIANS: FavoriteTechnician[] = [
  {
    id: "tech-autopro-servis",
    name: "AutoPro Servis",
    specialty: "Genel bakım · BMW uzmanı",
    distanceLabel: "2.4 km",
    ratingLabel: "4.8",
  },
  {
    id: "tech-express-kaporta",
    name: "Express Kaporta",
    specialty: "Hasar onarımı · Kasko onaylı",
    distanceLabel: "5.1 km",
    ratingLabel: "4.6",
  },
];

export type PaymentMethodFixture = {
  id: string;
  brand: string;
  last4: string;
  holder: string;
  expires: string;
  isDefault: boolean;
};

export const PAYMENT_METHODS: PaymentMethodFixture[] = [
  {
    id: "card-visa",
    brand: "Visa",
    last4: "4242",
    holder: "Alfonso Rivera",
    expires: "05/27",
    isDefault: true,
  },
  {
    id: "card-master",
    brand: "Mastercard",
    last4: "0915",
    holder: "Alfonso Rivera",
    expires: "09/26",
    isDefault: false,
  },
];

export type InvoiceFixture = {
  id: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  dateLabel: string;
};

export const INVOICES: InvoiceFixture[] = [
  {
    id: "inv-mar-2026",
    title: "Periyodik bakım",
    subtitle: "AutoPro Servis",
    amountLabel: "₺2.850",
    dateLabel: "Mart 2026",
  },
  {
    id: "inv-feb-2026",
    title: "Kasko muayene",
    subtitle: "Express Kaporta",
    amountLabel: "₺1.450",
    dateLabel: "Şubat 2026",
  },
  {
    id: "inv-jan-2026",
    title: "Yağ değişimi",
    subtitle: "Express Servis",
    amountLabel: "₺1.120",
    dateLabel: "Ocak 2026",
  },
];

export type NotificationPreferenceKey =
  | "push_case"
  | "push_offer"
  | "push_maintenance"
  | "sms_critical"
  | "email_invoice";

export const NOTIFICATION_PREFERENCES: {
  key: NotificationPreferenceKey;
  title: string;
  description: string;
  defaultValue: boolean;
}[] = [
  {
    key: "push_case",
    title: "Vaka güncellemeleri",
    description: "Teklif, randevu ve servis durumu değişiklikleri",
    defaultValue: true,
  },
  {
    key: "push_offer",
    title: "Yeni teklif bildirimi",
    description: "Usta sana teklif geldiğinde anında haberdar ol",
    defaultValue: true,
  },
  {
    key: "push_maintenance",
    title: "Bakım hatırlatması",
    description: "Kilometre veya tarih bazlı hatırlatıcılar",
    defaultValue: true,
  },
  {
    key: "sms_critical",
    title: "Acil durumda SMS",
    description: "Kaza akışında ve kritik onaylarda SMS yedeği",
    defaultValue: false,
  },
  {
    key: "email_invoice",
    title: "E-posta ile fatura",
    description: "Her tamamlanan vakadan sonra fatura özeti",
    defaultValue: true,
  },
];

export type DeviceSessionFixture = {
  id: string;
  title: string;
  subtitle: string;
  lastSeenLabel: string;
  isCurrent: boolean;
};

export const DEVICE_SESSIONS: DeviceSessionFixture[] = [
  {
    id: "dev-iphone",
    title: "iPhone 15 Pro",
    subtitle: "iOS · İstanbul",
    lastSeenLabel: "Şu an aktif",
    isCurrent: true,
  },
  {
    id: "dev-macbook",
    title: "MacBook Air",
    subtitle: "Safari · İzmir",
    lastSeenLabel: "3 gün önce",
    isCurrent: false,
  },
];

export type SupportTopicFixture = {
  id: string;
  title: string;
  answer: string;
};

export const SUPPORT_TOPICS: SupportTopicFixture[] = [
  {
    id: "support-ödeme",
    title: "Ödeme nasıl korunuyor?",
    answer:
      "Ödemen iş onaylanana kadar Naro güvencesinde tutulur; servis işi teslim ettiğinde serbest bırakılır.",
  },
  {
    id: "support-garanti",
    title: "Garanti kapsamı nasıl çalışır?",
    answer:
      "Onarım sonrası garanti süresi ve kapsam kayıtta saklanır; garanti süresince tekrar gelen şikayetler bedava takip edilir.",
  },
  {
    id: "support-ihtilaf",
    title: "Anlaşmazlıkta ne olur?",
    answer:
      "Tarafların notları, fotoğrafları ve faturalar Naro tarafından incelenir; şeffaf karar için arabuluculuk yapılır.",
  },
];

export type DocumentFixture = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const APP_VERSION = "1.0.0";
export const MEMBERSHIP_LABEL = "2 yıldır üye";

export const LEGAL_DOCUMENTS: DocumentFixture[] = [
  {
    id: "doc-terms",
    title: "Kullanım koşulları",
    description: "Platform üzerindeki hak ve sorumlulukların özeti",
    icon: FileText,
  },
  {
    id: "doc-privacy",
    title: "Gizlilik politikası",
    description: "Verilerinin nasıl işlendiği ve saklandığı",
    icon: FileText,
  },
  {
    id: "doc-kvkk",
    title: "KVKK aydınlatma",
    description: "Kişisel veri haklarına ilişkin bilgilendirme",
    icon: FileText,
  },
];
