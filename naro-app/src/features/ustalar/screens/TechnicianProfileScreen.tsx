import {
  Avatar,
  BackButton,
  Button,
  Icon,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  Quote,
  Sparkles,
  Star,
  Tag,
  Wrench,
} from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  attachTechnicianToCase,
  prefillDraftForTechnician,
  useActiveCase,
  useTechnicianCaseAction,
} from "@/features/cases";
import { useFavoriteTechniciansStore } from "@/features/profile";
import { useActiveVehicle } from "@/features/vehicles";

import { useTechnicianProfile } from "../api";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";

export function TechnicianProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: technician } = useTechnicianProfile(id ?? "");
  const action = useTechnicianCaseAction(id ?? "");
  const { data: activeCase } = useActiveCase();
  const { data: activeVehicle } = useActiveVehicle();
  const technicianId = technician?.id ?? "";
  const isFavorite = useFavoriteTechniciansStore((state) =>
    state.ids.includes(technicianId),
  );
  const toggleFavorite = useFavoriteTechniciansStore((state) => state.toggle);

  if (!technician) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Servis profili bulunamadı
          </Text>
          <Button
            label="Listeye dön"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const profile = technician;
  const isOpen = profile.availabilityLabel.toLowerCase().includes("açık");
  const verified = profile.badges.some((badge) => badge.id === "verified");

  function handlePrimary() {
    if (action.disabled) return;
    if (action.attachOnPrimary && action.caseId) {
      attachTechnicianToCase(action.caseId, profile.id);
    }
    if (action.prefillOnPrimary) {
      prefillDraftForTechnician(
        action.kind,
        profile.id,
        activeVehicle?.id ?? DEFAULT_VEHICLE_ID,
      );
    }
    router.push(action.primaryRoute as Href);
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
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
          onPress={() => toggleFavorite(profile.id)}
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
        contentContainerClassName="gap-5 pb-40"
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-4 overflow-hidden rounded-[28px] border border-app-outline-strong bg-app-surface">
          <View className="relative h-40 overflow-hidden bg-brand-500/15">
            <View className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-brand-500/25" />
            <View className="absolute -left-10 bottom-[-30px] h-32 w-32 rounded-full bg-brand-500/10" />
            <View className="absolute right-4 top-4">
              <StatusChip
                label={profile.availabilityLabel}
                tone={isOpen ? "success" : "warning"}
              />
            </View>
          </View>

          <View className="-mt-12 items-center gap-3 px-5 pb-5">
            <View className="relative">
              <View className="rounded-full border-4 border-app-surface bg-app-surface-2 p-1">
                <Avatar name={profile.name} size="xl" />
              </View>
              {verified ? (
                <View className="absolute bottom-1 right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-app-surface bg-app-success">
                  <Icon icon={CheckCircle2} size={14} color="#0b0e1c" strokeWidth={3} />
                </View>
              ) : null}
            </View>

            <View className="items-center gap-1">
              <Text
                variant="display"
                tone="inverse"
                className="text-center text-[24px] leading-[28px]"
              >
                {profile.name}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-center text-app-text-muted"
              >
                {profile.tagline}
              </Text>
              {profile.verifiedSinceLabel || profile.completedJobs ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-subtle text-[11px] text-center"
                >
                  {[
                    profile.verifiedSinceLabel,
                    profile.completedJobs
                      ? `${profile.completedJobs} iş tamamlandı`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
            </View>

            {profile.badges.length ? (
              <View className="flex-row flex-wrap justify-center gap-2">
                {profile.badges.map((badge) => (
                  <TrustBadge key={badge.id} label={badge.label} tone={badge.tone} />
                ))}
              </View>
            ) : null}

            <View className="mt-1 flex-row gap-2 self-stretch">
              <HeroMetric
                icon={Star}
                iconColor="#f5b33f"
                value={profile.rating.toFixed(1)}
                label={`${profile.reviewCount} yorum`}
              />
              <HeroMetric
                icon={MapPin}
                iconColor="#83a7ff"
                value={`${profile.distanceKm.toFixed(1)} km`}
                label="Uzaklık"
              />
              <HeroMetric
                icon={Clock}
                iconColor="#2dd28d"
                value={`${profile.responseMinutes} dk`}
                label="Yanıt"
              />
            </View>
          </View>
        </View>

        <View className="mx-4 gap-2 rounded-[20px] border border-brand-500/30 bg-brand-500/10 px-4 py-3.5">
          <View className="flex-row items-center gap-2">
            <Icon icon={Sparkles} size={13} color="#0ea5e9" />
            <Text variant="eyebrow" tone="subtle">
              Neden önerildi
            </Text>
            {activeCase ? (
              <View className="ml-auto">
                <TrustBadge
                  label={action.mode === "open_case" ? "Bu vakada" : "Vaka uyumu"}
                  tone={action.mode === "open_case" ? "success" : "accent"}
                />
              </View>
            ) : null}
          </View>
          <Text
            variant="label"
            tone="inverse"
            className="text-[14px] leading-[19px]"
          >
            {profile.reason}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted leading-[18px]"
          >
            {profile.summary}
          </Text>
        </View>

        <Section title="Hakkında">
          <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text leading-[20px]"
            >
              {profile.biography}
            </Text>
            {profile.completedJobs ? (
              <View className="flex-row items-center gap-2 self-start rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
                <Icon icon={Briefcase} size={11} color="#83a7ff" strokeWidth={2.5} />
                <Text variant="caption" tone="muted" className="text-[11px]">
                  {profile.completedJobs} iş tamamlandı
                </Text>
              </View>
            ) : null}
          </View>
        </Section>

        {profile.campaigns.length ? (
          <Section
            title="Kampanya & Paketler"
            description="Bu ustanın hazır paket teklifleri"
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3 px-4"
            >
              {profile.campaigns.map((campaign) => (
                <View
                  key={campaign.id}
                  className="w-[220px] gap-2 rounded-[20px] border border-app-success/30 bg-app-success-soft px-4 py-3.5"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-app-success/20">
                    <Icon icon={Tag} size={14} color="#2dd28d" />
                  </View>
                  <Text variant="label" tone="inverse" className="text-[14px]">
                    {campaign.title}
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[12px]"
                  >
                    {campaign.subtitle}
                  </Text>
                  <Text variant="label" tone="success">
                    {campaign.priceLabel}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        <Section title="Hizmet detayları">
          <View className="rounded-[20px] border border-app-outline bg-app-surface">
            {profile.serviceDetails.map((detail, index) => (
              <View
                key={detail.label}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  index < profile.serviceDetails.length - 1
                    ? "border-b border-app-outline"
                    : ""
                }`}
              >
                <Text variant="caption" tone="muted" className="text-app-text-subtle">
                  {detail.label}
                </Text>
                <Text
                  variant="label"
                  tone="inverse"
                  className="flex-1 text-right text-[13px]"
                  numberOfLines={2}
                >
                  {detail.value}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {profile.expertise.length ? (
          <Section title="Uzmanlık alanları">
            <View className="flex-row flex-wrap gap-2 px-4">
              {profile.expertise.map((item) => (
                <View
                  key={item}
                  className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-3 py-1.5"
                >
                  <Icon icon={Wrench} size={11} color="#83a7ff" />
                  <Text variant="caption" tone="muted" className="text-[12px]">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {profile.workingHours ? (
          <Section title="Müsaitlik saatleri">
            <View className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
                <Icon icon={Clock} size={16} color="#0ea5e9" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="eyebrow" tone="subtle">
                  Çalışma saatleri
                </Text>
                <Text variant="label" tone="inverse" className="text-[13px]">
                  {profile.workingHours}
                </Text>
              </View>
            </View>
          </Section>
        ) : null}

        {profile.areaLabel ? (
          <Section title="Konum">
            <View className="mx-4 gap-3 overflow-hidden rounded-[20px] border border-app-outline bg-app-surface">
              <View className="relative h-24 overflow-hidden bg-brand-500/10">
                <View className="absolute inset-0 flex-row flex-wrap">
                  {Array.from({ length: 32 }).map((_, idx) => (
                    <View
                      key={idx}
                      className="h-6 border-b border-r border-brand-500/15"
                      style={{ width: `${100 / 8}%` }}
                    />
                  ))}
                </View>
                <View className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 items-center justify-center rounded-full border-2 border-app-surface bg-brand-500">
                  <Icon icon={MapPin} size={14} color="#0b0e1c" strokeWidth={3} />
                </View>
              </View>
              <View className="flex-row items-center gap-3 px-4 pb-3.5">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
                  <Icon icon={MapPin} size={16} color="#83a7ff" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="eyebrow" tone="subtle">
                    Hizmet bölgesi
                  </Text>
                  <Text variant="label" tone="inverse" className="text-[13px]">
                    {profile.areaLabel}
                  </Text>
                </View>
              </View>
            </View>
          </Section>
        ) : null}

        {profile.reviews.length ? (
          <Section title={`Yorumlar (${profile.reviewCount})`}>
            <View className="gap-3 px-4">
              {profile.reviews.slice(0, 3).map((review) => (
                <View
                  key={review.id}
                  className="flex-row items-start gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500/15">
                    <Icon icon={Quote} size={13} color="#0ea5e9" />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text leading-[20px]"
                    >
                      "{review.body}"
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      <Icon
                        icon={BadgeCheck}
                        size={11}
                        color="#2dd28d"
                        strokeWidth={2.5}
                      />
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-subtle text-[11px]"
                      >
                        {review.author}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              {profile.reviews.length > 3 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tüm yorumları gör"
                  onPress={() =>
                    router.push(`/(modal)/usta-yorumlar/${profile.id}` as Href)
                  }
                  className="items-center rounded-[14px] border border-app-outline bg-app-surface-2 px-4 py-3 active:opacity-80"
                >
                  <Text variant="label" tone="inverse" className="text-[13px]">
                    Tüm yorumları gör ({profile.reviewCount})
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Section>
        ) : null}
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 gap-1.5 border-t border-app-outline bg-app-bg px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          label={action.primaryLabel}
          size="lg"
          fullWidth
          disabled={action.disabled}
          variant={action.disabled ? "outline" : "primary"}
          onPress={handlePrimary}
        />
        {action.helperText ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-subtle text-[11px]"
          >
            {action.helperText}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

function Section({ title, description, children }: SectionProps) {
  return (
    <View className="gap-3">
      <View className="gap-0.5 px-4">
        <Text variant="h3" tone="inverse" className="text-[15px]">
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
      {children}
    </View>
  );
}

type HeroMetricProps = {
  icon: typeof Star;
  iconColor: string;
  value: string;
  label: string;
};

function HeroMetric({ icon, iconColor, value, label }: HeroMetricProps) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-[14px] border border-app-outline bg-app-surface-2 px-2 py-2.5">
      <Icon icon={icon} size={14} color={iconColor} strokeWidth={2.5} />
      <Text variant="label" tone="inverse" className="text-[13px]">
        {value}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-subtle text-[11px]"
      >
        {label}
      </Text>
    </View>
  );
}
