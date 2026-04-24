import type { CaseAttachment, ServiceCase } from "@naro/domain";
import {
  BackButton,
  Button,
  Icon,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import {
  type Href,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { VakaCard } from "@/features/cases";
import { useJobsFeed, usePoolCaseDetail } from "@/features/jobs";
import {
  INSURER_LIST,
  useTechnicianProfileStore,
} from "@/features/technicians";

import { useSubmitTechnicianInsuranceClaim } from "../api";
import { prefillFromCase } from "../hydrate";
import { useClaimSourceSheetStore } from "../source-sheet-store";
import { useClaimDraftStore } from "../store";
import type { AccidentKind, ReportMethod } from "../types";
import { getMissingFields } from "../validation";

export function InsuranceClaimComposerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ caseId?: string; mode?: string }>();
  const initialCaseId = params.caseId;
  const standaloneMode = params.mode === "standalone";

  const profile = useTechnicianProfileStore();
  const submitClaim = useSubmitTechnicianInsuranceClaim();
  const { data: jobs = [] } = useJobsFeed();
  const { data: sourceCase } = usePoolCaseDetail(initialCaseId ?? "");

  const draft = useClaimDraftStore((s) => s.draft);
  const update = useClaimDraftStore((s) => s.update);
  const reset = useClaimDraftStore((s) => s.reset);
  const sourceMode = useClaimDraftStore((s) => s.sourceMode);
  const setSourceMode = useClaimDraftStore((s) => s.setSourceMode);

  // Hydrate based on route params
  useEffect(() => {
    if (initialCaseId) {
      if (sourceCase && draft.source_case_id !== initialCaseId) {
        reset();
        update(prefillFromCase(sourceCase));
        setSourceMode("from_case");
      }
      return;
    }
    if (standaloneMode && sourceMode !== "standalone") {
      reset();
      setSourceMode("standalone");
    }
  }, [initialCaseId, sourceCase, standaloneMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = useMemo(() => getMissingFields(draft), [draft]);
  const fromCase = sourceMode === "from_case";
  const selectedSource = sourceCase ?? sourceCaseFromDraft(draft, jobs);
  const standaloneDisabled = sourceMode === "standalone";
  const unsupportedSourceKind = fromCase
    ? selectedSource
      ? selectedSource.kind !== "accident"
      : false
    : false;
  const canSubmit =
    missing.length === 0 &&
    fromCase &&
    Boolean(selectedSource) &&
    !unsupportedSourceKind;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const amount = Number(draft.estimate.replace(/[^\d]/g, ""));

    try {
      const claim = await submitClaim.mutateAsync({
        case_id: selectedSource!.id,
        policy_number: draft.policy_number.trim().toUpperCase(),
        insurer: draft.insurer.trim(),
        coverage_kind: draft.coverage_kind,
        estimate_amount:
          Number.isFinite(amount) && amount > 0 ? String(amount) : null,
        policy_holder_name: draft.customer_name.trim() || null,
        policy_holder_phone: draft.customer_phone.trim() || null,
        currency: "TRY",
        notes: [
          draft.summary.trim(),
          draft.notes.trim(),
          draft.damage_area.trim() ? `Hasar: ${draft.damage_area.trim()}` : "",
          draft.location_label.trim()
            ? `Konum: ${draft.location_label.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });

      reset();
      Alert.alert("Dosya açıldı", `${claim.insurer} · ${claim.policy_number}`);
      router.replace(`/is/${claim.case_id}` as Href);
    } catch (err) {
      console.warn("insurance claim submit failed", err);
      Alert.alert(
        "Dosya açılamadı",
        "Vaka uygun değilse veya aktif dosya varsa işlem tamamlanmaz.",
      );
    }
  };

  const showSheet = useClaimSourceSheetStore((s) => s.show);

  const handleClose = () => {
    reset();
    router.back();
  };

  const handleChangeSource = () => {
    reset();
    router.back();
    setTimeout(() => showSheet(), 150);
  };

  // Güvenlik: route'a picker phase'i atlanarak gelinirse sheet'i aç
  useEffect(() => {
    if (!initialCaseId && !standaloneMode && sourceMode === "unselected") {
      router.back();
      setTimeout(() => showSheet(), 80);
    }
  }, [initialCaseId, standaloneMode, sourceMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-2">
        <BackButton variant="close" onPress={handleClose} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            {fromCase ? "Vakadan dosya" : "Sıfırdan dosya"}
          </Text>
          <Text variant="h2" tone="inverse">
            Hasar Dosyası Aç
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-40 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Kaynak özeti — kompakt banner */}
        {fromCase && selectedSource ? (
          <View className="gap-2">
            <VakaCard
              caseItem={selectedSource}
              label="Kaynak vaka"
              onPress={() =>
                router.push(`/vaka/${selectedSource.id}` as Href)
              }
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleChangeSource}
              hitSlop={6}
              className="flex-row items-center justify-center gap-1.5 rounded-[10px] border border-app-outline bg-app-surface px-3 py-2 active:opacity-80"
            >
              <Icon icon={Edit3} size={12} color="#83a7ff" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                Kaynağı değiştir
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 rounded-[12px] border border-brand-500/30 bg-brand-500/10 px-3 py-2">
            <Icon icon={Plus} size={13} color="#f45f25" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text-muted text-[12px]"
            >
              Sıfırdan dosya açma canlı backend'e bağlanınca açılacak.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleChangeSource}
              hitSlop={6}
            >
              <Text variant="caption" tone="accent" className="text-[11px]">
                Değiştir
              </Text>
            </Pressable>
          </View>
        )}

        {/* Form adımları */}
        <>
            {/* ═══ ADIM 1 — Müşteri & Araç ═══ */}
            <StepBlock
              index={1}
              title="Müşteri & Araç"
              description={
                fromCase
                  ? "Vakadan geldi; eksikleri tamamla."
                  : "Araç sahibinin kimliği ve aracı."
              }
              completed={
                draft.plate.length >= 5 && draft.customer_name.length > 1
              }
            >
              <Field
                label="Plaka"
                value={draft.plate}
                onChange={(v) => update({ plate: v.toUpperCase() })}
                placeholder="34 ABC 42"
                autoCapitalize="characters"
                invalid={missing.some((m) => m.key === "plate")}
              />
              <Field
                label="Marka & model (opsiyonel)"
                value={draft.vehicle_label}
                onChange={(v) => update({ vehicle_label: v })}
                placeholder="Mercedes C200 2021"
              />
              <Field
                label="Müşteri adı"
                value={draft.customer_name}
                onChange={(v) => update({ customer_name: v })}
                placeholder="Ad Soyad"
                autoCapitalize="words"
                invalid={missing.some((m) => m.key === "customer_name")}
              />
              <Field
                label="Telefon (opsiyonel)"
                value={draft.customer_phone}
                onChange={(v) => update({ customer_phone: v })}
                placeholder="+90 5__ ___ __ __"
                keyboardType="phone-pad"
              />
            </StepBlock>

            {/* ═══ ADIM 2 — Hasar tespiti ═══ */}
            <StepBlock
              index={2}
              title="Hasar tespiti"
              description="Temel bilgi — tamamı sonradan güncellenebilir."
              completed={
                draft.damage_area.length > 1 &&
                draft.summary.length > 3 &&
                draft.vehicle_drivable !== null
              }
            >
              <Field
                label="Hasar bölgesi"
                value={draft.damage_area}
                onChange={(v) => update({ damage_area: v })}
                placeholder="Ön sağ çamurluk + sağ kapı"
                invalid={missing.some((m) => m.key === "damage_area")}
              />
              <Field
                label="Olay özeti"
                value={draft.summary}
                onChange={(v) => update({ summary: v })}
                placeholder="Kısa açıklama — zaman, koşullar..."
                multiline
                invalid={missing.some((m) => m.key === "summary")}
              />

              <View className="gap-1.5">
                <Text variant="eyebrow" tone="subtle">
                  Araç sürülebilir mi?
                </Text>
                <View className="flex-row gap-2">
                  <ToggleChip
                    label="Evet"
                    selected={draft.vehicle_drivable === true}
                    onPress={() => update({ vehicle_drivable: true })}
                  />
                  <ToggleChip
                    label="Hayır"
                    selected={draft.vehicle_drivable === false}
                    onPress={() =>
                      update({
                        vehicle_drivable: false,
                        towing_required: true,
                      })
                    }
                  />
                </View>
              </View>

              <EvidenceList
                items={draft.evidence}
                onAdd={() => {
                  const mock: CaseAttachment = {
                    id: `att-${Date.now()}`,
                    kind: "photo",
                    title: `Hasar fotoğrafı (${draft.evidence.length + 1})`,
                    subtitle: "Mock yükleme",
                    statusLabel: "Hazır",
                    asset: null,
                  };
                  update({ evidence: [...draft.evidence, mock] });
                }}
                onRemove={(id) =>
                  update({
                    evidence: draft.evidence.filter((e) => e.id !== id),
                  })
                }
              />
            </StepBlock>

            {/* ═══ ADIM 3 — Tutanak ve detay ═══ */}
            <StepBlock
              index={3}
              title="Tutanak ve detay"
              description="Sigorta raporu için gerekli bilgiler."
              completed={
                Boolean(draft.report_method) && Boolean(draft.accident_kind)
              }
            >
              <View className="gap-1.5">
                <Text variant="eyebrow" tone="subtle">
                  Tutanak yöntemi
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <ReportMethodChip
                    value="e_devlet"
                    label="e-Devlet"
                    selected={draft.report_method === "e_devlet"}
                    onPress={(v) => update({ report_method: v })}
                  />
                  <ReportMethodChip
                    value="paper"
                    label="Kağıt tutanak"
                    selected={draft.report_method === "paper"}
                    onPress={(v) => update({ report_method: v })}
                  />
                  <ReportMethodChip
                    value="police"
                    label="Polis raporu"
                    selected={draft.report_method === "police"}
                    onPress={(v) => update({ report_method: v })}
                  />
                </View>
              </View>

              <View className="gap-1.5">
                <Text variant="eyebrow" tone="subtle">
                  Kaza türü
                </Text>
                <View className="flex-row gap-2">
                  <AccidentKindChip
                    value="single"
                    label="Tek taraflı"
                    selected={draft.accident_kind === "single"}
                    onPress={(v) =>
                      update({
                        accident_kind: v,
                        counterparty_vehicle_count: null,
                      })
                    }
                  />
                  <AccidentKindChip
                    value="multi"
                    label="Karşı taraflı"
                    selected={draft.accident_kind === "multi"}
                    onPress={(v) => update({ accident_kind: v })}
                  />
                </View>
              </View>

              {draft.accident_kind === "multi" ? (
                <>
                  <View className="gap-1.5">
                    <Text variant="eyebrow" tone="subtle">
                      Karşı araç sayısı
                    </Text>
                    <View className="flex-row gap-2">
                      {[1, 2, 3].map((n) => (
                        <ToggleChip
                          key={n}
                          label={n === 3 ? "3+" : `${n} araç`}
                          selected={draft.counterparty_vehicle_count === n}
                          onPress={() =>
                            update({ counterparty_vehicle_count: n })
                          }
                        />
                      ))}
                    </View>
                  </View>
                  <Field
                    label="Karşı taraf notu (opsiyonel)"
                    value={draft.counterparty_note}
                    onChange={(v) => update({ counterparty_note: v })}
                    placeholder="Karşı taraf plakası, ifadesi..."
                    multiline
                  />
                </>
              ) : null}

              <Field
                label="Konum (opsiyonel)"
                value={draft.location_label}
                onChange={(v) => update({ location_label: v })}
                placeholder="Levent · Büyükdere Cad."
              />
            </StepBlock>

            {/* ═══ ADIM 4 — Sigorta ═══ */}
            <StepBlock
              index={4}
              title="Sigorta"
              description="Kasko/trafik ve poliçe bilgisi."
              completed={
                draft.insurer.length > 1 && draft.policy_number.length > 2
              }
              accent
            >
              <View className="gap-1.5">
                <Text variant="eyebrow" tone="subtle">
                  Teminat türü
                </Text>
                <View className="flex-row gap-2">
                  <ToggleChip
                    label="Kasko"
                    selected={draft.coverage_kind === "kasko"}
                    onPress={() => update({ coverage_kind: "kasko" })}
                  />
                  <ToggleChip
                    label="Trafik"
                    selected={draft.coverage_kind === "trafik"}
                    onPress={() => update({ coverage_kind: "trafik" })}
                  />
                </View>
              </View>

              <View className="gap-1.5">
                <Text variant="eyebrow" tone="subtle">
                  Sigorta şirketi
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {INSURER_LIST.map((name) => (
                    <ToggleChip
                      key={name}
                      label={name}
                      selected={draft.insurer === name}
                      onPress={() => update({ insurer: name })}
                    />
                  ))}
                </ScrollView>
              </View>

              <Field
                label="Poliçe numarası"
                value={draft.policy_number}
                onChange={(v) => update({ policy_number: v.toUpperCase() })}
                placeholder="AX-2024-87234"
                autoCapitalize="characters"
                invalid={missing.some((m) => m.key === "policy_number")}
              />
              <Field
                label="Tahmini hasar bedeli (opsiyonel)"
                value={draft.estimate}
                onChange={(v) =>
                  update({ estimate: v.replace(/[^\d]/g, "") })
                }
                placeholder="9400"
                keyboardType="numeric"
              />
              <Field
                label="Ek notlar (opsiyonel)"
                value={draft.notes}
                onChange={(v) => update({ notes: v })}
                placeholder="Eksper için notlar..."
                multiline
              />
            </StepBlock>

            {/* Tamirhane readonly */}
            <View className="gap-2 rounded-[18px] border border-app-outline bg-app-surface-2 px-4 py-4">
              <Text variant="eyebrow" tone="subtle">
                Tamirhane (profil)
              </Text>
              <Row label="Ünvan" value={profile.business.legal_name} />
              <Row
                label="Vergi no"
                value={profile.business.tax_number ?? "—"}
              />
              <Row label="IBAN" value={profile.business.iban ?? "—"} />
            </View>
        </>
      </ScrollView>

      {/* Sticky footer */}
      <View
        className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-6 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {standaloneDisabled ? (
          <View className="flex-row items-start gap-2 rounded-[12px] border border-app-outline bg-app-surface px-3 py-2">
            <Icon icon={AlertTriangle} size={13} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text-muted text-[11px] leading-[15px]"
            >
              Bu turda yalnız mevcut canlı vakadan hasar dosyası açılıyor.
            </Text>
          </View>
        ) : unsupportedSourceKind ? (
          <View className="flex-row items-start gap-2 rounded-[12px] border border-app-warning/30 bg-app-warning-soft px-3 py-2">
            <Icon icon={AlertTriangle} size={13} color="#f5b33f" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text-muted text-[11px] leading-[15px]"
            >
              Hasar dosyası yalnız kaza/hasar vakasından açılabilir.
            </Text>
          </View>
        ) : missing.length > 0 ? (
          <View className="flex-row items-start gap-2 rounded-[12px] border border-app-warning/30 bg-app-warning-soft px-3 py-2">
            <Icon icon={AlertTriangle} size={13} color="#f5b33f" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text-muted text-[11px] leading-[15px]"
            >
              Eksik: {missing.slice(0, 3).map((m) => m.label).join(", ")}
              {missing.length > 3 ? ` · +${missing.length - 3}` : ""}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 rounded-[12px] border border-app-success/30 bg-app-success-soft px-3 py-2">
            <Icon icon={CheckCircle2} size={13} color="#2dd28d" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-success text-[11px]"
            >
              Dosya sigortaya gönderilmeye hazır.
            </Text>
          </View>
        )}
        <Button
          label="Dosyayı aç"
          size="lg"
          disabled={!canSubmit}
          onPress={handleSubmit}
          loading={submitClaim.isPending}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

function sourceCaseFromDraft(
  draft: { source_case_id: string | null },
  jobs: ServiceCase[],
): ServiceCase | null {
  if (!draft.source_case_id) return null;
  return jobs.find((c) => c.id === draft.source_case_id) ?? null;
}

// ─── Step block ──────────────────────────────────────────

function StepBlock({
  index,
  title,
  description,
  completed,
  accent,
  children,
}: {
  index: number;
  title: string;
  description?: string;
  completed?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View
          className={`h-8 w-8 items-center justify-center rounded-full ${
            completed
              ? "bg-app-success/20"
              : accent
                ? "bg-brand-500/20"
                : "bg-app-surface-2"
          }`}
        >
          {completed ? (
            <Icon icon={CheckCircle2} size={16} color="#2dd28d" />
          ) : (
            <Text
              variant="label"
              tone={accent ? "accent" : "inverse"}
              className="text-[13px]"
            >
              {index}
            </Text>
          )}
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="h3" tone="inverse" className="text-[16px]">
            {title}
          </Text>
          {description ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px]"
            >
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="gap-3 pl-11">{children}</View>
    </View>
  );
}

// ─── Form atoms ──────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  invalid?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#66718d"
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        className={`rounded-[14px] border bg-app-surface px-4 py-3 text-app-text ${
          invalid ? "border-app-warning/60" : "border-app-outline"
        }`}
        style={multiline ? { minHeight: 80, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="flex-1 text-right text-app-text text-[12px]"
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function ReportMethodChip({
  value,
  label,
  selected,
  onPress,
}: {
  value: ReportMethod;
  label: string;
  selected: boolean;
  onPress: (v: ReportMethod) => void;
}) {
  return (
    <ToggleChip
      label={label}
      selected={selected}
      onPress={() => onPress(value)}
    />
  );
}

function AccidentKindChip({
  value,
  label,
  selected,
  onPress,
}: {
  value: AccidentKind;
  label: string;
  selected: boolean;
  onPress: (v: AccidentKind) => void;
}) {
  return (
    <ToggleChip
      label={label}
      selected={selected}
      onPress={() => onPress(value)}
    />
  );
}

function EvidenceList({
  items,
  onAdd,
  onRemove,
}: {
  items: CaseAttachment[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="eyebrow" tone="subtle">
          Görseller (opsiyonel)
        </Text>
        {items.length > 0 ? (
          <TrustBadge label={`${items.length}/6`} tone="info" />
        ) : null}
      </View>
      {items.length > 0 ? (
        <View className="gap-1.5">
          {items.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center gap-2 rounded-[12px] border border-app-outline bg-app-surface-2 px-3 py-2"
            >
              <Icon icon={Camera} size={13} color="#83a7ff" />
              <Text
                variant="caption"
                tone="muted"
                className="flex-1 text-app-text text-[12px]"
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Görseli kaldır"
                hitSlop={6}
                onPress={() => onRemove(item.id)}
              >
                <Icon icon={Trash2} size={13} color="#ff7e7e" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hasar görseli ekle"
        onPress={onAdd}
        disabled={items.length >= 6}
        className={`flex-row items-center justify-center gap-2 rounded-[14px] border border-dashed px-4 py-3 active:opacity-80 ${
          items.length >= 6
            ? "border-app-outline bg-app-surface"
            : "border-brand-500/40 bg-brand-500/10"
        }`}
      >
        <Icon icon={Camera} size={14} color="#f45f25" />
        <Text variant="caption" tone="inverse" className="text-[12px]">
          {items.length === 0 ? "Hasar görseli ekle" : "Bir daha ekle"}
        </Text>
      </Pressable>
    </View>
  );
}
