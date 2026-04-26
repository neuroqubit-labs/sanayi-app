import type { AccidentReportMethod } from "@naro/domain";
import {
  Icon,
  StatusChip,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  BookOpenCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  FileBadge,
  FileText,
  IdCard,
  Image as ImageIcon,
  ScrollText,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Linking, Platform, Pressable, TextInput, View } from "react-native";

import { useTowEntryRoute } from "@/features/tow/entry";

import { ComposerSection } from "./components/ComposerSection";
import { DocumentPickerRow } from "./components/DocumentPickerRow";
import { EvidenceStepCard } from "./components/EvidenceStepCard";
import { LocationPicker } from "./components/LocationPicker";
import { ACCIDENT_EVIDENCE_STEPS } from "./data/evidenceSteps";
import type { ComposerFlow, ComposerStepRenderProps } from "./types";

const INPUT_CLASS =
  "rounded-[20px] border border-app-outline bg-app-surface px-4 py-3 text-base text-app-text";

const COUNTERPARTY_OPTIONS: {
  value: "single" | "multi";
  label: string;
}[] = [
  { value: "single", label: "Tek taraflı" },
  { value: "multi", label: "Karşı taraflı" },
];

const VEHICLE_COUNT_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3+" },
];

const REPORT_OPTIONS: {
  value: AccidentReportMethod;
  title: string;
  subtitle: string;
  icon: typeof FileText;
}[] = [
  {
    value: "e_devlet",
    title: "E-Devlet tutanağı",
    subtitle: "Anlaşmalı kaza tutanağı dijital olarak yüklenir.",
    icon: ShieldCheck,
  },
  {
    value: "paper",
    title: "Kağıt tutanak",
    subtitle: "Fotoğrafı yükle, bildirim metne döker.",
    icon: ScrollText,
  },
  {
    value: "police",
    title: "Polis / jandarma raporu",
    subtitle: "Ekip geldiyse rapor numarasını paylaş.",
    icon: FileText,
  },
];

const REPORT_LABEL: Record<AccidentReportMethod, string> = {
  e_devlet: "E-Devlet tutanağı",
  paper: "Kağıt tutanak",
  police: "Polis / jandarma raporu",
};

const INSURANCE_BRANDS = [
  "Axa",
  "Allianz",
  "Anadolu",
  "Aksigorta",
  "Mapfre",
  "Sompo",
  "Türkiye Sigorta",
  "Zurich",
];

const OWN_DOCS: { id: string; title: string; icon: typeof IdCard; required: boolean }[] = [
  { id: "own_ehliyet", title: "Ehliyet", icon: IdCard, required: true },
  { id: "own_ruhsat", title: "Ruhsat", icon: FileText, required: true },
  { id: "own_sigorta", title: "Sigorta Poliçesi", icon: FileBadge, required: false },
];

const COUNTERPARTY_DOCS: { id: string; title: string; icon: typeof IdCard; required: boolean }[] = [
  { id: "cp_ehliyet", title: "Ehliyet", icon: IdCard, required: false },
  { id: "cp_ruhsat", title: "Ruhsat", icon: FileText, required: false },
  { id: "cp_sigorta", title: "Sigorta Poliçesi", icon: FileBadge, required: false },
];

function dialEmergency() {
  const number = "112";
  const url = Platform.OS === "ios" ? `telprompt:${number}` : `tel:${number}`;
  Linking.openURL(url).catch(() => {
    Alert.alert("Arama başlatılamadı", "Lütfen 112'yi manuel olarak arayın.");
  });
}

function EmergencyPanelStep({
  draft,
  updateDraft,
  goNext,
}: ComposerStepRenderProps) {
  const router = useRouter();
  const towEntry = useTowEntryRoute({
    vehicleId: draft.vehicle_id,
  });

  const handleTowingRedirect = () => {
    // Composer taslak state'te kalır — kullanıcı çekici akışından döndüğünde
    // kaldığı yerden devam eder. (Taslak kaydet pattern ayrı brief.)
    updateDraft({
      vehicle_drivable: false,
      towing_required: true,
    });
    router.push(towEntry.route);
  };

  return (
    <View className="gap-5">
      <View className="items-center gap-3 rounded-[28px] border border-app-outline-strong bg-app-surface-2 px-5 py-7">
        <View className="h-16 w-16 items-center justify-center rounded-[24px] border border-app-critical/30 bg-app-critical-soft">
          <Icon icon={AlertTriangle} size={32} color="#ff6b6b" />
        </View>
        <Text
          variant="display"
          tone="inverse"
          className="text-center text-[24px] leading-[28px]"
        >
          Önce güvende misin?
        </Text>
        <Text
          tone="muted"
          className="text-center text-app-text-muted leading-6"
        >
          Nefes al, acele yok. Güvendeysen aşağıda devam et. Ambulans lazımsa
          şuradan ara:{" "}
          <Text
            variant="label"
            tone="critical"
            className="underline"
            onPress={() => {
              updateDraft({ ambulance_contacted: true });
              dialEmergency();
            }}
          >
            📞 112 — Ambulans
          </Text>
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aracı çekici çekmesi lazım"
        onPress={handleTowingRedirect}
        className="flex-row items-center gap-3 rounded-[22px] border border-app-warning/30 bg-app-warning-soft px-5 py-4 active:opacity-90"
      >
        <View className="h-11 w-11 items-center justify-center rounded-full bg-app-warning/20">
          <Icon icon={Truck} size={20} color="#f5b33f" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="warning" className="text-[14px]">
            Aracı çekici çekmesi lazım
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Çekici ekranına yönlendirir, kaza talebi burada taslak kalır.
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Güvendeyim — devam et"
        onPress={() => {
          updateDraft({ emergency_acknowledged: true });
          goNext();
        }}
        className="items-center justify-center rounded-[22px] bg-brand-500 px-5 py-4 active:opacity-90"
      >
        <Text variant="label" className="text-white text-[15px]">
          Güvendeyim — devam et
        </Text>
      </Pressable>
    </View>
  );
}


function AccidentKindStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const selectedMode: "single" | "multi" | null = draft.counterparty_note
    ? draft.counterparty_note.includes("Karşı taraf")
      ? "multi"
      : "single"
    : null;
  const vehicleCount = draft.counterparty_vehicle_count;

  return (
    <View className="gap-4">
      <ComposerSection
        title="Kaza türü"
        description="Kazanın türünü seç; akışı buna göre kısaltıyoruz."
      >
        <View className="flex-row flex-wrap gap-2">
          {COUNTERPARTY_OPTIONS.map((option) => (
            <ToggleChip
              key={option.value}
              label={option.label}
              selected={selectedMode === option.value}
              onPress={() =>
                updateDraft({
                  counterparty_note:
                    option.value === "multi"
                      ? "Karşı taraf bilgisi toplanacak"
                      : "Tek taraflı — karşı taraf yok",
                  counterparty_vehicle_count:
                    option.value === "multi" ? (vehicleCount ?? 2) : null,
                })
              }
            />
          ))}
        </View>
      </ComposerSection>

      {selectedMode === "multi" ? (
        <ComposerSection
          title="Kaç araç karıştı?"
          description="Karşı taraf dahil toplam araç sayısı."
        >
          <View className="flex-row flex-wrap gap-2">
            {VEHICLE_COUNT_OPTIONS.map((option) => (
              <ToggleChip
                key={option.value}
                label={option.label}
                selected={vehicleCount === option.value}
                onPress={() =>
                  updateDraft({ counterparty_vehicle_count: option.value })
                }
              />
            ))}
          </View>
        </ComposerSection>
      ) : null}

      <ComposerSection
        title="Kısa açıklama"
        description="Durumu bir-iki cümleyle anlat — servisler önce bunu okuyor."
      >
        <TextInput
          value={draft.summary}
          onChangeText={(value) => updateDraft({ summary: value })}
          placeholder="Örn: Kavşakta sağdan gelen araç ön tampona çarptı."
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className={[INPUT_CLASS, "min-h-[92px] py-3"].join(" ")}
        />
      </ComposerSection>

      <LocationPicker
        value={draft.location_label}
        onChange={(next) => updateDraft({ location_label: next })}
        description="Kaza bölgesini doğru sinyallemek için konumun açılmalı."
      />

      <ComposerSection title="Aracın durumu">
        <View className="flex-row flex-wrap gap-2">
          <ToggleChip
            label="Sürülebiliyor"
            selected={draft.vehicle_drivable === true}
            onPress={() =>
              updateDraft({ vehicle_drivable: true, towing_required: false })
            }
          />
          <ToggleChip
            label="Sürülemiyor — yerinde"
            selected={draft.vehicle_drivable === false}
            onPress={() =>
              updateDraft({ vehicle_drivable: false, towing_required: true })
            }
          />
        </View>
      </ComposerSection>
    </View>
  );
}

function AccidentPhotosStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const photoCount = draft.attachments.filter((attachment) =>
    ACCIDENT_EVIDENCE_STEPS.some((step) =>
      attachment.id.startsWith(`${step.id}:`),
    ),
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
            Adım adım fotoğraf
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[16px]"
          >
            Panikleme — istediğin sırada çekebilirsin.
          </Text>
        </View>
        <View className="items-end gap-0.5">
          <Text variant="label" tone="accent">
            {photoCount}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[10px]"
          >
            Foto
          </Text>
        </View>
      </View>

      {ACCIDENT_EVIDENCE_STEPS.map((step) => (
        <EvidenceStepCard
          key={step.id}
          step={step}
          attachments={draft.attachments}
          ownerRef={`draft:${draft.kind}:${draft.vehicle_id}:${step.id}`}
          onAdd={(drafts) =>
            updateDraft({
              attachments: [...draft.attachments, ...drafts],
            })
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

function ReportStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const selected = draft.report_method;

  return (
    <ComposerSection
      title="Kaza tutanağı"
      description="Hangi yöntemle tutanak tuttun? Sonradan da değiştirebilirsin."
    >
      <View className="gap-2">
        {REPORT_OPTIONS.map((option) => {
          const isActive = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              onPress={() =>
                updateDraft({
                  report_method: isActive ? null : option.value,
                })
              }
              className={[
                "flex-row items-center gap-3 rounded-[22px] border px-4 py-3.5",
                isActive
                  ? "border-brand-500 bg-brand-500/15"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              <View
                className={[
                  "h-10 w-10 items-center justify-center rounded-full border",
                  isActive
                    ? "border-brand-500/40 bg-brand-500/15"
                    : "border-app-outline bg-app-surface-2",
                ].join(" ")}
              >
                <Icon
                  icon={option.icon}
                  size={18}
                  color={isActive ? "#0ea5e9" : "#83a7ff"}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse">
                  {option.title}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted"
                >
                  {option.subtitle}
                </Text>
              </View>
              {isActive ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-500">
                  <Icon icon={Check} size={12} color="#ffffff" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ComposerSection>
  );
}

function DocumentsStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const isMulti = draft.counterparty_note?.includes("Karşı taraf") ?? false;

  const onAdd = (drafts: Parameters<typeof updateDraft>[0] extends never
    ? never
    : { id: string }[]) => {
    updateDraft({ attachments: [...draft.attachments, ...(drafts as never)] });
  };

  const onRemove = (attachmentId: string) => {
    updateDraft({
      attachments: draft.attachments.filter(
        (entry) => entry.id !== attachmentId,
      ),
    });
  };

  return (
    <View className="gap-4">
      <ComposerSection
        title="Kendi belgelerin"
        description="Ehliyet, ruhsat ve sigorta poliçen süreci hızlandırır."
      >
        <View className="gap-2">
          {OWN_DOCS.map((doc) => (
            <DocumentPickerRow
              key={doc.id}
              id={doc.id}
              title={doc.title}
              icon={doc.icon}
              required={doc.required}
              attachments={draft.attachments}
              ownerRef={`draft:${draft.kind}:${draft.vehicle_id}:${doc.id}`}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          ))}
        </View>
      </ComposerSection>

      {isMulti ? (
        <ComposerSection
          title="Karşı taraf belgeleri"
          description="Fotoğrafını çekebildiğin belgeleri ekle."
        >
          <View className="gap-2">
            {COUNTERPARTY_DOCS.map((doc) => (
              <DocumentPickerRow
                key={doc.id}
                id={doc.id}
                title={doc.title}
                icon={doc.icon}
                attachments={draft.attachments}
                ownerRef={`draft:${draft.kind}:${draft.vehicle_id}:${doc.id}`}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            ))}
          </View>
        </ComposerSection>
      ) : null}

      <View className="flex-row items-start gap-3 rounded-[20px] border border-app-info/30 bg-app-info-soft px-4 py-3.5">
        <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-app-info/20">
          <Icon icon={Users} size={14} color="#83a7ff" />
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="flex-1 text-app-text-muted leading-5"
        >
          Eksik belgeleri daha sonra da ekleyebilirsin. Bildirim havuzuna
          düştüğünde eksik durumu ustalar ve sigorta şirketleri tarafından
          görülebilir.
        </Text>
      </View>
    </View>
  );
}

function InsuranceStep({ draft, updateDraft }: ComposerStepRenderProps) {
  return (
    <View className="gap-4">
      <ComposerSection
        title="Kasko ve sigorta tercihleri"
        description="Başvurmak istediğin kurumları seç. Bildirim otomatik dosyalanır."
      >
        <CheckboxRow
          label="Kaskoya başvurmak istiyorum"
          checked={draft.kasko_selected}
          onPress={() =>
            updateDraft({
              kasko_selected: !draft.kasko_selected,
              kasko_brand: draft.kasko_selected ? undefined : draft.kasko_brand,
            })
          }
        />
        {draft.kasko_selected ? (
          <BrandPicker
            selected={draft.kasko_brand}
            onSelect={(brand) => updateDraft({ kasko_brand: brand })}
          />
        ) : null}
      </ComposerSection>

      <ComposerSection title="Sigorta">
        <CheckboxRow
          label="Sigortaya başvurmak istiyorum"
          checked={draft.sigorta_selected}
          onPress={() =>
            updateDraft({
              sigorta_selected: !draft.sigorta_selected,
              sigorta_brand: draft.sigorta_selected
                ? undefined
                : draft.sigorta_brand,
            })
          }
        />
        {draft.sigorta_selected ? (
          <BrandPicker
            selected={draft.sigorta_brand}
            onSelect={(brand) => updateDraft({ sigorta_brand: brand })}
          />
        ) : null}
      </ComposerSection>

      <ComposerSection title="Ek not (opsiyonel)">
        <TextInput
          value={draft.notes ?? ""}
          onChangeText={(value) => updateDraft({ notes: value })}
          placeholder="Kasko / sigorta ile ilgili eklemek istediğin var mı?"
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className={[INPUT_CLASS, "min-h-[92px] py-3"].join(" ")}
        />
      </ComposerSection>
    </View>
  );
}

type CheckboxRowProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
};

function CheckboxRow({ label, checked, onPress }: CheckboxRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[18px] border border-app-outline bg-app-surface-2 px-3.5 py-3 active:bg-app-surface-3"
    >
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
      <Text variant="label" tone="inverse" className="flex-1">
        {label}
      </Text>
    </Pressable>
  );
}

type BrandPickerProps = {
  selected?: string;
  onSelect: (brand: string) => void;
};

function BrandPicker({ selected, onSelect }: BrandPickerProps) {
  return (
    <View className="gap-2 rounded-[18px] border border-app-outline bg-app-surface px-3.5 py-3">
      <Text variant="caption" tone="muted" className="text-app-text-muted">
        Kurum seç
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {INSURANCE_BRANDS.map((brand) => (
          <ToggleChip
            key={brand}
            label={brand}
            size="sm"
            selected={selected === brand}
            onPress={() => onSelect(brand)}
          />
        ))}
      </View>
    </View>
  );
}

function ReviewStep({ draft }: ComposerStepRenderProps) {
  const photoCount = draft.attachments.filter((attachment) =>
    ACCIDENT_EVIDENCE_STEPS.some((step) =>
      attachment.id.startsWith(`${step.id}:`),
    ),
  ).length;
  const ownDocsAdded = OWN_DOCS.filter((doc) =>
    draft.attachments.some((a) => a.id.startsWith(`${doc.id}:`)),
  );
  const counterpartyDocsAdded = COUNTERPARTY_DOCS.filter((doc) =>
    draft.attachments.some((a) => a.id.startsWith(`${doc.id}:`)),
  );
  const isMulti = draft.counterparty_note?.includes("Karşı taraf") ?? false;
  const missingOwn = OWN_DOCS.filter(
    (doc) => doc.required && !ownDocsAdded.some((d) => d.id === doc.id),
  ).length;
  const missingCp = isMulti
    ? COUNTERPARTY_DOCS.length - counterpartyDocsAdded.length
    : 0;
  const totalMissing = missingOwn + missingCp;

  const kazaTuruLabel = isMulti
    ? `Karşı taraflı${
        draft.counterparty_vehicle_count
          ? ` (${draft.counterparty_vehicle_count} araç)`
          : ""
      }`
    : "Tek taraflı";

  return (
    <View className="gap-4">
      <View className="gap-4 rounded-[28px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
        <View className="gap-1.5">
          <TrustBadge label="Önizleme" tone="info" icon={BookOpenCheck} />
          <Text variant="h2" tone="inverse">
            Bildirim özeti
          </Text>
          <Text tone="muted" className="text-app-text-muted leading-5">
            Bilgileri kontrol et. Onayladığında hasar havuzuna düşer, ustalar
            tekliflerini gönderebilir.
          </Text>
        </View>

        <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
          <SummaryRow
            label="Kaza türü"
            value={kazaTuruLabel}
          />
          <SummaryRow
            label="Ambulans"
            value={draft.ambulance_contacted ? "Çağrıldı" : "Çağrılmadı"}
            tone={draft.ambulance_contacted ? "critical" : "neutral"}
          />
          <SummaryRow
            label="Çekici"
            value={draft.towing_required ? "Çağrıldı" : "Gerekli değil"}
            tone={draft.towing_required ? "warning" : "neutral"}
          />
          <SummaryRow label="Fotoğraflar" value={`${photoCount} adet`} />
          <SummaryRow
            label="Tutanak"
            value={
              draft.report_method ? REPORT_LABEL[draft.report_method] : "Seçilmedi"
            }
          />
          <SummaryRow
            label="Eksik evrak"
            value={totalMissing === 0 ? "Yok" : `${totalMissing} adet`}
            tone={totalMissing > 0 ? "warning" : "success"}
          />
          <SummaryRow
            label="Kasko"
            value={
              draft.kasko_selected
                ? draft.kasko_brand ?? "Kurum seçilmedi"
                : "Kullanılmıyor"
            }
          />
          <SummaryRow
            label="Sigorta"
            value={
              draft.sigorta_selected
                ? draft.sigorta_brand ?? "Kurum seçilmedi"
                : "Kullanılmıyor"
            }
          />
        </View>
      </View>

      <AccordionRow
        title="Fotoğraflar"
        count={photoCount}
        icon={ImageIcon}
        defaultOpen={false}
      >
        {ACCIDENT_EVIDENCE_STEPS.map((step) => {
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

      <AccordionRow
        title="Evraklar"
        badge={totalMissing > 0 ? `${totalMissing} eksik` : "Tamam"}
        badgeTone={totalMissing > 0 ? "warning" : "success"}
        icon={FileText}
        defaultOpen={false}
      >
        <DocsGroup label="Kendi belgelerin" docs={OWN_DOCS} draft={draft} />
        {isMulti ? (
          <DocsGroup
            label="Karşı taraf belgeleri"
            docs={COUNTERPARTY_DOCS}
            draft={draft}
          />
        ) : null}
      </AccordionRow>

      <AccordionRow
        title="Açıklama"
        icon={ScrollText}
        defaultOpen
      >
        <View className="rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
          <Text tone="muted" className="text-app-text-muted leading-5">
            {draft.summary || "—"}
          </Text>
          {draft.location_label ? (
            <Text
              variant="caption"
              tone="muted"
              className="mt-2 text-app-text-subtle"
            >
              Konum · {draft.location_label}
            </Text>
          ) : null}
        </View>
      </AccordionRow>
    </View>
  );
}

type DocsGroupProps = {
  label: string;
  docs: typeof OWN_DOCS;
  draft: ComposerStepRenderProps["draft"];
};

function DocsGroup({ label, docs, draft }: DocsGroupProps) {
  return (
    <View className="gap-2">
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      {docs.map((doc) => {
        const added = draft.attachments.some((a) =>
          a.id.startsWith(`${doc.id}:`),
        );
        return (
          <View
            key={doc.id}
            className="flex-row items-center justify-between gap-3 rounded-[16px] border border-app-outline bg-app-surface px-3.5 py-3"
          >
            <Text variant="label" tone="inverse" className="flex-1">
              {doc.title}
            </Text>
            <StatusChip
              label={added ? "Eklendi" : "Eksik"}
              tone={added ? "success" : "warning"}
            />
          </View>
        );
      })}
    </View>
  );
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
  icon: typeof FileText;
  count?: number;
  badge?: string;
  badgeTone?: "success" | "warning" | "neutral";
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function AccordionRow({
  title,
  icon,
  count,
  badge,
  badgeTone = "neutral",
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
        {badge ? (
          <StatusChip label={badge} tone={badgeTone} />
        ) : null}
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} color="#83a7ff" />
      </Pressable>
      {open ? <View className="gap-2 pt-1">{children}</View> : null}
    </View>
  );
}

export const ACCIDENT_FLOW: ComposerFlow = {
  kind: "accident",
  eyebrow: "",
  title: "Kaza bildirimi",
  description: "",
  progressVariant: "bar-thin",
  submitLabel: "Kaza bildirimi gönder",
  steps: [
    {
      key: "emergency_panel",
      title: "Acil durum",
      description: "Önce güvende misin?",
      validate: () => null,
      render: (props) => <EmergencyPanelStep {...props} />,
      optional: true,
      hideFooter: true,
    },
    {
      key: "accident_kind",
      title: "Temel bilgi",
      description: "Tür, konum, araç durumu",
      validate: (draft) => {
        if (!draft.counterparty_note) {
          return "Kaza türünü seç.";
        }
        if (
          draft.counterparty_note.includes("Karşı taraf") &&
          !draft.counterparty_vehicle_count
        ) {
          return "Araç sayısını seç.";
        }
        if (!draft.summary.trim()) {
          return "Kısa bir açıklama yaz.";
        }
        if (!draft.location_label.trim()) {
          return "Konum bilgisi gerekli.";
        }
        if (draft.vehicle_drivable === null) {
          return "Araç durumu seçilmeli.";
        }
        return null;
      },
      render: (props) => <AccidentKindStep {...props} />,
    },
    {
      key: "report",
      title: "Tutanak",
      description: "Yöntem seç",
      validate: (draft) =>
        draft.report_method ? null : "Tutanak yöntemini seç.",
      render: (props) => <ReportStep {...props} />,
    },
    {
      key: "accident_photos",
      title: "Fotoğraf",
      description: "Hasarı görünür hale getir",
      validate: (draft) => {
        const requiredMissing = ACCIDENT_EVIDENCE_STEPS.some((step) => {
          if (!step.required) return false;
          const count = draft.attachments.filter((attachment) =>
            attachment.id.startsWith(`${step.id}:`),
          ).length;
          return count < (step.minPhotos ?? 1);
        });
        return requiredMissing ? "Zorunlu fotoğraf adımları eksik." : null;
      },
      render: (props) => <AccidentPhotosStep {...props} />,
    },
    {
      key: "documents",
      title: "Evrak",
      description: "Ehliyet / ruhsat",
      validate: () => null,
      render: (props) => <DocumentsStep {...props} />,
      optional: true,
    },
    {
      key: "insurance",
      title: "Sigorta",
      description: "Kasko tercihi",
      validate: (draft) => {
        if (draft.kasko_selected && !draft.kasko_brand) {
          return "Kasko için kurum seç.";
        }
        if (draft.sigorta_selected && !draft.sigorta_brand) {
          return "Sigorta için kurum seç.";
        }
        return null;
      },
      render: (props) => <InsuranceStep {...props} />,
      optional: true,
    },
    {
      key: "review",
      title: "Önizleme",
      description: "Son kontrol",
      validate: () => null,
      render: (props) => <ReviewStep {...props} />,
      isTerminal: true,
    },
  ],
};
