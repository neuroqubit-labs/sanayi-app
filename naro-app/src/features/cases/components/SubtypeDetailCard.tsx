import type { ServiceRequestKind } from "@naro/domain";
import { Icon, Text, TrustBadge } from "@naro/ui";
import {
  ShieldAlert,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { View } from "react-native";

/**
 * Canonical subtype detail — BE `CaseDetailResponse.subtype` dict'inden
 * kind başına alan render'ı. Mock `KindDetailsPanel` (CaseInspectionView)
 * request.draft'tan okuyordu; canonical veri eşleşmesi adapter'da
 * tamamlansa bile QA raporu 2026-04-23: kullanıcı vakayı ilk açtığında
 * özet satırı BEKLENİR (breakdown kategori + belirtiler / accident
 * damage + hasar seviyesi / maintenance kategori / tow mode +
 * pickup-dropoff).
 *
 * Bu bileşen profile/management ekranlarında snapshot kartı altına
 * konur — subtype data'yı drilldown (CollapsibleSection) açmadan
 * görünür kılar.
 */

type SubtypeDict = Record<string, unknown>;

type Props = {
  kind: ServiceRequestKind;
  subtype: SubtypeDict;
};

const BREAKDOWN_CATEGORY_LABEL: Record<string, string> = {
  engine: "Motor",
  electric: "Elektrik",
  mechanic: "Mekanik",
  climate: "Klima / ısıtma",
  transmission: "Şanzıman",
  tire: "Lastik",
  fluid: "Sıvı / akışkan",
  other: "Diğer",
};

const MAINTENANCE_CATEGORY_LABEL: Record<string, string> = {
  periodic: "Periyodik bakım",
  tire: "Lastik",
  glass_film: "Cam filmi",
  coating: "Seramik kaplama",
  battery: "Akü",
  climate: "Klima",
  brake: "Fren",
  detail_wash: "Detaylı yıkama",
  headlight_polish: "Far parlatma",
  engine_wash: "Motor yıkama",
  package_summer: "Yaz paketi",
  package_winter: "Kış paketi",
  package_new_car: "Yeni araç paketi",
  package_sale_prep: "Satış hazırlığı",
};

const DAMAGE_SEVERITY_LABEL: Record<string, string> = {
  minor: "Hafif hasar",
  moderate: "Orta hasar",
  major: "Ağır hasar",
  total_loss: "Pert",
};

const TOW_EQUIPMENT_LABEL: Record<string, string> = {
  flatbed: "Sürgülü platform",
  hook: "Kanca",
  wheel_lift: "Tekerlek kaldırıcı",
  heavy_duty: "Ağır vasıta",
  motorcycle: "Motosiklet",
};

const INCIDENT_REASON_LABEL: Record<string, string> = {
  not_running: "Çalışmıyor",
  accident: "Kaza sonrası",
  flat_tire: "Lastik patladı",
  battery: "Akü bitti",
  fuel: "Yakıt bitti",
  locked_keys: "Anahtar içeride",
  stuck: "Takıldı",
  other: "Diğer",
};

function parseList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((v): v is string => typeof v === "string");
  }
  if (typeof input !== "string") return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function Card({
  title,
  icon,
  iconColor,
  rows,
  chips,
}: {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  rows?: { label: string; value: string }[];
  chips?: string[];
}) {
  return (
    <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
      <View className="flex-row items-center gap-3">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${iconColor}26` }}
        >
          <Icon icon={icon} size={18} color={iconColor} />
        </View>
        <Text variant="label" tone="inverse" className="text-[14px]">
          {title}
        </Text>
      </View>
      {rows && rows.length > 0 ? (
        <View className="gap-1.5">
          {rows.map((row) => (
            <View key={row.label} className="flex-row items-start gap-2">
              <Text
                variant="caption"
                tone="muted"
                className="w-24 text-app-text-subtle text-[11px]"
              >
                {row.label}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="flex-1 text-[12px] text-app-text"
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {chips && chips.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {chips.map((chip) => (
            <TrustBadge key={chip} label={chip} tone="accent" />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BreakdownView({ subtype }: { subtype: SubtypeDict }) {
  const category = subtype.breakdown_category as string | null | undefined;
  const symptoms = parseList(subtype.symptoms);
  const drivable = subtype.vehicle_drivable as boolean | null | undefined;
  const rows: { label: string; value: string }[] = [];
  if (category) {
    rows.push({
      label: "Kategori",
      value: BREAKDOWN_CATEGORY_LABEL[category] ?? category,
    });
  }
  if (drivable !== null && drivable !== undefined) {
    rows.push({
      label: "Sürülebilir",
      value: drivable ? "Evet" : "Hayır",
    });
  }
  if (!rows.length && symptoms.length === 0) return null;
  return (
    <Card
      title="Arıza detayı"
      icon={Wrench}
      iconColor="#f5b33f"
      rows={rows}
      chips={symptoms}
    />
  );
}

function MaintenanceView({ subtype }: { subtype: SubtypeDict }) {
  const category = subtype.maintenance_category as string | null | undefined;
  const tier = subtype.maintenance_tier as string | null | undefined;
  const rows: { label: string; value: string }[] = [];
  if (category) {
    rows.push({
      label: "Kategori",
      value: MAINTENANCE_CATEGORY_LABEL[category] ?? category,
    });
  }
  if (tier) {
    rows.push({ label: "Paket", value: tier });
  }
  if (!rows.length) return null;
  return (
    <Card
      title="Bakım detayı"
      icon={Sparkles}
      iconColor="#83a7ff"
      rows={rows}
    />
  );
}

function AccidentView({ subtype }: { subtype: SubtypeDict }) {
  const damageArea = subtype.damage_area as string | null | undefined;
  const damageSeverity = subtype.damage_severity as string | null | undefined;
  const counterpartyCount = subtype.counterparty_count as
    | number
    | null
    | undefined;
  const kaskoSelected = Boolean(subtype.kasko_selected);
  const rows: { label: string; value: string }[] = [];
  if (damageArea) {
    rows.push({ label: "Hasar bölgesi", value: damageArea });
  }
  if (damageSeverity) {
    rows.push({
      label: "Hasar seviyesi",
      value: DAMAGE_SEVERITY_LABEL[damageSeverity] ?? damageSeverity,
    });
  }
  if (counterpartyCount !== null && counterpartyCount !== undefined) {
    rows.push({
      label: "Karşı araç",
      value: counterpartyCount.toString(),
    });
  }
  const chips: string[] = [];
  if (kaskoSelected) chips.push("Kasko kullanılacak");
  if (subtype.sigorta_selected) chips.push("Trafik sigortası");
  if (!rows.length && chips.length === 0) return null;
  return (
    <Card
      title="Kaza detayı"
      icon={ShieldAlert}
      iconColor="#ff6b6b"
      rows={rows}
      chips={chips}
    />
  );
}

function TowView({ subtype }: { subtype: SubtypeDict }) {
  const mode = subtype.tow_mode as string | null | undefined;
  const incidentReason = subtype.incident_reason as string | null | undefined;
  const pickupAddress = subtype.pickup_address as string | null | undefined;
  const dropoffAddress = subtype.dropoff_address as string | null | undefined;
  const equipment = Array.isArray(subtype.required_equipment)
    ? (subtype.required_equipment as string[])
    : [];
  const rows: { label: string; value: string }[] = [];
  if (mode) {
    rows.push({
      label: "Mod",
      value: mode === "immediate" ? "Hemen" : "Randevulu",
    });
  }
  if (incidentReason) {
    rows.push({
      label: "Sebep",
      value: INCIDENT_REASON_LABEL[incidentReason] ?? incidentReason,
    });
  }
  if (pickupAddress) {
    rows.push({ label: "Alış", value: pickupAddress });
  }
  if (dropoffAddress) {
    rows.push({ label: "Varış", value: dropoffAddress });
  }
  const equipmentLabels = equipment
    .map((e) => TOW_EQUIPMENT_LABEL[e] ?? e)
    .filter((v) => v.length > 0);
  if (!rows.length && equipmentLabels.length === 0) return null;
  return (
    <Card
      title="Çekici detayı"
      icon={Truck}
      iconColor="#0ea5e9"
      rows={rows}
      chips={equipmentLabels}
    />
  );
}

export function SubtypeDetailCard({ kind, subtype }: Props) {
  if (!subtype || Object.keys(subtype).length === 0) return null;
  switch (kind) {
    case "breakdown":
      return <BreakdownView subtype={subtype} />;
    case "maintenance":
      return <MaintenanceView subtype={subtype} />;
    case "accident":
      return <AccidentView subtype={subtype} />;
    case "towing":
      return <TowView subtype={subtype} />;
  }
}

