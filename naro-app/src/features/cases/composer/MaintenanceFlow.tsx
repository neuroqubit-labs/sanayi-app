import type {
  MaintenanceCategory,
  PricePreference,
  ServiceRequestDraft,
} from "@naro/domain";
import { FieldInput, Icon, StatusChip, Text, ToggleChip } from "@naro/ui";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  Image as ImageIcon,
  Info,
  KeySquare,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { CategoryTile } from "./components/CategoryTile";
import { ComposerSection } from "./components/ComposerSection";
import { EvidenceStepCard } from "./components/EvidenceStepCard";
import { LocationPicker } from "./components/LocationPicker";
import { QuestionDispatcher } from "./components/questionFields";
import { getMissingRequiredAttachmentCategories } from "../caseCreationContract";
import {
  MAINTENANCE_CATEGORY_LABEL,
  MAINTENANCE_PACKAGE_CATEGORIES,
  MAINTENANCE_SINGLE_CATEGORIES,
  MAINTENANCE_TEMPLATES,
  estimatePriceRange,
  type MaintenanceCategoryMeta,
  type MaintenanceTemplate,
} from "./data/maintenanceTemplates";
import type { ComposerFlow, ComposerStepRenderProps } from "./types";

const PREFERRED_WINDOWS = [
  "Bu hafta",
  "Önümüzdeki hafta",
  "Hafta içi",
  "Cumartesi",
  "Esnek",
];

const PRICE_OPTIONS: { value: PricePreference; label: string }[] = [
  { value: "any", label: "Fark etmez" },
  { value: "nearby", label: "Yakın olsun" },
  { value: "cheap", label: "Ucuz olsun" },
  { value: "fast", label: "Hızlı olsun" },
];

function summarizeServicePreferences(draft: ServiceRequestDraft): string {
  const parts: string[] = [];
  if (draft.on_site_repair) parts.push("Yerinde onarım");
  if (draft.valet_requested) parts.push("Vale servis");
  if (parts.length === 0) return "Servise ben götüreceğim";
  return parts.join(" · ");
}

function CategoryStep({ draft, updateDraft, goNext }: ComposerStepRenderProps) {
  const selected = draft.maintenance_category;

  const pickCategory = (id: MaintenanceCategoryMeta["id"]) => {
    updateDraft({
      maintenance_category: id,
      maintenance_items: [],
    });
    goNext();
  };

  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          Aracına ne yapılsın?
        </Text>
        <Text
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[16px]"
        >
          Paketler tek seferde birden çok iş alır. Tekli işler listeden.
        </Text>
      </View>

      <View className="gap-3">
        <Text variant="eyebrow" tone="subtle">
          Paketler
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {MAINTENANCE_PACKAGE_CATEGORIES.map((category) => (
            <View key={category.id} style={{ width: "48%" }}>
              <CategoryTile
                icon={category.icon}
                title={category.title}
                subtitle={category.subtitle}
                selected={selected === category.id}
                onPress={() => pickCategory(category.id)}
              />
            </View>
          ))}
        </View>
      </View>

      <View className="gap-3">
        <Text variant="eyebrow" tone="subtle">
          Tek işler
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {MAINTENANCE_SINGLE_CATEGORIES.map((category) => (
            <View key={category.id} style={{ width: "48%" }}>
              <CategoryTile
                icon={category.icon}
                title={category.title}
                subtitle={category.subtitle}
                selected={selected === category.id}
                onPress={() => pickCategory(category.id)}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function DetailStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const category = draft.maintenance_category;
  if (!category) {
    return (
      <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
        <Text tone="muted" className="text-app-text-muted">
          Önce 1. adımda bir kategori seç.
        </Text>
      </View>
    );
  }

  const template = MAINTENANCE_TEMPLATES[category];
  const HeroIcon = template.hero.icon;
  const estimate = estimatePriceRange(draft);

  return (
    <View className="gap-4">
      {/* Tek hero — eyebrow + title çift yazımı temizlendi, araç info satırı kaldırıldı */}
      <View className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/25 bg-brand-500/10 px-4 py-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-brand-500/20">
          <Icon icon={HeroIcon} size={18} color="#0ea5e9" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            variant="h3"
            tone="inverse"
            className="text-[15px] leading-[19px]"
          >
            {template.hero.title}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[16px]"
          >
            {template.hero.subtitle}
          </Text>
        </View>
      </View>

      {template.questions.map((question) => (
        <QuestionDispatcher
          key={question.id}
          question={question}
          symptoms={draft.maintenance_items}
          onChange={(next) => updateDraft({ maintenance_items: next })}
        />
      ))}

      {estimate ? (
        <View className="gap-3 rounded-[24px] border border-app-success/30 bg-app-success-soft px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Icon icon={TrendingUp} size={14} color="#2dd28d" />
              <Text variant="eyebrow" tone="subtle">
                Tahmini fiyat aralığı
              </Text>
            </View>
            <Text variant="caption" tone="muted" className="text-app-text-subtle">
              Referans
            </Text>
          </View>
          <Text variant="display" tone="success" className="text-[30px] leading-[34px]">
            {estimate.label}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
            Kesin ücret usta teklifinden netleşir. Seçimlerine göre bu aralık
            güncellenir.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MediaStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const category = draft.maintenance_category;
  if (!category) {
    return (
      <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
        <Text tone="muted" className="text-app-text-muted">
          Önce 1. adımda bir kategori seç.
        </Text>
      </View>
    );
  }

  const template = MAINTENANCE_TEMPLATES[category];
  const evidence = template.evidence;
  const mediaCount = draft.attachments.filter((attachment) =>
    evidence.some((step) => attachment.id.startsWith(`${step.id}:`)),
  ).length;

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/25 bg-brand-500/10 px-4 py-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-brand-500/20">
          <Icon icon={Camera} size={18} color="#0ea5e9" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            variant="h3"
            tone="inverse"
            className="text-[15px] leading-[19px]"
          >
            Fotoğraf ve not ekle
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[16px]"
          >
            Fotoğraf ve notlar teklifin kalitesini doğrudan etkiler.
          </Text>
        </View>
        <View className="items-end gap-0.5">
          <Text variant="label" tone="accent">
            {mediaCount}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[10px]"
          >
            Medya
          </Text>
        </View>
      </View>

      {evidence.map((step) => (
        <EvidenceStepCard
          key={step.id}
          step={step}
          attachments={draft.attachments}
          ownerRef={`draft:${draft.kind}:${draft.vehicle_id}:${step.id}`}
          onAdd={(drafts) =>
            updateDraft({ attachments: [...draft.attachments, ...drafts] })
          }
          onRemove={(attachmentId) =>
            updateDraft({
              attachments: draft.attachments.filter(
                (entry) => entry.id !== attachmentId,
              ),
            })
          }
        />
      ))}

      <ComposerSection title="Kısa not (opsiyonel)">
        <FieldInput
          value={draft.notes ?? ""}
          onChangeText={(value) => updateDraft({ notes: value })}
          placeholder="Beklentini ya da bilmesi gerekenleri kısaca yaz..."
          textarea
          rows={4}
          inputClassName="rounded-[20px]"
        />
      </ComposerSection>
    </View>
  );
}

function LogisticsStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const locationDescription =
    draft.on_site_repair || draft.valet_requested
      ? "Ustanın / vale servisinin geleceği adres"
      : "Bulunduğun semt / ilçe";

  return (
    <View className="gap-4">
      <LocationPicker
        value={draft.location_label}
        onChange={(next) => updateDraft({ location_label: next })}
        description={locationDescription}
      />

      <ComposerSection title="Zaman tercihi">
        <View className="flex-row flex-wrap gap-2">
          {PREFERRED_WINDOWS.map((window) => (
            <ToggleChip
              key={window}
              label={window}
              selected={draft.preferred_window === window}
              onPress={() =>
                updateDraft({
                  preferred_window:
                    draft.preferred_window === window ? undefined : window,
                })
              }
            />
          ))}
        </View>
      </ComposerSection>

      <ComposerSection
        title="Servis tercihlerin"
        description="Bunlar bir talep — usta uygun bulursa gelir. Zorunluluk yok."
      >
        <View className="gap-2.5">
          <CheckPreferenceRow
            icon={Home}
            title="Yerinde onarım istiyorum"
            subtitle="Mobil tamirci / servis sana gelsin"
            checked={draft.on_site_repair}
            onPress={() =>
              updateDraft({ on_site_repair: !draft.on_site_repair })
            }
          />
          <CheckPreferenceRow
            icon={KeySquare}
            title="Vale servis istiyorum"
            subtitle="Aracı alıp götürsün, işlem sonrası getirsin"
            checked={draft.valet_requested}
            onPress={() =>
              updateDraft({ valet_requested: !draft.valet_requested })
            }
          />
        </View>
      </ComposerSection>

      <ComposerSection title="Öncelik tercihin?">
        <View className="flex-row flex-wrap gap-2">
          {PRICE_OPTIONS.map((option) => (
            <ToggleChip
              key={option.value}
              label={option.label}
              selected={draft.price_preference === option.value}
              onPress={() =>
                updateDraft({
                  price_preference:
                    draft.price_preference === option.value
                      ? null
                      : option.value,
                })
              }
            />
          ))}
        </View>
      </ComposerSection>
    </View>
  );
}

type CheckPreferenceRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  checked: boolean;
  onPress: () => void;
};

function CheckPreferenceRow({
  icon,
  title,
  subtitle,
  checked,
  onPress,
}: CheckPreferenceRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
        checked
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "h-11 w-11 items-center justify-center rounded-[14px] border",
          checked
            ? "border-brand-500/40 bg-brand-500/20"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        <Icon icon={icon} size={20} color={checked ? "#0ea5e9" : "#83a7ff"} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {title}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {subtitle}
        </Text>
      </View>
      <View
        className={[
          "h-6 w-6 items-center justify-center rounded-[8px] border",
          checked
            ? "border-brand-500 bg-brand-500"
            : "border-app-outline bg-app-surface",
        ].join(" ")}
      >
        {checked ? <Icon icon={Check} size={14} color="#ffffff" /> : null}
      </View>
    </Pressable>
  );
}

function ReviewStep({ draft }: ComposerStepRenderProps) {
  const [showPriceInfo, setShowPriceInfo] = useState(false);
  const category = draft.maintenance_category;
  const template = category ? MAINTENANCE_TEMPLATES[category] : null;
  const categoryLabel = category
    ? MAINTENANCE_CATEGORY_LABEL[category]
    : "—";
  const groups = groupMaintenanceItems(draft.maintenance_items, category);
  const totalEntries = groups.reduce(
    (sum, group) => sum + group.options.length,
    0,
  );
  const evidenceSteps = template?.evidence ?? [];
  const mediaCount = draft.attachments.filter((attachment) =>
    evidenceSteps.some((step) => attachment.id.startsWith(`${step.id}:`)),
  ).length;
  const servicePreferenceLabel = summarizeServicePreferences(draft);
  const hasAnyPreference = draft.on_site_repair || draft.valet_requested;
  const priceLabel =
    PRICE_OPTIONS.find((option) => option.value === draft.price_preference)
      ?.label ?? "Fark etmez";
  const estimate = estimatePriceRange(draft);

  return (
    <View className="gap-4">
      {estimate ? (
        <View className="gap-1 rounded-[22px] border border-app-success/30 bg-app-success-soft px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text variant="eyebrow" tone="subtle">
              Tahmini fiyat aralığı
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fiyat aralığı nasıl hesaplanır?"
              hitSlop={8}
              onPress={() => setShowPriceInfo((prev) => !prev)}
              className="h-6 w-6 items-center justify-center rounded-full border border-app-outline bg-app-surface active:bg-app-surface-2"
            >
              <Icon icon={Info} size={11} color="#83a7ff" />
            </Pressable>
          </View>
          <Text
            variant="display"
            tone="success"
            className="text-[32px] leading-[36px]"
          >
            {estimate.label}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Seçimlerine göre hesaplandı. Kesin ücret teklif aşamasında netleşir.
          </Text>
          {showPriceInfo ? (
            <View className="mt-2 gap-1 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2">
              <Text
                variant="eyebrow"
                tone="subtle"
                className="text-[10px]"
              >
                Nasıl hesaplandı?
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px] leading-[16px]"
              >
                Naro'daki benzer seçimli taleplerin ortalama teklif aralığı.
                Ustaların gerçek teklifi bu aralığın dışında olabilir.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
        <SummaryRow label="Kategori" value={categoryLabel} />
        {groups.map((group) => (
          <SummaryRow
            key={group.question.id}
            label={group.question.title}
            value={group.options
              .map((option) => resolveOptionLabel(group.question, option))
              .join(" · ")}
          />
        ))}
        {totalEntries === 0 ? (
          <SummaryRow label="Seçimler" value="Henüz yok" tone="warning" />
        ) : null}
        <SummaryRow
          label="Medya"
          value={mediaCount > 0 ? `${mediaCount} dosya` : "Yok"}
        />
        <SummaryRow
          label="Servis tercihi"
          value={servicePreferenceLabel}
          tone={hasAnyPreference ? "accent" : "neutral"}
        />
        <SummaryRow
          label="Konum"
          value={draft.location_label || "—"}
          tone={draft.location_label ? "neutral" : "warning"}
        />
        <SummaryRow
          label="Zaman"
          value={draft.preferred_window ?? "Belirtilmedi"}
        />
        <SummaryRow label="Öncelik" value={priceLabel} />
      </View>

      <AccordionRow
        title="Tüm seçimlerin"
        count={totalEntries}
        icon={Sparkles}
        defaultOpen={false}
      >
        {groups.length > 0 ? (
          groups.map((group) => (
            <View key={group.question.id} className="gap-2">
              <Text variant="eyebrow" tone="subtle">
                {group.question.title}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {group.options.map((option) => (
                  <StatusChip
                    key={option}
                    label={resolveOptionLabel(group.question, option)}
                    tone="info"
                  />
                ))}
              </View>
            </View>
          ))
        ) : (
          <Text tone="muted" className="text-app-text-muted">
            Henüz seçim yok.
          </Text>
        )}
      </AccordionRow>

      <AccordionRow
        title="Medya"
        count={mediaCount}
        icon={ImageIcon}
        defaultOpen={false}
      >
        {evidenceSteps.map((step) => {
          const count = draft.attachments.filter((attachment) =>
            attachment.id.startsWith(`${step.id}:`),
          ).length;
          return (
            <View
              key={step.id}
              className="flex-row items-center justify-between gap-3 rounded-[16px] border border-app-outline bg-app-surface px-3.5 py-3"
            >
              <Text variant="label" tone="inverse" className="flex-1">
                {step.title}
              </Text>
              <StatusChip
                label={`${count} adet`}
                tone={count > 0 ? "success" : "neutral"}
              />
            </View>
          );
        })}
      </AccordionRow>

      {draft.notes ? (
        <AccordionRow title="Not" icon={Sparkles} defaultOpen>
          <View className="rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
            <Text tone="muted" className="text-app-text-muted leading-5">
              {draft.notes}
            </Text>
          </View>
        </AccordionRow>
      ) : null}
    </View>
  );
}

type QuestionRef = MaintenanceTemplate["questions"][number];

type GroupedQuestion = {
  question: QuestionRef;
  options: string[];
};

function groupMaintenanceItems(
  items: string[],
  category: MaintenanceCategory | null,
): GroupedQuestion[] {
  if (!category) return [];
  const groups: GroupedQuestion[] = [];
  for (const question of MAINTENANCE_TEMPLATES[category].questions) {
    const prefix = `${question.id}:`;
    const options = items
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length));
    if (options.length > 0) {
      groups.push({ question, options });
    }
  }
  return groups;
}

function resolveOptionLabel(question: QuestionRef, value: string): string {
  if (question.kind === "icon_grid") {
    return question.items.find((item) => item.id === value)?.label ?? value;
  }
  return value;
}

type SummaryRowProps = {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "critical" | "accent";
};

function SummaryRow({ label, value, tone = "neutral" }: SummaryRowProps) {
  const valueTone: "inverse" | "success" | "warning" | "critical" | "accent" =
    tone === "neutral" ? "inverse" : tone;
  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-app-outline/60 pb-2 last:border-0 last:pb-0">
      <Text variant="caption" tone="muted" className="text-app-text-muted">
        {label}
      </Text>
      <Text variant="label" tone={valueTone}>
        {value}
      </Text>
    </View>
  );
}

type AccordionRowProps = {
  title: string;
  icon: LucideIcon;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function AccordionRow({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: AccordionRowProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((prev) => !prev)}
        className="flex-row items-center gap-3"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
          <Icon icon={icon} size={16} color="#83a7ff" />
        </View>
        <Text variant="label" tone="inverse" className="flex-1">
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </Text>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} color="#83a7ff" />
      </Pressable>
      {open ? <View className="gap-3 pt-1">{children}</View> : null}
    </View>
  );
}

export const MAINTENANCE_FLOW: ComposerFlow = {
  kind: "maintenance",
  eyebrow: "",
  title: "Bakım talebi oluştur",
  description: "",
  progressVariant: "bar-thin",
  submitLabel: "Bakım talebimi gönder",
  steps: [
    {
      key: "maintenance_category",
      title: "Kategori",
      description: "Aracına ne yapılsın?",
      validate: (draft) =>
        draft.maintenance_category ? null : "Bir kategori seç.",
      render: (props) => <CategoryStep {...props} />,
      hideFooter: true,
    },
    {
      key: "maintenance_detail",
      title: "Detay",
      description: "Tercihlerini işaretle",
      validate: (draft) =>
        draft.maintenance_items.length === 0
          ? "Kapsam seçimi bekleniyor."
          : null,
      render: (props) => <DetailStep {...props} />,
    },
    {
      key: "maintenance_media",
      title: "Bağlam",
      description: "Usta için bağlam ekle",
      validate: (draft) => {
        const missing = getMissingRequiredAttachmentCategories(
          "maintenance",
          draft,
        );
        return missing.length > 0 ? `${missing[0]!.label} eksik.` : null;
      },
      render: (props) => <MediaStep {...props} />,
    },
    {
      key: "maintenance_logistics",
      title: "Konum",
      description: "Adres ve tercihler",
      validate: (draft) =>
        draft.location_label.trim().length >= 3 ? null : "Konum gerekli.",
      render: (props) => <LogisticsStep {...props} />,
    },
    {
      key: "maintenance_review",
      title: "Önizleme",
      description: "Son kontrol",
      validate: () => null,
      render: (props) => <ReviewStep {...props} />,
      isTerminal: true,
    },
  ],
};
