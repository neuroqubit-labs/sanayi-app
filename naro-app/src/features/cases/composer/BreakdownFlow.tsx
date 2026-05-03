import type {
  BreakdownCategory,
  PricePreference,
  ServiceRequestDraft,
} from "@naro/domain";
import {
  GesturePressable as Pressable,
  Icon,
  StatusChip,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import {
  AlertTriangle,
  Camera,
  Check,
  CircleEllipsis,
  Home,
  Image as ImageIcon,
  KeySquare,
  type LucideIcon,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { TextInput, View } from "react-native";

import { CategoryTile } from "./components/CategoryTile";
import { ComposerSection } from "./components/ComposerSection";
import { EvidenceStepCard } from "./components/EvidenceStepCard";
import { LocationPicker } from "./components/LocationPicker";
import { QuestionDispatcher } from "./components/questionFields";
import {
  BREAKDOWN_CATEGORIES,
  BREAKDOWN_CATEGORY_LABEL,
  BREAKDOWN_TEMPLATES,
  SEVERITY_LABEL,
  computeSeverityHint,
  type BreakdownTemplate,
} from "./data/breakdownTemplates";
import type { ComposerFlow, ComposerStepRenderProps } from "./types";
import { summarizeServicePreferences } from "./utils/summary";

const INPUT_CLASS =
  "rounded-[20px] border border-app-outline bg-app-surface px-4 py-3 text-base text-app-text";

const PREFERRED_WINDOWS = [
  "Şimdi",
  "Bugün",
  "Yarın sabah",
  "Yarın öğleden sonra",
  "Hafta içi",
  "Esnek",
];

const PRICE_OPTIONS: { value: PricePreference; label: string }[] = [
  { value: "any", label: "Fark etmez" },
  { value: "nearby", label: "Yakın olsun" },
  { value: "cheap", label: "Ucuz olsun" },
  { value: "fast", label: "Hızlı olsun" },
];

function CategoryStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const selected = draft.breakdown_category;
  const template = selected ? BREAKDOWN_TEMPLATES[selected] : null;

  return (
    <View className="gap-4">
      {selected && template ? (
        <SelectedCategoryHeader
          category={BREAKDOWN_CATEGORIES.find((item) => item.id === selected)}
          onClear={() =>
            updateDraft({
              breakdown_category: null,
              symptoms: [],
            })
          }
        />
      ) : (
        <>
          <Text
            tone="muted"
            className="text-app-text-muted text-[15px] leading-[21px]"
          >
            En baskın alanı seç. Sonra birkaç belirtiyle ustaya net bir tablo
            çıkaracağız.
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {BREAKDOWN_CATEGORIES.map((category) => (
              <View key={category.id} style={{ width: "48%" }}>
                <CategoryTile
                  icon={category.icon}
                  title={category.title}
                  subtitle={category.subtitle}
                  density="compact"
                  selected={false}
                  onPress={() =>
                    updateDraft({
                      breakdown_category: category.id,
                      symptoms: [],
                    })
                  }
                />
              </View>
            ))}
          </View>
        </>
      )}

      {selected && template ? (
        <View className="gap-3">
          <View className="gap-1">
            <Text variant="h3" tone="inverse" className="text-[18px] leading-[23px]">
              {template.hero.title}
            </Text>
            <Text
              tone="muted"
              className="text-app-text-muted text-[13px] leading-[18px]"
            >
              {template.hero.subtitle}
            </Text>
          </View>

          {template.questions.map((question) => (
            <QuestionDispatcher
              key={question.id}
              question={question}
              symptoms={draft.symptoms}
              onChange={(next) => updateDraft({ symptoms: next })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SelectedCategoryHeader({
  category,
  onClear,
}: {
  category?: (typeof BREAKDOWN_CATEGORIES)[number];
  onClear: () => void;
}) {
  const icon = category?.icon ?? CircleEllipsis;
  return (
    <View className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/30 bg-brand-500/10 px-3.5 py-2.5">
      <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-brand-500/20">
        <Icon icon={icon} size={19} color="#0ea5e9" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="caption" tone="accent" className="text-[11px] leading-[14px]">
          Seçili alan
        </Text>
        <Text variant="h3" tone="inverse" className="text-[16px] leading-[20px]">
          {category?.title ?? "Arıza"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Arıza kategorisini değiştir"
        onPress={onClear}
        className="rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:opacity-90"
      >
        <Text variant="caption" tone="accent">
          Değiştir
        </Text>
      </Pressable>
    </View>
  );
}

type ServicePreferenceCheckProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
};

function ServicePreferenceCheck({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: ServicePreferenceCheckProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={{ width: "100%" }}
      contentStyle={{ minHeight: 62 }}
      className={[
        "w-full flex-row items-center gap-3 rounded-[18px] border px-3.5 py-3 active:opacity-90",
        selected
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "h-8 w-8 items-center justify-center rounded-[12px] border",
          selected
            ? "border-brand-500/40 bg-brand-500/20"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        <Icon icon={icon} size={15} color={selected ? "#0ea5e9" : "#83a7ff"} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          variant="label"
          tone="inverse"
          className="text-[13px] leading-[17px]"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[16px]"
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      <View
        className={[
          "h-5 w-5 items-center justify-center rounded-full border",
          selected
            ? "border-brand-500 bg-brand-500"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        {selected ? <Icon icon={Check} size={10} color="#ffffff" /> : null}
      </View>
    </Pressable>
  );
}

function EvidenceStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const category = draft.breakdown_category;
  if (!category) {
    return (
      <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
        <Text tone="muted" className="text-app-text-muted">
          Önce 1. adımda bir kategori seç.
        </Text>
      </View>
    );
  }

  const template = BREAKDOWN_TEMPLATES[category];
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
            Usta için ipucu
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[16px]"
          >
            Fotoğraf veya ses, ustanın daha net teklif vermesine yardım eder.
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

      <ComposerSection
        title="Kısa not"
        description="Fotoğraf veya sesi eklerken aklına gelen detayı buraya yaz."
      >
        <TextInput
          value={draft.notes ?? ""}
          onChangeText={(value) => updateDraft({ notes: value })}
          placeholder="Ne zaman başladı, hangi durumda artıyor?"
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className={[INPUT_CLASS, "min-h-[82px] py-3"].join(" ")}
        />
      </ComposerSection>
    </View>
  );
}

function LogisticsStep({ draft, updateDraft }: ComposerStepRenderProps) {
  return (
    <View className="gap-3.5">
      <LocationPicker
        title="Adres"
        value={draft.location_label}
        onChange={(next) => updateDraft({ location_label: next })}
        coord={draft.location_lat_lng ?? null}
        onCoordChange={(next) => updateDraft({ location_lat_lng: next })}
        description="Ustanın göreceği çalışma konumu"
        compactAccessory={
          <View className="gap-1.5">
            <Text variant="caption" tone="subtle" className="text-[11px]">
              Servis tercihi
            </Text>
            <View className="gap-2">
              <ServicePreferenceCheck
                icon={Home}
                title="Yerinde tamir"
                subtitle="Usta bulunduğun yere gelsin."
                selected={draft.on_site_repair}
                onPress={() =>
                  updateDraft({ on_site_repair: !draft.on_site_repair })
                }
              />
              <ServicePreferenceCheck
                icon={KeySquare}
                title="Vale"
                subtitle="Aracı alıp onarım sonrası geri getirsin."
                selected={draft.valet_requested}
                onPress={() =>
                  updateDraft({ valet_requested: !draft.valet_requested })
                }
              />
            </View>
          </View>
        }
        compact
      />

      <ComposerSection title="Zaman ve öncelik">
        <View className="gap-3">
          <View className="gap-2">
            <Text variant="caption" tone="subtle">
              Ne zaman uygun?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {PREFERRED_WINDOWS.map((window) => (
                <ToggleChip
                  key={window}
                  label={window}
                  size="sm"
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
          </View>

          <View className="gap-2">
            <Text variant="caption" tone="subtle">
              Teklifte ne öne çıksın?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {PRICE_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.value}
                  label={option.label}
                  size="sm"
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
          </View>
        </View>
      </ComposerSection>
    </View>
  );
}

function ReviewStep({ draft }: ComposerStepRenderProps) {
  const category = draft.breakdown_category;
  const template = category ? BREAKDOWN_TEMPLATES[category] : null;
  const categoryLabel = category ? BREAKDOWN_CATEGORY_LABEL[category] : "—";
  const symptomsByQuestion = groupSymptoms(draft.symptoms, category);
  const totalSymptomEntries = symptomsByQuestion.reduce(
    (sum, group) => sum + group.options.length,
    0,
  );
  const topLabels = symptomsByQuestion
    .flatMap((group) =>
      group.options.map((option) => resolveOptionLabel(group.question, option)),
    )
    .slice(0, 3);
  const symptomsSummary =
    totalSymptomEntries === 0
      ? "Seçilmedi"
      : totalSymptomEntries <= 3
        ? topLabels.join(" · ")
        : `${topLabels.join(" · ")} · +${totalSymptomEntries - 3} daha`;
  const evidenceSteps = template?.evidence ?? [];
  const mediaCount = draft.attachments.filter((attachment) =>
    evidenceSteps.some((step) => attachment.id.startsWith(`${step.id}:`)),
  ).length;
  const servicePreferenceLabel = summarizeServicePreferences(
    draft,
    "Servise ben götüreceğim",
  );
  const hasAnyPreference =
    draft.on_site_repair || draft.valet_requested;
  const priceLabel =
    PRICE_OPTIONS.find((option) => option.value === draft.price_preference)
      ?.label ?? "Fark etmez";
  const severity = computeSeverityHint(draft);

  return (
    <View className="gap-3.5">
      <View className="gap-4 rounded-[28px] border border-app-outline bg-app-surface px-5 py-5">
        <View className="flex-row flex-wrap items-center gap-2">
          <TrustBadge label="Önizleme" tone="info" />
          {severity !== "low" ? (
            <StatusChip
              label={SEVERITY_LABEL[severity]}
              tone={severity === "high" ? "critical" : "warning"}
              icon={AlertTriangle}
            />
          ) : null}
        </View>

        <View className="gap-2">
          <Text variant="h2" tone="inverse" className="text-[25px] leading-[31px]">
            {categoryLabel}
          </Text>
          <Text
            tone="muted"
            className="text-app-text-muted text-[15px] leading-[21px]"
          >
            {symptomsSummary === "Seçilmedi"
              ? "Seçtiğin bilgiler ustaya düzenli bir vaka dosyası olarak gönderilecek."
              : symptomsSummary}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <PreviewPill
            label={draft.location_label ? "Konum hazır" : "Konum eksik"}
            tone={draft.location_label ? "accent" : "warning"}
          />
          <PreviewPill
            label={mediaCount > 0 ? `${mediaCount} medya` : "Medya yok"}
            tone={mediaCount > 0 ? "success" : "neutral"}
          />
          <PreviewPill
            label={draft.preferred_window ?? "Zaman esnek"}
            tone="neutral"
          />
        </View>
      </View>

      <PreviewPanel title="Vaka dosyası">
        <PreviewFact label="Arıza alanı" value={categoryLabel} />
        <PreviewFact
          label="Konum"
          value={draft.location_label || "Konum belirtilmedi"}
          tone={draft.location_label ? "neutral" : "warning"}
        />
        <PreviewFact
          label="Zaman"
          value={draft.preferred_window ?? "Esnek"}
        />
        <PreviewFact
          label="Servis tercihi"
          value={servicePreferenceLabel}
          tone={hasAnyPreference ? "accent" : "neutral"}
        />
        <PreviewFact label="Teklif önceliği" value={priceLabel} />
      </PreviewPanel>

      {symptomsByQuestion.length > 0 ? (
        <PreviewPanel title="Belirtiler">
          {symptomsByQuestion.map((group) => (
            <View key={group.question.id} className="gap-2">
              <Text variant="caption" tone="subtle" className="text-[11px]">
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
          ))}
        </PreviewPanel>
      ) : null}

      {mediaCount > 0 ? (
        <PreviewPanel title="Eklenen medya">
          {evidenceSteps.map((step) => {
            const count = draft.attachments.filter((attachment) =>
              attachment.id.startsWith(`${step.id}:`),
            ).length;
            if (count === 0) return null;
            return (
              <View
                key={step.id}
                className="flex-row items-center justify-between gap-3 rounded-[16px] border border-app-outline bg-app-surface px-3.5 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Icon icon={ImageIcon} size={15} color="#83a7ff" />
                  <Text variant="label" tone="inverse">
                    {step.title}
                  </Text>
                </View>
                <StatusChip label={`${count} adet`} tone="success" />
              </View>
            );
          })}
        </PreviewPanel>
      ) : null}

      {draft.notes ? (
        <PreviewPanel title="Kısa not">
          <View className="rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
            <Text tone="muted" className="text-app-text-muted leading-5">
              {draft.notes}
            </Text>
          </View>
        </PreviewPanel>
      ) : null}
    </View>
  );
}

type BreakdownQuestionRef = BreakdownTemplate["questions"][number];

type GroupedQuestion = {
  question: BreakdownQuestionRef;
  options: string[];
};

function groupSymptoms(
  symptoms: string[],
  category: BreakdownCategory | null,
): GroupedQuestion[] {
  if (!category) return [];
  const groups: GroupedQuestion[] = [];
  for (const question of BREAKDOWN_TEMPLATES[category].questions) {
    const prefix = `${question.id}:`;
    const options = symptoms
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length));
    if (options.length > 0) {
      groups.push({ question, options });
    }
  }
  return groups;
}

function resolveOptionLabel(
  question: BreakdownQuestionRef,
  value: string,
): string {
  if (question.kind === "chips") {
    return value;
  }
  if (question.kind === "icon_grid") {
    return question.items.find((item) => item.id === value)?.label ?? value;
  }
  return value;
}

type PreviewTone = "neutral" | "success" | "warning" | "critical" | "accent";

function PreviewPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-[24px] border border-app-outline bg-app-surface-2 px-4 py-4">
      <Text variant="h3" tone="inverse" className="text-[17px] leading-[22px]">
        {title}
      </Text>
      <View className="gap-2.5">{children}</View>
    </View>
  );
}

function PreviewFact({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: PreviewTone;
}) {
  const valueTone: "inverse" | "success" | "warning" | "critical" | "accent" =
    tone === "neutral" ? "inverse" : tone;
  return (
    <View className="gap-1 rounded-[17px] border border-app-outline bg-app-surface px-3.5 py-3">
      <Text variant="caption" tone="subtle" className="text-[10px]">
        {label}
      </Text>
      <Text
        variant="label"
        tone={valueTone}
        className="text-[13px] leading-[17px]"
      >
        {value}
      </Text>
    </View>
  );
}

function PreviewPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: PreviewTone;
}) {
  const toneClass: Record<PreviewTone, string> = {
    neutral: "border-app-outline bg-app-surface-2",
    success: "border-app-success/30 bg-app-success-soft",
    warning: "border-app-warning/30 bg-app-warning-soft",
    critical: "border-app-critical/30 bg-app-critical-soft",
    accent: "border-brand-500/30 bg-brand-500/10",
  };
  const textTone: "inverse" | "success" | "warning" | "critical" | "accent" =
    tone === "neutral" ? "inverse" : tone;

  return (
    <View
      className={[
        "rounded-full border px-3 py-1.5",
        toneClass[tone],
      ].join(" ")}
    >
      <Text variant="caption" tone={textTone} className="text-[11px]">
        {label}
      </Text>
    </View>
  );
}

export const BREAKDOWN_FLOW: ComposerFlow = {
  kind: "breakdown",
  eyebrow: "",
  title: "Arıza bildirimi",
  description: "",
  progressVariant: "bar-thin",
  submitLabel: "Vakayı oluştur",
  steps: [
    {
      key: "breakdown_category",
      title: "Kategori + belirti",
      description: "Ne oluyor?",
      validate: (draft) => {
        if (!draft.breakdown_category) return "Bir kategori seç.";
        if (draft.symptoms.length === 0) return "En az bir belirti seç.";
        return null;
      },
      render: (props) => <CategoryStep {...props} />,
    },
    {
      key: "breakdown_media",
      title: "Fotoğraf ve ses",
      description: "İstersen ustaya ipucu ekle",
      validate: () => null,
      render: (props) => <EvidenceStep {...props} />,
      optional: true,
    },
    {
      key: "breakdown_service",
      title: "Konum + zaman",
      description: "Nerede ve ne zaman?",
      validate: (draft) =>
        draft.location_label.trim().length >= 3 ? null : "Konum gerekli.",
      render: (props) => <LogisticsStep {...props} />,
    },
    {
      key: "breakdown_review",
      title: "Önizleme",
      description: "Son kontrol",
      validate: () => null,
      render: (props) => <ReviewStep {...props} />,
      isTerminal: true,
    },
  ],
};
