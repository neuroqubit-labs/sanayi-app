import type { ServiceCase, ServiceRequestDraft } from "@naro/domain";
import {
  AlertTriangle,
  Clock,
  FileText,
  Image as ImageIcon,
  Lock,
  MapPin,
  Music,
  ShieldCheck,
  Sparkles,
  Tag,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PremiumListRow } from "../PremiumListRow";
import { SectionHeader } from "../SectionHeader";
import { StatusChip } from "../StatusChip";
import { Text } from "../Text";
import { TrustBadge } from "../TrustBadge";

import { CollapsibleSection } from "./CollapsibleSection";
import { CASE_KIND_META as SHARED_KIND_META } from "./kind-meta";
import { VehicleDetailSection } from "./VehicleDetailSection";

const ATTACHMENT_ICON = {
  photo: ImageIcon,
  video: Video,
  audio: Music,
  location: MapPin,
  document: FileText,
  invoice: FileText,
  report: FileText,
} as const;

const KIND_META: Record<
  ServiceCase["kind"],
  { label: string; tone: "critical" | "warning" | "info" | "accent" }
> = {
  accident: { label: "KAZA", tone: "critical" },
  towing: { label: "ÇEKİCİ", tone: "warning" },
  breakdown: { label: "ARIZA", tone: "warning" },
  maintenance: { label: "BAKIM", tone: "accent" },
};

const URGENCY_META: Record<
  ServiceRequestDraft["urgency"],
  { label: string; tone: "critical" | "warning" | "info" }
> = {
  urgent: { label: "Acil", tone: "critical" },
  today: { label: "Bugün", tone: "warning" },
  planned: { label: "Planlı", tone: "info" },
};

const DAMAGE_AREA_LABEL: Record<string, string> = {
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

const BREAKDOWN_CATEGORY_LABEL: Record<string, string> = {
  engine: "Motor",
  electric: "Elektrik",
  mechanic: "Mekanik",
  climate: "Klima / soğutma",
  transmission: "Şanzıman",
  tire: "Lastik",
  fluid: "Sıvı kaçağı",
  other: "Diğer",
};

const MAINTENANCE_CATEGORY_LABEL: Record<string, string> = {
  periodic: "Periyodik bakım",
  tire: "Lastik",
  glass_film: "Cam filmi",
  coating: "Kaplama",
  battery: "Akü",
  climate: "Klima bakımı",
  brake: "Fren bakımı",
  detail_wash: "Detaylı yıkama",
  headlight_polish: "Far polisaj",
  engine_wash: "Motor yıkama",
  package_summer: "Yaz paketi",
  package_winter: "Kış paketi",
  package_new_car: "Yeni araç paketi",
  package_sale_prep: "Satış öncesi paket",
};

const REPORT_METHOD_LABEL: Record<string, string> = {
  e_devlet: "e-Devlet tutanağı",
  paper: "Kağıt tutanak",
  police: "Polis / kaza tespit",
};

const PRICE_PREFERENCE_LABEL: Record<string, string> = {
  any: "Fark etmez",
  nearby: "Yakın olsun",
  cheap: "Ekonomik",
  fast: "Hızlı çözüm",
};

const PICKUP_PREFERENCE_LABEL: Record<string, string> = {
  dropoff: "Müşteri bırakacak",
  pickup: "Pickup servisi",
  valet: "Valet",
};

export type CaseContextState = "pool" | "process" | "archive";

type Props = {
  caseItem: ServiceCase;
  myTechnicianId?: string;
  showCompetingOffers?: boolean;
  contextState?: CaseContextState;
};

export function CaseInspectionView({
  caseItem,
  myTechnicianId,
  showCompetingOffers = true,
  contextState = "pool",
}: Props) {
  const draft = caseItem.request;
  const kindMeta = KIND_META[caseItem.kind];
  const urgencyMeta = URGENCY_META[draft.urgency];
  const hasLocation = Boolean(draft.location_label || draft.dropoff_label);
  const hasAttachments = caseItem.attachments.length > 0;
  const hasOffers = caseItem.offers.length > 0;

  const sharedKindMeta = SHARED_KIND_META[caseItem.kind];

  return (
    <View className="gap-4">
      <HeroCard caseItem={caseItem} kindMeta={kindMeta} urgencyMeta={urgencyMeta} />

      <VehicleDetailSection vehicleId={caseItem.vehicle_id} />

      <CollapsibleSection
        title="Problem detayı"
        accent={sharedKindMeta.iconColor}
        titleIcon={sharedKindMeta.icon}
        description="Belirti, önem, hizmet tercihleri"
        preview={<ProblemPreview caseItem={caseItem} />}
      >
        <KindDetailsPanel caseItem={caseItem} />
      </CollapsibleSection>

      {hasLocation ? (
        <CollapsibleSection
          title="Konum"
          accent="#83a7ff"
          titleIcon={MapPin}
          description="Servis noktası ve teslim bilgisi"
          preview={
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px]"
              numberOfLines={1}
            >
              {draft.location_label ?? draft.dropoff_label ?? ""}
            </Text>
          }
        >
          <LocationSection draft={draft} />
        </CollapsibleSection>
      ) : null}

      {hasAttachments ? (
        <CollapsibleSection
          title="Müşteri paylaşımları"
          accent="#2dd28d"
          titleIcon={ImageIcon}
          description="Müşterinin yüklediği foto, video ve notlar"
          preview={
            <AttachmentsPreview attachments={caseItem.attachments} />
          }
        >
          <AttachmentsSection attachments={caseItem.attachments} />
        </CollapsibleSection>
      ) : null}

      {showCompetingOffers && hasOffers ? (
        <CollapsibleSection
          title={offersTitle(contextState)}
          accent="#f5b33f"
          titleIcon={Tag}
          description={offersDescription(contextState)}
          preview={
            <OffersPreview
              caseItem={caseItem}
              myTechnicianId={myTechnicianId}
              contextState={contextState}
            />
          }
        >
          <CompetingOffersSection
            caseItem={caseItem}
            myTechnicianId={myTechnicianId}
            contextState={contextState}
          />
        </CollapsibleSection>
      ) : null}

      <View className="flex-row items-center gap-2 px-1">
        <Icon icon={Clock} size={12} color="#6b7280" />
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          Açıldı {caseItem.created_at_label} · Güncellendi{" "}
          {caseItem.updated_at_label}
        </Text>
      </View>
    </View>
  );
}

function buildKindPreview(caseItem: ServiceCase): string {
  const d = caseItem.request;
  if (caseItem.kind === "accident" && d.damage_area) {
    return DAMAGE_AREA_LABEL[d.damage_area] ?? d.damage_area;
  }
  if (caseItem.kind === "breakdown" && d.breakdown_category) {
    return BREAKDOWN_CATEGORY_LABEL[d.breakdown_category] ?? d.breakdown_category;
  }
  if (caseItem.kind === "maintenance" && d.maintenance_category) {
    return MAINTENANCE_CATEGORY_LABEL[d.maintenance_category] ?? d.maintenance_category;
  }
  if (caseItem.kind === "towing") {
    return d.vehicle_drivable ? "Kısmen sürülebilir" : "Sürülemiyor";
  }
  return "";
}

function offersTitle(state: CaseContextState): string {
  if (state === "pool") return "Rakip teklifler";
  if (state === "process") return "Teklif geçmişi";
  return "Kabul edilen teklif";
}

function offersMeta(caseItem: ServiceCase, state: CaseContextState): string {
  if (state === "archive") return "Kilitli";
  return `${caseItem.offers.length} teklif`;
}

function offersDescription(state: CaseContextState): string {
  if (state === "pool") return "Havuzdaki diğer ustaların karşılaştırması";
  if (state === "process") return "Kabul edilen teklif kilitli, geçmiş read-only";
  return "Kazanan teklif kilitli";
}

function ProblemPreview({ caseItem }: { caseItem: ServiceCase }) {
  const d = caseItem.request;
  const chips: { label: string; tone: "critical" | "warning" | "info" | "accent" }[] = [];
  if (caseItem.kind === "accident" && d.damage_area) {
    chips.push({
      label: DAMAGE_AREA_LABEL[d.damage_area] ?? d.damage_area,
      tone: "critical",
    });
  }
  if (caseItem.kind === "breakdown" && d.breakdown_category) {
    chips.push({
      label: BREAKDOWN_CATEGORY_LABEL[d.breakdown_category] ?? d.breakdown_category,
      tone: "warning",
    });
  }
  if (caseItem.kind === "maintenance" && d.maintenance_category) {
    chips.push({
      label: MAINTENANCE_CATEGORY_LABEL[d.maintenance_category] ?? d.maintenance_category,
      tone: "accent",
    });
  }
  if (d.kasko_selected) chips.push({ label: "Kasko", tone: "info" });
  if (d.towing_required) chips.push({ label: "Çekici", tone: "warning" });
  if (d.valet_requested) chips.push({ label: "Valet", tone: "accent" });
  if (chips.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {chips.slice(0, 4).map((chip) => (
        <StatusChip key={chip.label} label={chip.label} tone={chip.tone} />
      ))}
    </View>
  );
}

function AttachmentsPreview({
  attachments,
}: {
  attachments: ServiceCase["attachments"];
}) {
  const visible = attachments.slice(0, 4);
  const extra = attachments.length - visible.length;
  return (
    <View className="flex-row items-center gap-1.5">
      {visible.map((attachment) => {
        const IconCmp =
          ATTACHMENT_ICON[attachment.kind as keyof typeof ATTACHMENT_ICON] ??
          FileText;
        return (
          <View
            key={attachment.id}
            className="h-7 w-7 items-center justify-center rounded-full border border-app-outline bg-app-surface-2"
          >
            <Icon icon={IconCmp} size={11} color="#83a7ff" />
          </View>
        );
      })}
      {extra > 0 ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          +{extra}
        </Text>
      ) : null}
    </View>
  );
}

function OffersPreview({
  caseItem,
  myTechnicianId,
  contextState,
}: {
  caseItem: ServiceCase;
  myTechnicianId?: string;
  contextState: CaseContextState;
}) {
  const offers = caseItem.offers;
  if (offers.length === 0) return null;
  const myOffer = myTechnicianId
    ? offers.find((o) => o.technician_id === myTechnicianId)
    : undefined;
  const accepted = offers.find((o) => o.status === "accepted");

  if (contextState !== "pool" && accepted) {
    return (
      <View className="flex-row items-center gap-2">
        <Icon icon={Lock} size={11} color="#2dd28d" />
        <Text
          variant="caption"
          tone="muted"
          className="text-app-success text-[12px]"
        >
          {accepted.price_label} kabul edildi
        </Text>
      </View>
    );
  }

  const amounts = offers.map((o) => o.amount).filter((n) => Number.isFinite(n));
  const min = amounts.length ? Math.min(...amounts) : null;
  const max = amounts.length ? Math.max(...amounts) : null;
  return (
    <View className="flex-row items-center gap-2">
      {myOffer ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-success text-[12px]"
        >
          Senin: {myOffer.price_label}
        </Text>
      ) : null}
      {min !== null && max !== null && min !== max ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
        >
          Aralık ₺{min.toLocaleString("tr-TR")}–₺{max.toLocaleString("tr-TR")}
        </Text>
      ) : null}
    </View>
  );
}

function HeroCard({
  caseItem,
  kindMeta,
  urgencyMeta,
}: {
  caseItem: ServiceCase;
  kindMeta: (typeof KIND_META)[ServiceCase["kind"]];
  urgencyMeta: (typeof URGENCY_META)[ServiceRequestDraft["urgency"]];
}) {
  const accentColor = SHARED_KIND_META[caseItem.kind].iconColor;
  const KindIcon = SHARED_KIND_META[caseItem.kind].icon;
  const hasPhoto = caseItem.attachments.some((a) => a.kind === "photo");

  return (
    <View
      className="overflow-hidden rounded-[26px] border bg-app-surface"
      style={{ borderColor: `${accentColor}3a` }}
    >
      <View
        className="gap-3 px-5 py-5"
        style={{ backgroundColor: `${accentColor}14` }}
      >
        <View className="flex-row items-start gap-4">
          <View
            className="h-[72px] w-[72px] items-center justify-center rounded-[20px]"
            style={{ backgroundColor: `${accentColor}26` }}
          >
            <Icon icon={KindIcon} size={34} color={accentColor} strokeWidth={2.2} />
            {hasPhoto ? (
              <View className="absolute -bottom-1.5 -right-1.5 h-6 w-6 items-center justify-center rounded-full border-2 border-app-surface bg-app-surface-2">
                <Icon icon={ImageIcon} size={11} color="#83a7ff" />
              </View>
            ) : null}
          </View>
          <View className="flex-1 gap-1.5">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
              <StatusChip label={urgencyMeta.label} tone={urgencyMeta.tone} />
              {caseItem.offers.length > 0 ? (
                <TrustBadge
                  label={`${caseItem.offers.length} teklif`}
                  tone="accent"
                />
              ) : null}
              {caseItem.request.emergency_acknowledged ? (
                <TrustBadge label="Acil onay" tone="critical" />
              ) : null}
            </View>
            <Text
              variant="h2"
              tone="inverse"
              numberOfLines={2}
              className="text-[19px] leading-[23px]"
            >
              {caseItem.title}
            </Text>
          </View>
        </View>
        {caseItem.summary ? (
          <Text
            tone="muted"
            className="text-app-text-muted text-[13px] leading-[19px]"
          >
            {caseItem.summary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function KindDetailsPanel({ caseItem }: { caseItem: ServiceCase }) {
  if (caseItem.kind === "accident") return <AccidentDetails caseItem={caseItem} />;
  if (caseItem.kind === "breakdown")
    return <BreakdownDetails caseItem={caseItem} />;
  if (caseItem.kind === "maintenance")
    return <MaintenanceDetails caseItem={caseItem} />;
  if (caseItem.kind === "towing") return <TowingDetails caseItem={caseItem} />;
  return null;
}

function DetailsCard({
  title,
  description,
  icon,
  iconColor,
  rows,
  chips,
  notes,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  iconColor: string;
  rows?: { label: string; value: string }[];
  chips?: { label: string; tone?: "accent" | "warning" | "critical" | "success" | "info" | "neutral" }[];
  notes?: string[];
}) {
  return (
    <View className="gap-3">
      <View
        className="flex-row items-center gap-3 rounded-[16px] border px-4 py-3"
        style={{
          borderColor: `${iconColor}3a`,
          backgroundColor: `${iconColor}14`,
        }}
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${iconColor}26` }}
        >
          <Icon icon={icon} size={18} color={iconColor} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[14px]">
            {title}
          </Text>
          {description ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px]"
              numberOfLines={2}
            >
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
        <View className="flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={icon} size={16} color={iconColor} />
          </View>
          <View className="flex-1 gap-2">
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
                  <TrustBadge
                    key={chip.label}
                    label={chip.label}
                    tone={chip.tone ?? "neutral"}
                  />
                ))}
              </View>
            ) : null}
            {notes && notes.length > 0 ? (
              <View className="gap-1.5">
                {notes.map((note, idx) => (
                  <Text
                    key={idx}
                    tone="muted"
                    className="text-app-text-muted text-[12px] leading-[17px]"
                  >
                    {note}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function AccidentDetails({ caseItem }: { caseItem: ServiceCase }) {
  const d = caseItem.request;
  const rows: { label: string; value: string }[] = [];
  if (d.damage_area) {
    rows.push({
      label: "Hasar bölgesi",
      value: DAMAGE_AREA_LABEL[d.damage_area] ?? d.damage_area,
    });
  }
  if (d.vehicle_drivable !== null) {
    rows.push({
      label: "Araç hareketli mi",
      value: d.vehicle_drivable ? "Evet, sürülebiliyor" : "Hayır, sürülemiyor",
    });
  }
  if (d.report_method) {
    rows.push({
      label: "Tutanak",
      value: REPORT_METHOD_LABEL[d.report_method] ?? d.report_method,
    });
  }
  if (d.counterparty_vehicle_count) {
    rows.push({
      label: "Karşı araç",
      value: `${d.counterparty_vehicle_count} araç`,
    });
  }
  const chips: { label: string; tone?: "warning" | "critical" | "info" | "accent" | "success" | "neutral" }[] = [];
  if (d.kasko_selected)
    chips.push({ label: `Kasko${d.kasko_brand ? ` · ${d.kasko_brand}` : ""}`, tone: "info" });
  if (d.sigorta_selected)
    chips.push({
      label: `Trafik${d.sigorta_brand ? ` · ${d.sigorta_brand}` : ""}`,
      tone: "info",
    });
  if (d.towing_required) chips.push({ label: "Çekici gerekli", tone: "warning" });
  if (d.ambulance_contacted) chips.push({ label: "Ambulans", tone: "critical" });
  if (d.valet_requested) chips.push({ label: "Valet / pickup", tone: "accent" });
  const notes: string[] = [];
  if (d.counterparty_note) notes.push(`Karşı taraf: ${d.counterparty_note}`);
  if (d.notes) notes.push(d.notes);
  const damageLabel = d.damage_area
    ? DAMAGE_AREA_LABEL[d.damage_area] ?? d.damage_area
    : null;
  return (
    <DetailsCard
      title={damageLabel ? `Kaza · ${damageLabel}` : "Kaza detayı"}
      description="Hasar bölgesi, sigorta, tutanak ve tercih bilgileri"
      icon={AlertTriangle}
      iconColor="#ff7e7e"
      rows={rows}
      chips={chips}
      notes={notes}
    />
  );
}

function BreakdownDetails({ caseItem }: { caseItem: ServiceCase }) {
  const d = caseItem.request;
  const rows: { label: string; value: string }[] = [];
  if (d.breakdown_category) {
    rows.push({
      label: "Arıza",
      value:
        BREAKDOWN_CATEGORY_LABEL[d.breakdown_category] ?? d.breakdown_category,
    });
  }
  if (d.vehicle_drivable !== null) {
    rows.push({
      label: "Araç hareketli mi",
      value: d.vehicle_drivable ? "Kısmen / evet" : "Hayır",
    });
  }
  if (d.price_preference) {
    rows.push({
      label: "Fiyat önceliği",
      value: PRICE_PREFERENCE_LABEL[d.price_preference] ?? d.price_preference,
    });
  }
  const chips: { label: string; tone?: "warning" | "accent" | "info" | "neutral" | "success" }[] = [];
  if (d.on_site_repair) chips.push({ label: "Yerinde onarım", tone: "accent" });
  if (d.towing_required) chips.push({ label: "Çekici gerekli", tone: "warning" });
  if (d.valet_requested) chips.push({ label: "Valet / pickup", tone: "accent" });
  if (d.pickup_preference)
    chips.push({
      label: PICKUP_PREFERENCE_LABEL[d.pickup_preference] ?? d.pickup_preference,
      tone: "info",
    });
  const notes: string[] = [];
  if (d.symptoms.length > 0) notes.push(`Belirtiler: ${d.symptoms.join(", ")}`);
  if (d.notes) notes.push(d.notes);
  const categoryLabel = d.breakdown_category
    ? BREAKDOWN_CATEGORY_LABEL[d.breakdown_category] ?? d.breakdown_category
    : null;
  const subtitleByCategory: Record<string, string> = {
    engine: "Ses, güç kaybı, sıcaklık",
    electric: "Uyarı ışığı, marş",
    mechanic: "Fren, süspansiyon",
    transmission: "Vites, debriyaj",
    climate: "Soğutmuyor, koku",
    tire: "Patlak, inmiş, aşınma",
    fluid: "Yağ, soğutma, yakıt",
    other: "Kısa açıklama",
  };
  return (
    <DetailsCard
      title={categoryLabel ? `Arıza · ${categoryLabel}` : "Arıza detayı"}
      description={
        d.breakdown_category
          ? subtitleByCategory[d.breakdown_category] ?? "Belirti, önem ve tercihler"
          : "Belirti, önem ve hizmet tercihleri"
      }
      icon={Wrench}
      iconColor="#f5b33f"
      rows={rows}
      chips={chips}
      notes={notes}
    />
  );
}

function MaintenanceDetails({ caseItem }: { caseItem: ServiceCase }) {
  const d = caseItem.request;
  const rows: { label: string; value: string }[] = [];
  if (d.maintenance_category) {
    rows.push({
      label: "Bakım türü",
      value:
        MAINTENANCE_CATEGORY_LABEL[d.maintenance_category] ??
        d.maintenance_category,
    });
  }
  if (d.maintenance_tier) {
    rows.push({ label: "Paket", value: d.maintenance_tier });
  }
  if (d.preferred_window) {
    rows.push({ label: "Tercih edilen gün", value: d.preferred_window });
  }
  const chips: { label: string; tone?: "accent" | "info" | "neutral" | "success" }[] = [];
  d.maintenance_items.slice(0, 6).forEach((item) => {
    chips.push({ label: item, tone: "neutral" });
  });
  if (d.pickup_preference)
    chips.push({
      label: PICKUP_PREFERENCE_LABEL[d.pickup_preference] ?? d.pickup_preference,
      tone: "info",
    });
  if (d.valet_requested) chips.push({ label: "Valet", tone: "accent" });
  const notes: string[] = [];
  if (d.symptoms.length > 0) notes.push(`Belirtiler: ${d.symptoms.join(", ")}`);
  if (d.notes) notes.push(d.notes);
  const categoryLabel = d.maintenance_category
    ? MAINTENANCE_CATEGORY_LABEL[d.maintenance_category] ?? d.maintenance_category
    : null;
  const subtitleByCategory: Record<string, string> = {
    periodic: "Yağ, filtre, genel kontrol",
    tire: "Mevsim + marka + jant",
    glass_film: "Yan / ön / tam kapsam",
    coating: "Koruma + parlaklık",
    battery: "Kapasite + marka tercihi",
    climate: "Gaz şarjı, filtre, kontrol",
    brake: "Ön / arka / takım",
    detail_wash: "İç, dış, tam detay",
    headlight_polish: "Matlaşmış far düzeltme",
    engine_wash: "Temizlik + koruma spreyi",
    package_summer: "Klima · cam filmi · yaz lastiği",
    package_winter: "Akü · antifriz · kış lastiği",
    package_new_car: "Seramik · cam filmi · PPF",
    package_sale_prep: "Detaylı yıkama · far · rötuş",
  };
  return (
    <DetailsCard
      title={categoryLabel ? `Bakım · ${categoryLabel}` : "Bakım detayı"}
      description={
        d.maintenance_category
          ? subtitleByCategory[d.maintenance_category] ?? "Paket, kapsam ve tercihler"
          : "Paket, kapsam ve tercihler"
      }
      icon={Sparkles}
      iconColor="#2dd28d"
      rows={rows}
      chips={chips}
      notes={notes}
    />
  );
}

function TowingDetails({ caseItem }: { caseItem: ServiceCase }) {
  const d = caseItem.request;
  const rows: { label: string; value: string }[] = [];
  if (d.vehicle_drivable !== null) {
    rows.push({
      label: "Araç hareketli mi",
      value: d.vehicle_drivable ? "Kısmen" : "Hayır",
    });
  }
  if (d.location_label) {
    rows.push({ label: "Alış noktası", value: d.location_label });
  }
  if (d.dropoff_label) {
    rows.push({ label: "Bırakılacak", value: d.dropoff_label });
  }
  const chips: { label: string; tone?: "warning" | "accent" | "info" }[] = [];
  if (d.emergency_acknowledged)
    chips.push({ label: "Acil kurtarma", tone: "warning" });
  if (d.pickup_preference === "pickup")
    chips.push({ label: "Pickup tercih", tone: "accent" });
  return (
    <DetailsCard
      title="Transfer detayı"
      description="Konum ve aciliyet"
      icon={ShieldCheck}
      iconColor="#83a7ff"
      rows={rows}
      chips={chips}
      notes={d.notes ? [d.notes] : undefined}
    />
  );
}

function LocationSection({ draft }: { draft: ServiceRequestDraft }) {
  return (
    <View className="gap-3">
      <SectionHeader title="Konum" description="Servis noktası ve varsa teslim" />
      <View className="gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
        {draft.location_label ? (
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500/15">
              <Icon icon={MapPin} size={14} color="#f45f25" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Noktası
              </Text>
              <Text variant="caption" tone="muted" className="text-[12px] text-app-text">
                {draft.location_label}
              </Text>
            </View>
          </View>
        ) : null}
        {draft.dropoff_label ? (
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-app-surface-2">
              <Icon icon={MapPin} size={14} color="#83a7ff" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Teslim
              </Text>
              <Text variant="caption" tone="muted" className="text-[12px] text-app-text">
                {draft.dropoff_label}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AttachmentsSection({
  attachments,
}: {
  attachments: ServiceCase["attachments"];
}) {
  return (
    <View className="gap-3">
      <SectionHeader
        title="Müşteri paylaşımları"
        description={`${attachments.length} dosya`}
      />
      <View className="flex-row flex-wrap gap-2">
        {attachments.map((attachment) => {
          const IconCmp =
            ATTACHMENT_ICON[attachment.kind as keyof typeof ATTACHMENT_ICON] ??
            FileText;
          return (
            <View
              key={attachment.id}
              className="w-[31%] gap-1.5 rounded-[14px] border border-app-outline bg-app-surface-2 px-2 py-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-app-bg">
                <Icon icon={IconCmp} size={16} color="#83a7ff" />
              </View>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text text-[11px]"
                numberOfLines={2}
              >
                {attachment.title}
              </Text>
              {attachment.subtitle ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-subtle text-[10px]"
                  numberOfLines={1}
                >
                  {attachment.subtitle}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CompetingOffersSection({
  caseItem,
  myTechnicianId,
  contextState = "pool",
}: {
  caseItem: ServiceCase;
  myTechnicianId?: string;
  contextState?: CaseContextState;
}) {
  const accepted = caseItem.offers.find((o) => o.status === "accepted");
  const visible =
    contextState === "archive"
      ? accepted
        ? [accepted]
        : []
      : caseItem.offers;

  return (
    <View className="gap-2">
      {visible.map((offer) => {
        const isMine = offer.technician_id === myTechnicianId;
        const isAccepted = offer.status === "accepted";
        const badge =
          contextState !== "pool" && isAccepted ? (
            <View className="flex-row items-center gap-1 rounded-full border border-app-success/40 bg-app-success-soft px-2 py-0.5">
              <Icon icon={Lock} size={10} color="#2dd28d" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-success text-[10px]"
              >
                Kabul edildi
              </Text>
            </View>
          ) : isMine ? (
            <TrustBadge label="Senin teklifin" tone="success" />
          ) : (
            <TrustBadge label="Rakip" tone="neutral" />
          );
        return (
          <PremiumListRow
            key={offer.id}
            title={offer.headline}
            subtitle={`${offer.price_label} · ${offer.eta_label} · ${offer.delivery_mode}`}
            badge={badge}
          />
        );
      })}
    </View>
  );
}
