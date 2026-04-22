import {
  Avatar,
  BackButton,
  Button,
  Icon,
  Screen,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  Star,
  Wrench,
} from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMyCasesLive } from "@/features/cases/api";
import { useFavoriteTechniciansStore } from "@/features/profile";

import { useTechnicianPublicView } from "../api";
import { resolveTechnicianCta } from "../technician-cta";

const PROVIDER_TYPE_LABEL: Record<string, string> = {
  usta: "Usta",
  cekici: "Çekici",
  oto_aksesuar: "Oto aksesuar",
  kaporta_boya: "Kaporta & boya",
  lastik: "Lastik",
  oto_elektrik: "Oto elektrik",
};

const VERIFIED_META: Record<
  "basic" | "verified" | "premium",
  { label: string; tone: "info" | "accent" | "success" }
> = {
  basic: { label: "Yeni", tone: "info" },
  verified: { label: "Doğrulandı", tone: "accent" },
  premium: { label: "Premium", tone: "success" },
};

/**
 * Teknisyen tam profili — canlı `/technicians/public/{id}`.
 * PII mask invariant (I-9): phone/email/business detayları response'ta
 * yok; whitelist enforce.
 *
 * Launch scope: rating + response time + completed jobs 30d + konum +
 * specialty chips. Distance + reviews + campaigns + live offer BE
 * genişletildikçe eklenir.
 */
export function TechnicianProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const technicianId = id ?? "";

  const { data: technician, isLoading, isError, refetch } =
    useTechnicianPublicView(technicianId);
  const { data: myCases } = useMyCasesLive();

  const isFavorite = useFavoriteTechniciansStore((state) =>
    state.ids.includes(technicianId),
  );
  const toggleFavorite = useFavoriteTechniciansStore((state) => state.toggle);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color="#83a7ff" />
          <Text tone="muted" variant="caption">
            Profil yükleniyor…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !technician) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse" className="text-center">
            Servis profili yüklenemedi
          </Text>
          <Text variant="body" tone="muted" className="text-center">
            Bağlantını kontrol edip yeniden dene.
          </Text>
          <View className="flex-row gap-2">
            <Button
              label="Tekrar dene"
              variant="primary"
              onPress={() => refetch()}
            />
            <Button
              label="Listeye dön"
              variant="outline"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const verified = VERIFIED_META[technician.verified_level];
  const activeType =
    technician.active_provider_type ?? technician.provider_type;
  const primaryLabel =
    PROVIDER_TYPE_LABEL[activeType] ?? PROVIDER_TYPE_LABEL.usta ?? "Servis";
  const secondaryLabels = technician.secondary_provider_types
    .filter((t) => t !== activeType)
    .map((t) => PROVIDER_TYPE_LABEL[t])
    .filter((label): label is string => Boolean(label));

  const ratingValue =
    technician.rating_bayesian !== null
      ? technician.rating_bayesian.toFixed(1)
      : null;

  const districtLabel = technician.location_summary.primary_district_label;
  const cityLabel = technician.location_summary.city_label;
  const radiusKm = technician.location_summary.service_radius_km;

  const cta = resolveTechnicianCta({
    technicianId: technician.id,
    providerType: activeType,
    activeCases: myCases ?? [],
    acceptingNewJobs: technician.accepting_new_jobs,
  });

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <BackButton onPress={() => router.back()} />
        <Text variant="label" tone="inverse">
          Servis profili
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"
          }
          accessibilityState={{ selected: isFavorite }}
          onPress={() => toggleFavorite(technician.id)}
          className={`h-11 w-11 items-center justify-center rounded-full border ${
            isFavorite
              ? "border-app-critical/40 bg-app-critical/10"
              : "border-app-outline bg-app-surface"
          } active:opacity-80`}
        >
          <Icon
            icon={Heart}
            size={18}
            color={isFavorite ? "#ff6b6b" : "#f5f7ff"}
            strokeWidth={isFavorite ? 2.5 : 2}
            fill={isFavorite ? "#ff6b6b" : "transparent"}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="mx-4 overflow-hidden rounded-[28px] border border-app-outline-strong bg-app-surface">
          <View className="relative h-40 overflow-hidden bg-brand-500/15">
            <View className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-brand-500/25" />
            <View className="absolute -left-10 bottom-[-30px] h-32 w-32 rounded-full bg-brand-500/10" />
            <View className="absolute right-4 top-4 flex-row gap-2">
              <TrustBadge label={verified.label} tone={verified.tone} />
              {technician.accepting_new_jobs ? (
                <StatusChip label="İş alıyor" tone="success" icon={CheckCircle2} />
              ) : (
                <StatusChip label="Yoğun" tone="neutral" />
              )}
            </View>
          </View>

          <View className="-mt-12 items-center gap-3 px-5 pb-5">
            <View className="rounded-full border-4 border-app-surface bg-app-surface-2 p-1">
              <Avatar name={technician.display_name} size="xl" />
            </View>

            <View className="items-center gap-1">
              <Text
                variant="display"
                tone="inverse"
                className="text-center text-[24px] leading-[28px]"
              >
                {technician.display_name}
              </Text>
              {technician.tagline ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-center text-app-text-muted text-[13px] leading-[18px]"
                >
                  {technician.tagline}
                </Text>
              ) : null}
            </View>

            <View className="flex-row flex-wrap justify-center gap-2">
              <SpecialtyChip label={primaryLabel} highlighted />
              {secondaryLabels.map((label) => (
                <SpecialtyChip key={label} label={label} />
              ))}
              {technician.provider_mode === "business" ? (
                <SpecialtyChip label="İşletme" />
              ) : technician.provider_mode === "individual" ? (
                <SpecialtyChip label="Bireysel" />
              ) : null}
            </View>
          </View>
        </View>

        {/* Metrics */}
        <View className="mx-4 flex-row gap-2">
          <MetricCard
            icon={<Icon icon={Star} size={14} color="#f5b33f" />}
            value={ratingValue ?? "Yeni"}
            label={
              ratingValue
                ? `${technician.rating_count} yorum`
                : "İlk işini sen aç"
            }
          />
          <MetricCard
            icon={<Icon icon={Clock} size={14} color="#2dd28d" />}
            value={
              technician.response_time_p50_minutes
                ? `${technician.response_time_p50_minutes} dk`
                : "—"
            }
            label={
              technician.response_time_p50_minutes ? "Ort. yanıt" : "Yanıt"
            }
          />
          <MetricCard
            icon={<Icon icon={Wrench} size={14} color="#83a7ff" />}
            value={
              technician.completed_jobs_30d > 0
                ? technician.completed_jobs_30d.toString()
                : "—"
            }
            label={
              technician.completed_jobs_30d > 0
                ? "30 günde iş"
                : "Yeni servis"
            }
          />
        </View>

        {/* Location */}
        {(districtLabel || cityLabel || radiusKm) ? (
          <View className="mx-4 gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
            <View className="flex-row items-center gap-2">
              <Icon icon={MapPin} size={14} color="#83a7ff" />
              <Text variant="eyebrow" tone="subtle">
                Hizmet bölgesi
              </Text>
            </View>
            <Text variant="label" tone="inverse" className="text-[14px]">
              {[districtLabel, cityLabel].filter(Boolean).join(" · ")}
            </Text>
            {radiusKm ? (
              <Text variant="caption" tone="muted" className="text-[12px]">
                Atölye merkezinden {radiusKm} km çevre
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Biography */}
        {technician.biography ? (
          <View className="mx-4 gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
            <Text variant="eyebrow" tone="subtle">
              Hakkında
            </Text>
            <Text
              variant="body"
              tone="muted"
              className="text-app-text leading-6 text-[14px]"
            >
              {technician.biography}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer CTA */}
      <View className="absolute inset-x-0 bottom-0 border-t border-app-outline bg-app-surface px-4 py-3 pb-6">
        <Button
          label={cta.primaryLabel}
          variant={
            cta.primaryDisabled
              ? "outline"
              : cta.mode === "ready"
                ? "primary"
                : "secondary"
          }
          size="lg"
          fullWidth
          disabled={cta.primaryDisabled}
          onPress={() => {
            if (cta.primaryDisabled || !cta.primaryRoute) return;
            router.push(cta.primaryRoute as Href);
          }}
        />
        {cta.helperText ? (
          <Text
            variant="caption"
            tone="muted"
            className="mt-1.5 text-center text-app-text-subtle text-[11px]"
          >
            {cta.helperText}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function MetricCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View className="flex-1 items-center gap-1 rounded-[14px] border border-app-outline bg-app-surface px-2 py-3">
      {icon}
      <Text
        variant="label"
        tone="inverse"
        className="text-[13px] leading-[16px]"
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-subtle text-[10px] leading-[13px]"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function SpecialtyChip({
  label,
  highlighted,
}: {
  label: string;
  highlighted?: boolean;
}) {
  return (
    <View
      className={[
        "rounded-full border px-3 py-1.5",
        highlighted
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface-2",
      ].join(" ")}
    >
      <Text
        variant="caption"
        tone={highlighted ? "accent" : "muted"}
        className="text-[11px]"
      >
        {label}
      </Text>
    </View>
  );
}
