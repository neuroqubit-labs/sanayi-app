import type { AccidentReportMethod, DamageSeverity } from "@naro/domain";
import {
  GesturePressable as Pressable,
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
  DoorOpen,
  FileBadge,
  FileText,
  IdCard,
  Image as ImageIcon,
  Layers,
  ScrollText,
  ShieldCheck,
  SquareDashedBottom,
  Truck,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Linking, Platform, TextInput, View } from "react-native";

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

type DamageAreaValue =
  | "front"
  | "rear"
  | "side"
  | "door"
  | "glass"
  | "general";

const DAMAGE_AREA_OPTIONS: {
  value: DamageAreaValue;
  label: string;
  hint: string;
  icon: typeof Truck;
}[] = [
  { value: "front", label: "Ön", hint: "Tampon, kaput, far", icon: ChevronUp },
  { value: "rear", label: "Arka", hint: "Tampon, bagaj, stop", icon: ChevronDown },
  { value: "side", label: "Yan", hint: "Çamurluk, marşpiyel", icon: SquareDashedBottom },
  { value: "door", label: "Kapı / Aksesuar", hint: "Kapı kolu, ayna, fitil", icon: DoorOpen },
  { value: "glass", label: "Cam", hint: "Ön / yan / arka cam", icon: ShieldCheck },
  { value: "general", label: "Genel", hint: "Birden fazla bölge", icon: Layers },
];

const DAMAGE_AREA_LABEL: Record<DamageAreaValue, string> = Object.fromEntries(
  DAMAGE_AREA_OPTIONS.map((option) => [option.value, option.label]),
) as Record<DamageAreaValue, string>;

const DAMAGE_SEVERITY_OPTIONS: {
  value: DamageSeverity;
  label: string;
  hint: string;
}[] = [
  {
    value: "minor",
    label: "Hafif",
    hint: "Çizik, küçük ezik veya lokal işlem",
  },
  {
    value: "moderate",
    label: "Orta",
    hint: "Boya, parça onarımı veya değişim ihtimali",
  },
];

const DAMAGE_SEVERITY_LABEL: Record<DamageSeverity, string> = {
  minor: "Hafif",
  moderate: "Orta",
  major: "Ağır",
  total_loss: "Pert",
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


function AccidentEventStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const selectedMode: "single" | "multi" | null = draft.counterparty_note
    ? draft.counterparty_note.includes("Karşı taraf")
      ? "multi"
      : "single"
    : null;
  const vehicleCount = draft.counterparty_vehicle_count;
  const selectedReport = draft.report_method;

  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          Olay bilgisi
        </Text>
        <Text
          tone="muted"
          className="text-app-text-muted text-[13px] leading-[18px]"
        >
          Karşı taraf ve tutanak durumunu sadece netleştiriyoruz.
        </Text>
      </View>

      <ComposerSection title="Kaza türü">
        <View className="gap-2.5">
          {COUNTERPARTY_OPTIONS.map((option) => {
            const selected = selectedMode === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
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
                className={[
                  "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
                  selected
                    ? "border-brand-500 bg-brand-500/15"
                    : "border-app-outline bg-app-surface",
                ].join(" ")}
              >
                <View
                  className={[
                    "h-6 w-6 items-center justify-center rounded-full border",
                    selected
                      ? "border-brand-500 bg-brand-500"
                      : "border-app-outline bg-app-surface-2",
                  ].join(" ")}
                >
                  {selected ? (
                    <Icon icon={Check} size={12} color="#ffffff" />
                  ) : null}
                </View>
                <Text variant="label" tone="inverse" className="flex-1">
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
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

      <ComposerSection title="Tutanak">
        <View className="gap-2.5">
          {REPORT_OPTIONS.map((option) => {
            const selected = selectedReport === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.title}
                onPress={() =>
                  updateDraft({
                    report_method: selected ? null : option.value,
                  })
                }
                className={[
                  "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
                  selected
                    ? "border-brand-500 bg-brand-500/15"
                    : "border-app-outline bg-app-surface",
                ].join(" ")}
              >
                <View
                  className={[
                    "h-10 w-10 items-center justify-center rounded-[14px] border",
                    selected
                      ? "border-brand-500/40 bg-brand-500/20"
                      : "border-app-outline bg-app-surface-2",
                  ].join(" ")}
                >
                  <Icon
                    icon={option.icon}
                    size={18}
                    color={selected ? "#0ea5e9" : "#83a7ff"}
                  />
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="label" tone="inverse">
                    {option.title}
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[12px] leading-[16px]"
                  >
                    {option.subtitle}
                  </Text>
                </View>
                {selected ? (
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-500">
                    <Icon icon={Check} size={12} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
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
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="h3" tone="inverse">
            Görsel ve not
          </Text>
          {photoCount > 0 ? (
            <StatusChip label={`${photoCount} medya`} tone="success" />
          ) : null}
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[13px] leading-[18px]"
        >
          Hasarı gösteren birkaç kayıt ve kısa bir anlatım yeterli.
        </Text>
      </View>

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
            Usta için net görüntü
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[16px]"
          >
            Genel açı ve yakın çekim eşleşmeyi hızlandırır.
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

      <ComposerSection
        title="Kısa açıklama"
        description="Görseli ekledikten sonra aklında kalan durumu yaz."
      >
        <TextInput
          value={draft.summary}
          onChangeText={(value) => updateDraft({ summary: value })}
          placeholder="Örn: Sağ arka kapıda ezik ve kapı kolunda kırık var."
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className={[INPUT_CLASS, "min-h-[96px] py-3"].join(" ")}
        />
      </ComposerSection>
    </View>
  );
}

function AccidentDamageStep({ draft, updateDraft }: ComposerStepRenderProps) {
  const selected = (draft.damage_area as DamageAreaValue | null | undefined) ?? null;
  const selectedSeverity = draft.damage_severity;

  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          Hasar bilgisi
        </Text>
        <Text
          tone="muted"
          className="text-app-text-muted text-[13px] leading-[18px]"
        >
          Bu seçimler vakanı doğru hasar ve kaporta uzmanlarına taşır.
        </Text>
      </View>

      <ComposerSection title="Hasar bölgesi">
        <View className="flex-row flex-wrap gap-3">
          {DAMAGE_AREA_OPTIONS.map((option) => {
            const isActive = selected === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={option.label}
                onPress={() =>
                  updateDraft({
                    damage_area: isActive ? undefined : option.value,
                  })
                }
                style={{ width: "48%" }}
                className={[
                  "gap-3 rounded-[20px] border px-3.5 py-3.5 active:opacity-90",
                  isActive
                    ? "border-brand-500 bg-brand-500/15"
                    : "border-app-outline bg-app-surface",
                ].join(" ")}
              >
                <View className="flex-row items-start justify-between">
                  <View
                    className={[
                      "h-11 w-11 items-center justify-center rounded-[15px] border",
                      isActive
                        ? "border-brand-500/40 bg-brand-500/20"
                        : "border-app-outline bg-app-surface-2",
                    ].join(" ")}
                  >
                    <Icon
                      icon={option.icon}
                      size={19}
                      color={isActive ? "#0ea5e9" : "#83a7ff"}
                    />
                  </View>
                  {isActive ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-500">
                      <Icon icon={Check} size={12} color="#ffffff" />
                    </View>
                  ) : null}
                </View>
                <View className="gap-0.5">
                  <Text variant="label" tone="inverse" numberOfLines={1}>
                    {option.label}
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    numberOfLines={2}
                    className="text-app-text-muted text-[12px] leading-[16px]"
                  >
                    {option.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ComposerSection>

      <ComposerSection title="Hasar seviyesi">
        <View className="gap-2.5">
          {DAMAGE_SEVERITY_OPTIONS.map((option) => {
            const isActive = selectedSeverity === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={option.label}
                onPress={() =>
                  updateDraft({
                    damage_severity: isActive ? null : option.value,
                  })
                }
                className={[
                  "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
                  isActive
                    ? "border-brand-500 bg-brand-500/15"
                    : "border-app-outline bg-app-surface",
                ].join(" ")}
              >
                <View
                  className={[
                    "h-6 w-6 items-center justify-center rounded-full border",
                    isActive
                      ? "border-brand-500 bg-brand-500"
                      : "border-app-outline bg-app-surface-2",
                  ].join(" ")}
                >
                  {isActive ? (
                    <Icon icon={Check} size={12} color="#ffffff" />
                  ) : null}
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="label" tone="inverse">
                    {option.label}
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[12px] leading-[16px]"
                  >
                    {option.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ComposerSection>
    </View>
  );
}

function AccidentLocationStep({ draft, updateDraft }: ComposerStepRenderProps) {
  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          Olay yeri
        </Text>
        <Text
          tone="muted"
          className="text-app-text-muted text-[13px] leading-[18px]"
        >
          Konum, yakın servis ve hasar uzmanlarını sıralamada ana sinyal olacak.
        </Text>
      </View>

      <LocationPicker
        value={draft.location_label}
        onChange={(next) => updateDraft({ location_label: next })}
        description="Kazanın olduğu veya aracın şu an bulunduğu konumu seç."
      />

      <View className="rounded-[20px] border border-app-info/30 bg-app-info-soft px-4 py-3.5">
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted leading-5"
        >
          Tam adres yoksa yaklaşık bölge de yeterli. Sonraki ekranda bilgileri
          kontrol edip vakayı oluşturacaksın.
        </Text>
      </View>
    </View>
  );
}

function DocumentsStep({
  draft,
  updateDraft,
}: Pick<ComposerStepRenderProps, "draft" | "updateDraft">) {
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

function InsuranceStep({
  draft,
  updateDraft,
}: Pick<ComposerStepRenderProps, "draft" | "updateDraft">) {
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

function ReviewStep({ draft, updateDraft }: ComposerStepRenderProps) {
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
  const damageSeverityLabel = draft.damage_severity
    ? (DAMAGE_SEVERITY_LABEL[draft.damage_severity] ?? draft.damage_severity)
    : "Seçilmedi";

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
            label="Hasar bölgesi"
            value={
              draft.damage_area
                ? DAMAGE_AREA_LABEL[draft.damage_area as DamageAreaValue] ??
                  draft.damage_area
                : "Seçilmedi"
            }
            tone={draft.damage_area ? "neutral" : "warning"}
          />
          <SummaryRow
            label="Hasar seviyesi"
            value={damageSeverityLabel}
            tone={draft.damage_severity ? "neutral" : "warning"}
          />
          <SummaryRow
            label="Tutanak"
            value={
              draft.report_method ? REPORT_LABEL[draft.report_method] : "Seçilmedi"
            }
            tone={draft.report_method ? "neutral" : "warning"}
          />
          <SummaryRow
            label="Konum"
            value={draft.location_label || "Seçilmedi"}
            tone={draft.location_label ? "neutral" : "warning"}
          />
          <SummaryRow label="Medya" value={`${photoCount} dosya`} />
        </View>
      </View>

      <InsuranceStep draft={draft} updateDraft={updateDraft} />

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
        <DocumentsStep draft={draft} updateDraft={updateDraft} />
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
  submitLabel: "Vakayı oluştur",
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
      key: "accident_photos",
      title: "Görsel ve not",
      description: "Hasarı görünür hale getir",
      validate: (draft) => {
        if (!draft.summary.trim()) {
          return "Kısa bir açıklama yaz.";
        }
        const requiredMissing = ACCIDENT_EVIDENCE_STEPS.some((step) => {
          if (!step.required) return false;
          const count = draft.attachments.filter((attachment) =>
            attachment.id.startsWith(`${step.id}:`),
          ).length;
          return count < (step.minPhotos ?? 1);
        });
        if (requiredMissing) return "Zorunlu fotoğraf adımları eksik.";
        return null;
      },
      render: (props) => <AccidentPhotosStep {...props} />,
    },
    {
      key: "accident_event",
      title: "Olay bilgisi",
      description: "Taraf ve tutanak",
      validate: (draft) => {
        if (!draft.counterparty_note) return "Kaza türünü seç.";
        if (
          draft.counterparty_note.includes("Karşı taraf") &&
          !draft.counterparty_vehicle_count
        ) {
          return "Araç sayısını seç.";
        }
        if (!draft.report_method) return "Tutanak yöntemini seç.";
        return null;
      },
      render: (props) => <AccidentEventStep {...props} />,
    },
    {
      key: "accident_damage",
      title: "Hasar bilgisi",
      description: "Bölge ve seviye",
      validate: (draft) => {
        if (!draft.damage_area) return "Hasar bölgesini seç.";
        if (!draft.damage_severity) return "Hasar seviyesini seç.";
        return null;
      },
      render: (props) => <AccidentDamageStep {...props} />,
    },
    {
      key: "accident_location",
      title: "Konum",
      description: "Olay yeri",
      validate: (draft) =>
        draft.location_label.trim() ? null : "Konum bilgisi gerekli.",
      render: (props) => <AccidentLocationStep {...props} />,
    },
    {
      key: "review",
      title: "Önizleme",
      description: "Son kontrol",
      validate: (draft) => {
        if (draft.kasko_selected && !draft.kasko_brand) {
          return "Kasko için kurum seç.";
        }
        if (draft.sigorta_selected && !draft.sigorta_brand) {
          return "Sigorta için kurum seç.";
        }
        return null;
      },
      render: (props) => <ReviewStep {...props} />,
      isTerminal: true,
    },
  ],
};
