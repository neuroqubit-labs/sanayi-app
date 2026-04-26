import type {
  BreakdownCategory,
  PricePreference,
  ServiceRequestDraft,
} from "@naro/domain";
import {
  Icon,
  StatusChip,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import {
  AlertTriangle,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  Image as ImageIcon,
  KeySquare,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

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

function summarizeServicePreferences(draft: ServiceRequestDraft): string {
  const parts: string[] = [];
  if (draft.on_site_repair) parts.push("Yerinde onarım");
  if (draft.valet_requested) parts.push("Vale servis");
  if (parts.length === 0) return "Servise ben götüreceğim";
  return parts.join(" · ");
}

function CategoryStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const selected = draft.breakdown_category;
  const template = selected ? BREAKDOWN_TEMPLATES[selected] : null;

  return (
    <View className="gap-4">
      <Text
        tone="muted"
        className="text-app-text-muted text-[13px] leading-[18px]"
      >
        Ne oluyor? En baskın alanı seç — sonra belirtileri işaretle.
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {BREAKDOWN_CATEGORIES.map((category) => (
          <View key={category.id} style={{ width: "48%" }}>
            <CategoryTile
              icon={category.icon}
              title={category.title}
              subtitle={category.subtitle}
              selected={selected === category.id}
              onPress={() =>
                updateDraft({
                  breakdown_category:
                    selected === category.id ? null : category.id,
                  symptoms: selected === category.id ? draft.symptoms : [],
                })
              }
            />
          </View>
        ))}
      </View>

      {selected && template ? (
        <View className="gap-4">
          <View className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/25 bg-brand-500/10 px-4 py-3.5">
            <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-brand-500/20">
              <Icon icon={template.hero.icon} size={18} color="#0ea5e9" />
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
              symptoms={draft.symptoms}
              onChange={(next) => updateDraft({ symptoms: next })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function VehicleStateStep({
  draft,
  updateDraft,
}: ComposerStepRenderProps) {
  const drivable = draft.vehicle_drivable;

  return (
    <View className="gap-4">
      <Text
        tone="muted"
        className="text-app-text-muted text-[13px] leading-[18px]"
      >
        Aracın ne durumda? Buna göre teklifler + servis şekli yönleniyor.
      </Text>

      <ComposerSection title="Sürülebiliyor mu?">
        <View className="gap-2">
          <DrivableOption
            title="Evet, sürülebiliyor"
            subtitle="Aracı servise ben götürebilirim"
            selected={drivable === true}
            onPress={() =>
              updateDraft({ vehicle_drivable: true })
            }
          />
          <DrivableOption
            title="Hayır, sürülemiyor"
            subtitle="Son adımda çekici ihtiyacını belirleyeceksin"
            selected={drivable === false}
            onPress={() =>
              updateDraft({ vehicle_drivable: false })
            }
          />
        </View>
      </ComposerSection>

      <ComposerSection
        title="Servis tercihlerin"
        description="Talep — usta uygun bulursa karşılar. Dayatma değil."
      >
        <View className="gap-2.5">
          <CheckPreferenceRow
            icon={Home}
            title="Yerinde onarım istiyorum"
            subtitle="Mobil tamirci sana gelsin"
            checked={draft.on_site_repair}
            onPress={() =>
              updateDraft({ on_site_repair: !draft.on_site_repair })
            }
          />
          <CheckPreferenceRow
            icon={KeySquare}
            title="Vale servis istiyorum"
            subtitle="Aracı alıp götürsün, onarıp getirsin"
            checked={draft.valet_requested}
            onPress={() =>
              updateDraft({ valet_requested: !draft.valet_requested })
            }
          />
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

function DrivableOption({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
        selected
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "h-10 w-10 items-center justify-center rounded-full border",
          selected
            ? "border-brand-500/40 bg-brand-500/20"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        <Icon
          icon={selected ? Check : Car}
          size={18}
          color={selected ? "#0ea5e9" : "#83a7ff"}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px]"
        >
          {subtitle}
        </Text>
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
            Kanıt tekliflerin kalitesini doğrudan etkiler. Ses kaydı da güçlü.
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
      <Text
        tone="muted"
        className="text-app-text-muted text-[13px] leading-[18px]"
      >
        Nerede ve ne zaman?
      </Text>

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

      <ComposerSection title="Açıklama (opsiyonel)">
        <TextInput
          value={draft.notes ?? ""}
          onChangeText={(value) => updateDraft({ notes: value })}
          placeholder="Ne zaman başladı, hangi koşullarda artıyor, daha önce müdahale oldu mu?"
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className={[INPUT_CLASS, "min-h-[110px] py-3"].join(" ")}
        />
      </ComposerSection>
    </View>
  );
}

function ReviewStep({ draft, updateDraft }: ComposerStepRenderProps) {
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
  const servicePreferenceLabel = summarizeServicePreferences(draft);
  const hasAnyPreference =
    draft.on_site_repair || draft.valet_requested;
  const priceLabel =
    PRICE_OPTIONS.find((option) => option.value === draft.price_preference)
      ?.label ?? "Fark etmez";
  const severity = computeSeverityHint(draft);
  const towingDesired = draft.towing_required;
  const towingDecisionMade = draft.towing_decision_made;

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
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
        <SummaryRow label="Arıza tipi" value={categoryLabel} />
        <SummaryRow
          label="Belirtiler"
          value={symptomsSummary}
          tone={totalSymptomEntries === 0 ? "warning" : "neutral"}
        />
        <SummaryRow
          label="Araç durumu"
          value={
            draft.vehicle_drivable === false
              ? "Sürülemiyor"
              : draft.vehicle_drivable === true
                ? "Sürülebiliyor"
                : "Belirtilmedi"
          }
          tone={draft.vehicle_drivable === false ? "warning" : "neutral"}
        />
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

      {/* Son karar: çekici ihtiyacı */}
      <View className="gap-2">
        <Text variant="eyebrow" tone="subtle">
          Aracın taşınması gerekiyor mu?
        </Text>
        <View className="gap-2">
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: towingDecisionMade && towingDesired === true }}
            accessibilityLabel="Evet, çekici istiyorum"
            onPress={() =>
              updateDraft({
                towing_decision_made: true,
                towing_required: true,
              })
            }
            className={[
              "flex-row items-center gap-3 rounded-[22px] px-5 py-4 active:opacity-90",
              towingDecisionMade && towingDesired
                ? "border border-app-warning/40 bg-app-warning-soft"
                : "border border-app-outline bg-app-surface",
            ].join(" ")}
          >
            <View
              className={[
                "h-11 w-11 items-center justify-center rounded-full",
                towingDecisionMade && towingDesired
                  ? "bg-app-warning/20"
                  : "bg-app-surface-2",
              ].join(" ")}
            >
              <Icon
                icon={Truck}
                size={22}
                color={
                  towingDecisionMade && towingDesired ? "#f5b33f" : "#83a7ff"
                }
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text
                variant="h3"
                tone={towingDecisionMade && towingDesired ? "warning" : "inverse"}
                className="text-[15px]"
              >
                Evet, çekici istiyorum
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px] leading-[16px]"
              >
                Vaka oluşturulduktan sonra çekici çağırma ekranına yönlendirilirsin
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: towingDecisionMade && towingDesired === false }}
            accessibilityLabel="Hayır, çekici gerekmiyor"
            onPress={() =>
              updateDraft({
                towing_decision_made: true,
                towing_required: false,
              })
            }
            className={[
              "flex-row items-center gap-3 rounded-[22px] px-5 py-4 active:opacity-90",
              towingDecisionMade && towingDesired === false
                ? "border border-brand-500/40 bg-brand-500/10"
                : "border border-app-outline bg-app-surface",
            ].join(" ")}
          >
            <View
              className={[
                "h-11 w-11 items-center justify-center rounded-full",
                towingDecisionMade && towingDesired === false
                  ? "bg-brand-500/20"
                  : "bg-app-surface-2",
              ].join(" ")}
            >
              <Icon
                icon={Car}
                size={22}
                color={
                  towingDecisionMade && towingDesired === false
                    ? "#0ea5e9"
                    : "#83a7ff"
                }
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text
                variant="h3"
                tone={
                  towingDecisionMade && towingDesired === false
                    ? "accent"
                    : "inverse"
                }
                className="text-[15px]"
              >
                Hayır, gerekmiyor
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px] leading-[16px]"
              >
                Aracı kendim götüreceğim veya yerinde onarım istiyorum
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <AccordionRow
        title="Tüm semptomlar"
        count={totalSymptomEntries}
        icon={Sparkles}
        defaultOpen={false}
      >
        {symptomsByQuestion.length > 0 ? (
          symptomsByQuestion.map((group) => (
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
            Semptom seçilmemiş.
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
        <AccordionRow title="Açıklama" icon={Sparkles} defaultOpen>
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

export const BREAKDOWN_FLOW: ComposerFlow = {
  kind: "breakdown",
  eyebrow: "",
  title: "Arıza bildirimi",
  description: "",
  progressVariant: "bar-thin",
  submitLabel: "Arıza bildirimimi gönder",
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
      key: "breakdown_drivable",
      title: "Araç durumu",
      description: "Aracın ne durumda?",
      validate: () => null,
      render: (props) => <VehicleStateStep {...props} />,
    },
    {
      key: "breakdown_media",
      title: "Kanıt",
      description: "Usta için ipucu ekle",
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
      validate: (draft) =>
        draft.towing_decision_made
          ? null
          : "Çekici gerekip gerekmediğini seç.",
      render: (props) => <ReviewStep {...props} />,
      isTerminal: true,
    },
  ],
};
