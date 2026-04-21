import type { TechnicianCertificateKind } from "@naro/domain";
import {
  IdCard,
  Landmark,
  Receipt,
  ShieldCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

export type CertKindMeta = {
  kind: TechnicianCertificateKind;
  label: string;
  description: string;
  template: string;
  icon: LucideIcon;
};

export const CERT_KIND_META: Record<TechnicianCertificateKind, CertKindMeta> = {
  identity: {
    kind: "identity",
    label: "Kimlik / Ehliyet",
    description: "Başvuran kişinin resmi kimliği",
    template: "Kimlik kartı veya ehliyetin ön + arka yüzü. Yüz net görünmeli.",
    icon: IdCard,
  },
  tax_registration: {
    kind: "tax_registration",
    label: "Vergi Levhası",
    description: "Güncel yıla ait vergi kaydı",
    template: "İçinde bulunulan yıla ait vergi levhası PDF veya fotoğrafı.",
    icon: Receipt,
  },
  trade_registry: {
    kind: "trade_registry",
    label: "Ticaret / Oda Sicili",
    description: "Oda veya sicil kaydı belgesi",
    template: "Ticaret odası veya esnaf odası sicil belgesi.",
    icon: Landmark,
  },
  insurance: {
    kind: "insurance",
    label: "Mesleki Sigorta",
    description: "İş yeri veya mesleki sorumluluk sigortası",
    template: "İş yeri yangın + 3. şahıs sorumluluk sigortası poliçe örneği.",
    icon: ShieldCheck,
  },
  technical: {
    kind: "technical",
    label: "Teknik Yeterlilik",
    description: "MYK, TSE veya marka yetki belgesi",
    template: "MYK yeterlilik, TSE hizmet yeterliliği veya marka yetki belgesi.",
    icon: Wrench,
  },
  vehicle_license: {
    kind: "vehicle_license",
    label: "Araç Ruhsatı",
    description: "Çekici / hizmet aracı ruhsatı",
    template: "Hizmette kullanılacak aracın ruhsatı (ön yüz, plaka okunur).",
    icon: Truck,
  },
  tow_operator: {
    kind: "tow_operator",
    label: "Çekici Operatör Sertifikası",
    description: "Kurtarıcı operatör yetki belgesi",
    template:
      "Devlet tarafından verilmiş çekici / kurtarıcı operatör belgesi (ruhsat + operatör yetki).",
    icon: Truck,
  },
};

export const ALL_CERT_KINDS: TechnicianCertificateKind[] = [
  "identity",
  "tax_registration",
  "trade_registry",
  "insurance",
  "technical",
  "vehicle_license",
  "tow_operator",
];
