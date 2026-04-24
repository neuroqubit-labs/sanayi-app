import {
  ActionSheetSurface,
  Avatar,
  BottomSheetOverlay,
  Button,
  Icon,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useRouter, useSegments } from "expo-router";
import {
  Clock,
  Heart,
  MapPin,
  MousePointerClick,
  Star,
  Wrench,
  X,
} from "lucide-react-native";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { useMyCasesLive } from "@/features/cases/api";
import { useFavoriteTechniciansStore } from "@/features/profile";

import { useTechnicianPublicView } from "../api";
import { useUstaPreviewStore } from "../preview-store";
import { resolveTechnicianCta, type TechnicianCta } from "../technician-cta";

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
 * Usta önizleme sheet — kart tıklamasında açılır. Canlı
 * `/technicians/public/{id}` çeker; avatar'a dokununca tam profile
 * gider. Mock rating/distance/campaign/review alanları kaldırıldı
 * (canlı BE'de yok; parity audit V1.1'de eklenecek).
 */
export function UstaPreviewSheet() {
  const technicianId = useUstaPreviewStore((state) => state.technicianId);
  const close = useUstaPreviewStore((state) => state.close);
  const router = useRouter();
  const segments = useSegments();
  const routeKey = segments.join("/");
  const {
    data: profile,
    isLoading,
    isError,
  } = useTechnicianPublicView(technicianId ?? "");
  const { data: myCases } = useMyCasesLive();
  const isFavorite = useFavoriteTechniciansStore((state) =>
    technicianId ? state.ids.includes(technicianId) : false,
  );
  const toggleFavorite = useFavoriteTechniciansStore((state) => state.toggle);

  const isOpen = Boolean(technicianId);
  const routeKeyAtOpen = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      routeKeyAtOpen.current = null;
      return;
    }

    if (routeKeyAtOpen.current === null) {
      routeKeyAtOpen.current = routeKey;
      return;
    }

    if (routeKeyAtOpen.current !== routeKey) {
      close();
    }
  }, [close, isOpen, routeKey]);

  // Android'de kart tıklamasındaki parmak hâlâ ekrandayken sheet açılırsa
  // avatar Pressable tıklanan koordinata
  // "altına" gelip phantom tap yutuyor → ilk açılışta openFullProfile fire ediyor.
  // 350ms settle gate ile bunu önlüyoruz — kullanıcı gerçekten tekrar dokunana kadar navigate etme.
  const navigateReady = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      navigateReady.current = false;
      return;
    }
    const timer = setTimeout(() => {
      navigateReady.current = true;
    }, 350);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const openFullProfile = () => {
    if (!technicianId) return;
    if (!navigateReady.current) return;
    close();
    router.push(`/usta/${technicianId}` as Href);
  };

  const cta: TechnicianCta | null = profile
    ? resolveTechnicianCta({
        technicianId: profile.id,
        providerType: profile.active_provider_type ?? profile.provider_type,
        activeCases: myCases ?? [],
        acceptingNewJobs: profile.accepting_new_jobs,
      })
    : null;

  const handlePrimary = () => {
    if (!cta || cta.primaryDisabled || !cta.primaryRoute) return;
    close();
    router.push(cta.primaryRoute as Href);
  };

  return (
    <BottomSheetOverlay
      visible={isOpen}
      onClose={close}
      accessibilityLabel="Ön izlemeyi kapat"
    >
      <ActionSheetSurface
        title="Usta önizleme"
        description="Kısa bilgi — tam profil için avatara dokun."
      >
        {isLoading ? (
          <View className="items-center gap-2 py-8">
            <ActivityIndicator color="#83a7ff" />
            <Text tone="muted" variant="caption">
              Usta bilgisi yükleniyor…
            </Text>
          </View>
        ) : isError || !profile ? (
          <View className="items-center gap-2 py-8 px-4">
            <Text variant="label" tone="inverse" className="text-center">
              Usta bilgisi yüklenemedi
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-center text-app-text-muted"
            >
              Bağlantını kontrol edip yeniden dene.
            </Text>
          </View>
        ) : (
          <PreviewContent
            profile={profile}
            isFavorite={isFavorite}
            onToggleFavorite={() => toggleFavorite(profile.id)}
            onClose={close}
            onOpenFull={openFullProfile}
            cta={cta}
            onPrimary={handlePrimary}
          />
        )}
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}

type PreviewContentProps = {
  profile: ReturnType<typeof useTechnicianPublicView>["data"] & object;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onOpenFull: () => void;
  cta: TechnicianCta | null;
  onPrimary: () => void;
};

function PreviewContent({
  profile,
  isFavorite,
  onToggleFavorite,
  onClose,
  onOpenFull,
  cta,
  onPrimary,
}: PreviewContentProps) {
  const verified = VERIFIED_META[profile.verified_level];
  const activeType = profile.active_provider_type ?? profile.provider_type;
  const primaryLabel =
    PROVIDER_TYPE_LABEL[activeType] ?? PROVIDER_TYPE_LABEL.usta ?? "Servis";

  const ratingValue =
    profile.rating_bayesian !== null
      ? profile.rating_bayesian.toFixed(1)
      : null;

  const districtLabel = profile.location_summary.primary_district_label;
  const cityLabel = profile.location_summary.city_label;
  const radiusKm = profile.location_summary.service_radius_km;

  return (
    <View className="gap-4">
      <View className="absolute -right-1 -top-1 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"
          }
          accessibilityState={{ selected: isFavorite }}
          onPress={onToggleFavorite}
          hitSlop={10}
          className={`h-8 w-8 items-center justify-center rounded-full border ${
            isFavorite
              ? "border-app-critical/40 bg-app-critical/15"
              : "border-app-outline bg-app-surface"
          }`}
        >
          <Icon
            icon={Heart}
            size={14}
            color={isFavorite ? "#ff6b6b" : "#83a7ff"}
            strokeWidth={isFavorite ? 2.5 : 2}
            fill={isFavorite ? "#ff6b6b" : "transparent"}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ön izlemeyi kapat"
          onPress={onClose}
          hitSlop={10}
          className="h-8 w-8 items-center justify-center rounded-full border border-app-outline bg-app-surface"
        >
          <Icon icon={X} size={14} color="#83a7ff" />
        </Pressable>
      </View>

      <View className="items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${profile.display_name} tam profilini aç`}
          onPress={onOpenFull}
          hitSlop={8}
          className="items-center gap-1.5 active:opacity-80"
        >
          <View className="rounded-full border-2 border-brand-500/60 p-[3px]">
            <Avatar name={profile.display_name} size="xl" />
          </View>
          <View className="flex-row items-center gap-1 rounded-full bg-app-surface-2 px-2.5 py-1">
            <Icon
              icon={MousePointerClick}
              size={10}
              color="#83a7ff"
              strokeWidth={2.5}
            />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[10px]"
            >
              Tam profil için dokun
            </Text>
          </View>
        </Pressable>

        <View className="items-center gap-1">
          <Text
            variant="display"
            tone="inverse"
            className="text-[22px] leading-[26px] text-center"
          >
            {profile.display_name}
          </Text>
          {profile.tagline ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-center text-app-text-muted"
            >
              {profile.tagline}
            </Text>
          ) : null}
        </View>

        <View className="flex-row flex-wrap justify-center gap-2">
          <TrustBadge label={verified.label} tone={verified.tone} />
          {profile.accepting_new_jobs ? (
            <TrustBadge label="İş alıyor" tone="success" />
          ) : (
            <TrustBadge label="Yoğun" tone="neutral" />
          )}
          <TrustBadge label={primaryLabel} tone="info" />
        </View>
      </View>

      <View className="flex-row gap-2">
        <PreviewMetric
          icon={Star}
          iconColor="#f5b33f"
          value={ratingValue ?? "Yeni"}
          label={
            ratingValue ? `${profile.rating_count} yorum` : "Değerlendirme"
          }
        />
        <PreviewMetric
          icon={Clock}
          iconColor="#2dd28d"
          value={
            profile.response_time_p50_minutes
              ? `${profile.response_time_p50_minutes} dk`
              : "—"
          }
          label={profile.response_time_p50_minutes ? "Ort. yanıt" : "Yanıt"}
        />
        <PreviewMetric
          icon={Wrench}
          iconColor="#83a7ff"
          value={
            profile.completed_jobs_30d > 0
              ? profile.completed_jobs_30d.toString()
              : "—"
          }
          label={profile.completed_jobs_30d > 0 ? "30g iş" : "Yeni"}
        />
      </View>

      {districtLabel || cityLabel ? (
        <View className="flex-row items-center gap-2 rounded-[14px] border border-app-outline bg-app-surface px-3.5 py-2.5">
          <Icon icon={MapPin} size={13} color="#83a7ff" />
          <Text variant="caption" tone="muted" className="flex-1 text-[12px]">
            {[districtLabel, cityLabel].filter(Boolean).join(" · ")}
            {radiusKm ? ` · ${radiusKm} km hizmet` : ""}
          </Text>
        </View>
      ) : null}

      <View className="gap-1.5">
        <Button
          label={cta?.primaryLabel ?? "—"}
          size="lg"
          fullWidth
          disabled={!cta || cta.primaryDisabled}
          variant={
            !cta || cta.primaryDisabled
              ? "outline"
              : cta.mode === "ready"
                ? "primary"
                : "secondary"
          }
          onPress={onPrimary}
        />
        {cta?.helperText ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-subtle text-[11px]"
          >
            {cta.helperText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type PreviewMetricProps = {
  icon: typeof Star;
  iconColor: string;
  value: string;
  label: string;
};

function PreviewMetric({ icon, iconColor, value, label }: PreviewMetricProps) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-[14px] border border-app-outline bg-app-surface px-2 py-2">
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
