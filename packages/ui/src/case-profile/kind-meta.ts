import type { ServiceCase, ServiceRequestDraft } from "@naro/domain";
import {
  AlertTriangle,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

export type CaseKindMeta = {
  label: string;
  tone: "critical" | "warning" | "info" | "accent";
  icon: LucideIcon;
  iconColor: string;
  softBg: string;
};

export const CASE_KIND_META: Record<ServiceCase["kind"], CaseKindMeta> = {
  accident: {
    label: "KAZA",
    tone: "critical",
    icon: AlertTriangle,
    iconColor: "#ff7e7e",
    softBg: "bg-app-critical/15",
  },
  towing: {
    label: "ÇEKİCİ",
    tone: "warning",
    icon: Truck,
    iconColor: "#f5b33f",
    softBg: "bg-app-warning/15",
  },
  breakdown: {
    label: "ARIZA",
    tone: "warning",
    icon: Wrench,
    iconColor: "#f5b33f",
    softBg: "bg-app-warning/15",
  },
  maintenance: {
    label: "BAKIM",
    tone: "accent",
    icon: Sparkles,
    iconColor: "#2dd28d",
    softBg: "bg-app-success/15",
  },
};

export type UrgencyMeta = {
  label: string;
  tone: "critical" | "warning" | "info";
};

export const URGENCY_META: Record<ServiceRequestDraft["urgency"], UrgencyMeta> = {
  urgent: { label: "Acil", tone: "critical" },
  today: { label: "Bugün", tone: "warning" },
  planned: { label: "Planlı", tone: "info" },
};

export const DAMAGE_AREA_LABEL: Record<string, string> = {
  front_left: "Ön sol",
  front_right: "Ön sağ",
  rear_left: "Arka sol",
  rear_right: "Arka sağ",
  side: "Yan darbe",
  bumper_front: "Ön tampon",
  bumper_rear: "Arka tampon",
  roof: "Tavan",
  hood: "Kaput",
  trunk: "Bagaj",
};

export const BREAKDOWN_LABEL: Record<string, string> = {
  engine: "Motor",
  electric: "Elektrik",
  mechanic: "Mekanik",
  climate: "Klima",
  transmission: "Şanzıman",
  tire: "Lastik",
  fluid: "Sıvı kaçağı",
  other: "Diğer",
};
