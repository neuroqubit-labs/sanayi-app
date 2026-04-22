import { BackButton, Button, Icon, Surface, Text, ToggleChip } from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useCreateAppointment } from "@/features/appointments";
import type { AppointmentSlotKind } from "@/features/appointments";
import { useTechnicianCooldownStore } from "@/features/cases/cooldown-store";
import { useCaseOffers } from "@/features/offers";
import { useTechnicianPublicView } from "@/features/ustalar/api";

const SLOT_OPTIONS: { kind: AppointmentSlotKind; label: string }[] = [
  { kind: "today", label: "Bugün" },
  { kind: "tomorrow", label: "Yarın" },
  { kind: "custom", label: "Gün seç" },
  { kind: "flexible", label: "Esnek" },
];

function buildNextDays(count: number) {
  const days = [];
  const now = new Date();
  const months = [
    "Oca",
    "Şub",
    "Mar",
    "Nis",
    "May",
    "Haz",
    "Tem",
    "Ağu",
    "Eyl",
    "Eki",
    "Kas",
    "Ara",
  ];
  const weekdays = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  for (let i = 2; i < 2 + count; i += 1) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const label = `${weekdays[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}`;
    const iso = d.toISOString().slice(0, 10);
    days.push({ label, iso });
  }
  return days;
}

export function RandevuRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { technicianId } = useLocalSearchParams<{ technicianId: string }>();
  const { caseId, offerId } = useLocalSearchParams<{
    caseId?: string;
    offerId?: string;
  }>();

  const { data: technician } = useTechnicianPublicView(technicianId ?? "");

  const { data: offers = [] } = useCaseOffers(caseId ?? "");
  const offer = offerId
    ? offers.find((o) => o.id === offerId)
    : offers.find((o) => o.technician_id === technicianId);
  const hasBindingPrice = Boolean(offer);

  const requestMutation = useCreateAppointment();
  const isInCooldown = useTechnicianCooldownStore((state) =>
    technicianId ? state.isInCooldown(technicianId) : false,
  );

  const [slotKind, setSlotKind] = useState<AppointmentSlotKind | null>(null);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [consent3, setConsent3] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const nextDays = useMemo(() => buildNextDays(7), []);

  if (!technicianId || !technician) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Usta bulunamadı
          </Text>
          <Button
            label="Geri dön"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const cooldownBlocked = isInCooldown;
  const allConsents = consent1 && consent2 && consent3;
  const slotSelected = slotKind && (slotKind !== "custom" || customDate !== null);
  const submitEnabled =
    !cooldownBlocked && allConsents && slotSelected && !!caseId && !!technicianId;

  const priceLabel = offer
    ? formatOfferPrice(offer.amount, offer.currency)
    : "Usta belirleyecek";
  const durationLabel = offer
    ? formatEtaLabel(offer.eta_minutes)
    : "Usta belirleyecek";
  const warrantyLabel = offer?.warranty_label ?? "Usta belirleyecek";

  const handleSubmit = async () => {
    if (!submitEnabled || !caseId || !slotKind || !technicianId) return;
    const slot = {
      kind: slotKind,
      dateLabel: slotKind === "custom" ? customLabel ?? null : null,
    };
    // BE default source "offer_accept" ama FE offer_id'siz de "direct_request"
    // gönderebilir; burada offer varsa canonical offer_accept, yoksa direct.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    try {
      await requestMutation.mutateAsync({
        case_id: caseId,
        technician_id: technicianId,
        offer_id: offer?.id ?? null,
        slot,
        note: "",
        expires_at: expiresAt,
        source: offer ? "offer_accept" : "direct_request",
      });
      router.replace(`/vaka/${caseId}/surec` as Href);
    } catch {
      Alert.alert("Hata", "Randevu talebi gönderilemedi, tekrar dene.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-app-bg" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton variant="close" onPress={() => router.back()} />
        <Text variant="h3" tone="inverse" className="flex-1 text-center text-[16px]">
          Randevu Talep Et
        </Text>
        <View className="h-11 w-11" />
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-4 pb-40 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1.5">
          <Text variant="display" tone="inverse" className="text-[22px] leading-[26px]">
            Kesin kabul
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Bu adım senin ve ustanın zamanını korur. Onayladığında talebin ustaya
            iletilir — 24 saat içinde yanıt beklenir.
          </Text>
        </View>

        {/* MAX_PENDING limit: canlı BE'de case başına 1 pending randevu;
            caseId zorunlu olduğundan ayrı "overLimit" check'e ihtiyaç yok. */}

        {cooldownBlocked ? (
          <View className="flex-row items-start gap-3 rounded-[18px] border border-app-warning/40 bg-app-warning/10 px-4 py-3">
            <Icon icon={Info} size={16} color="#f5b33f" />
            <View className="flex-1 gap-1">
              <Text variant="label" tone="warning" className="text-[13px]">
                Bu usta son 24 saatte müsait değildi
              </Text>
              <Text variant="caption" tone="muted" className="text-app-text-muted">
                Cooldown süresi geçince tekrar dene veya alternatiflere bak.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Summary */}
        <Surface
          variant="raised"
          radius="lg"
          className="gap-3 px-4 py-3.5"
        >
          <SummaryRow label="Usta" value={technician.display_name} />
          <View className="h-px bg-app-outline" />
          <SummaryRow
            label="Tutar"
            value={priceLabel}
            trailing={
              hasBindingPrice ? (
                <View className="flex-row items-center gap-1">
                  <Icon icon={Lock} size={11} color="#2dd28d" />
                  <Text variant="caption" tone="success" className="text-[11px]">
                    Bağlayıcı
                  </Text>
                </View>
              ) : undefined
            }
          />
          <View className="h-px bg-app-outline" />
          <SummaryRow label="Süre" value={durationLabel} />
          <View className="h-px bg-app-outline" />
          <SummaryRow label="Garanti" value={warrantyLabel} />
        </Surface>

        <View className="rounded-[18px] border border-brand-500/30 bg-brand-500/10 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Icon icon={hasBindingPrice ? Lock : Info} size={13} color="#0ea5e9" />
            <Text variant="caption" tone="accent" className="flex-1 text-[12px] leading-[17px]">
              {hasBindingPrice
                ? "Bu tutar bağlayıcıdır. Süreç içinde ek iş çıkarsa her kalem için ayrıca onay istenir."
                : "Bu tutar profil bandıdır, tahminidir. Kesin fiyat iş başlamadan onaylanır."}
            </Text>
          </View>
        </View>

        {/* Time slot */}
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Icon icon={CalendarClock} size={14} color="#83a7ff" />
            <Text variant="label" tone="inverse" className="text-[14px]">
              Randevu zamanı
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {SLOT_OPTIONS.map((option) => (
              <ToggleChip
                key={option.kind}
                label={option.label}
                selected={slotKind === option.kind}
                onPress={() => {
                  setSlotKind(option.kind);
                  if (option.kind !== "custom") {
                    setCustomDate(null);
                    setCustomLabel(null);
                  }
                }}
              />
            ))}
          </View>
          {slotKind === "custom" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {nextDays.map((day) => (
                <ToggleChip
                  key={day.iso}
                  label={day.label}
                  size="sm"
                  selected={customDate === day.iso}
                  onPress={() => {
                    setCustomDate(day.iso);
                    setCustomLabel(day.label);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}
          {slotKind === "flexible" ? (
            <View className="flex-row items-start gap-2 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2">
              <Icon icon={Sparkles} size={12} color="#83a7ff" />
              <Text variant="caption" tone="muted" className="flex-1 text-app-text-muted text-[12px]">
                Esnek seçersen usta sana uygun 2-3 saat aralığı önerir.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Consents */}
        <View className="gap-2">
          <Text variant="label" tone="inverse" className="text-[14px]">
            Onay kutuları
          </Text>
          <ConsentRow
            checked={consent1}
            onToggle={() => setConsent1((v) => !v)}
            label={
              hasBindingPrice
                ? "Teklif tutarını ve iptal politikasını kabul ediyorum"
                : "Fiyat bandını ve iptal politikasını kabul ediyorum"
            }
          />
          <ConsentRow
            checked={consent2}
            onToggle={() => setConsent2((v) => !v)}
            label="Usta ile iletişim bilgilerimin paylaşılmasına izin veriyorum"
          />
          <ConsentRow
            checked={consent3}
            onToggle={() => setConsent3((v) => !v)}
            label={
              hasBindingPrice
                ? "Ek iş çıkarsa her kalem için ayrıca onay vereceğimi biliyorum"
                : "Kesin fiyatın iş başlamadan onaylanacağını biliyorum"
            }
          />
        </View>

        {/* Cancellation policy */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="İptal politikasını aç/kapat"
          onPress={() => setPolicyOpen((v) => !v)}
          className="gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
        >
          <View className="flex-row items-center gap-2">
            <Icon icon={ShieldCheck} size={14} color="#83a7ff" />
            <Text variant="label" tone="inverse" className="flex-1 text-[13px]">
              İptal politikası
            </Text>
            <Icon
              icon={policyOpen ? ChevronUp : ChevronDown}
              size={14}
              color="#83a7ff"
            />
          </View>
          {policyOpen ? (
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              • Usta onayladıktan sonra 24 saat içinde ücretsiz iptal edebilirsin.{"\n"}
              • Randevu tarihinden 12 saat öncesine kadar platform ücreti uygulanmaz.{"\n"}
              • 12 saatten az kala iptal: randevu bedelinin %10'u platform ücreti olarak yansır.
            </Text>
          ) : null}
        </Pressable>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {!slotSelected ? (
          <Text variant="caption" tone="muted" className="text-center text-app-text-subtle text-[11px]">
            Randevu zamanı seç · tüm onayları işaretle
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              label="Vazgeç"
              variant="outline"
              size="lg"
              fullWidth
              onPress={() => router.back()}
            />
          </View>
          <View className="flex-[2]">
            <Button
              label="Randevu Talep Et"
              size="lg"
              fullWidth
              disabled={!submitEnabled || requestMutation.isPending}
              loading={requestMutation.isPending}
              onPress={handleSubmit}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  trailing?: React.ReactNode;
};

function SummaryRow({ label, value, trailing }: SummaryRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="caption" tone="muted" className="text-app-text-subtle text-[12px]">
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        {trailing}
        <Text variant="label" tone="inverse" className="text-[13px]">
          {value}
        </Text>
      </View>
    </View>
  );
}

type ConsentRowProps = {
  checked: boolean;
  onToggle: () => void;
  label: string;
};

function ConsentRow({ checked, onToggle, label }: ConsentRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      className={`flex-row items-start gap-3 rounded-[16px] border px-3.5 py-3 ${
        checked
          ? "border-app-success/40 bg-app-success/10"
          : "border-app-outline bg-app-surface"
      } active:opacity-80`}
    >
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded-[6px] border ${
          checked
            ? "border-app-success bg-app-success"
            : "border-app-outline bg-app-surface-2"
        }`}
      >
        {checked ? <Icon icon={Check} size={12} color="#0b0e1c" strokeWidth={3} /> : null}
      </View>
      <Text variant="caption" tone="muted" className="flex-1 text-app-text text-[12px] leading-[17px]">
        {label}
      </Text>
    </Pressable>
  );
}

function formatOfferPrice(amountRaw: string, currency: string): string {
  const parsed = Number.parseFloat(amountRaw);
  if (Number.isNaN(parsed)) return `${amountRaw} ${currency}`;
  const formatted = parsed.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "TRY" ? "₺" : currency;
  return `${formatted} ${symbol}`;
}

function formatEtaLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} sa ${mins} dk` : `${hours} sa`;
}
