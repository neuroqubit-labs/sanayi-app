import { z } from "zod";

export const ServiceDomainSchema = z.enum([
  "motor",
  "sanziman",
  "fren",
  "suspansiyon",
  "elektrik",
  "klima",
  "lastik",
  "kaporta",
  "cam",
  "aku",
  "aksesuar",
  "cekici",
]);
export type ServiceDomain = z.infer<typeof ServiceDomainSchema>;

export type ServiceDomainMeta = {
  key: ServiceDomain;
  label: string;
  description: string;
  icon: string;
  order: number;
};

export const SERVICE_DOMAIN_META: Record<ServiceDomain, ServiceDomainMeta> = {
  motor: {
    key: "motor",
    label: "Motor",
    description: "Zamanlama, turbo, silindir, ECU; iç yanmalı ve hibrit motor sistemleri.",
    icon: "cog",
    order: 1,
  },
  sanziman: {
    key: "sanziman",
    label: "Şanzıman",
    description: "Otomatik, manuel, DSG, CVT; debriyaj ve diferansiyel.",
    icon: "git-branch",
    order: 2,
  },
  fren: {
    key: "fren",
    label: "Fren",
    description: "Disk, balata, hidrolik, ABS, el freni.",
    icon: "disc",
    order: 3,
  },
  suspansiyon: {
    key: "suspansiyon",
    label: "Süspansiyon",
    description: "Amortisör, yaylar, rot, rotil, salıncak.",
    icon: "activity",
    order: 4,
  },
  elektrik: {
    key: "elektrik",
    label: "Elektrik & Elektronik",
    description: "Akü, alternatör, marş, ECU, multimedya, sensör.",
    icon: "zap",
    order: 5,
  },
  klima: {
    key: "klima",
    label: "Klima",
    description: "Gaz, kompresör, kondenser, kalorifer, filtre.",
    icon: "wind",
    order: 6,
  },
  lastik: {
    key: "lastik",
    label: "Lastik & Rot-Balans",
    description: "Lastik değişimi, balans, rot ayarı, jant onarımı.",
    icon: "circle-dot",
    order: 7,
  },
  kaporta: {
    key: "kaporta",
    label: "Kaporta & Boya",
    description: "Kaza sonrası düzeltme, boya, sistem parçalar.",
    icon: "spray-can",
    order: 8,
  },
  cam: {
    key: "cam",
    label: "Cam",
    description: "Cam değişimi, cam filmi, ayna.",
    icon: "square",
    order: 9,
  },
  aku: {
    key: "aku",
    label: "Akü",
    description: "Akü satışı, değişim, şarj teşhisi.",
    icon: "battery",
    order: 10,
  },
  aksesuar: {
    key: "aksesuar",
    label: "Aksesuar & Döşeme",
    description: "Multimedya, döşeme, kaplama, iç/dış aksesuar.",
    icon: "sparkles",
    order: 11,
  },
  cekici: {
    key: "cekici",
    label: "Çekici & Yol Yardımı",
    description: "Şehir içi/uzun yol taşıma, yol kenarı destek.",
    icon: "truck",
    order: 12,
  },
};

export const SERVICE_DOMAIN_ORDER: ServiceDomain[] = [
  "motor",
  "sanziman",
  "fren",
  "suspansiyon",
  "elektrik",
  "klima",
  "lastik",
  "aku",
  "kaporta",
  "cam",
  "aksesuar",
  "cekici",
];
