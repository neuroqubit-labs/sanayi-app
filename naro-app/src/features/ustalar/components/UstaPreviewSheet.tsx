import { useCaseDossier } from "@naro/mobile-core";
import {
  ActionSheetSurface,
  Avatar,
  BottomSheetOverlay,
  Button,
  Icon,
  Text,
  useNaroTheme,
  withAlphaHex,
} from "@naro/ui";
import { type Href, useRouter, useSegments } from "expo-router";
import {
  CheckCircle2,
  Clock,
  MapPin,
  MousePointerClick,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  View,
} from "react-native";

import { useMyCasesLive, useNotifyCaseToTechnician } from "@/features/cases/api";
import { apiClient } from "@/runtime";

import { useTechnicianPublicView } from "../api";
import { useUstaPreviewStore } from "../preview-store";
import {
  VERIFIED_META,
  buildFitCopy,
  buildFitSignals,
  buildTrustMetrics,
  getActiveProviderType,
  getProviderLabel,
} from "../profile-view-model";
import type { TechnicianPublicView } from "../schemas";
import { resolveTechnicianCta, type TechnicianCta } from "../technician-cta";

const TRUST_ICON = {
  rating: Star,
  response: Clock,
  jobs: Wrench,
  certificates: ShieldCheck,
} as const;

const ACTIVE_CASE_STATUSES = new Set([
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
]);

/**
 * Usta önizleme sheet — tam profilin kısa karar versiyonu.
 * Avatar'a dokunma tam profile gider; kart gövdesi preview açmaya devam eder.
 */
export function UstaPreviewSheet() {
  const technicianId = useUstaPreviewStore((state) => state.technicianId);
  const feedItem = useUstaPreviewStore((state) => state.feedItem);
  const close = useUstaPreviewStore((state) => state.close);
  const router = useRouter();
  const segments = useSegments();
  const routeKey = segments.join("/");
  const { colors } = useNaroTheme();
  const {
    data: profile,
    isLoading,
    isError,
  } = useTechnicianPublicView(technicianId ?? "");
  const { data: myCases } = useMyCasesLive();
  const notifyCase = useNotifyCaseToTechnician();
  const activeCaseForDossier =
    useMemo(
      () =>
        (myCases ?? [])
          .filter((caseItem) => ACTIVE_CASE_STATUSES.has(caseItem.status))
          .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ??
        null,
      [myCases],
    );
  const dossierQuery = useCaseDossier(activeCaseForDossier?.id ?? "", {
    apiClient,
    enabled: Boolean(activeCaseForDossier?.id && profile?.user_id),
  });
  const activeCaseMatch = dossierQuery.data?.matches.find(
    (match) =>
      (match.technician_profile_id === profile?.id ||
        match.technician_user_id === profile?.user_id) &&
      match.visibility_state !== "hidden" &&
      match.visibility_state !== "invalidated",
  );
  const feedContextMatchesProfile =
    Boolean(feedItem && profile && feedItem.id === profile.id);
  const feedContextMatchesCase =
    feedContextMatchesProfile && activeCaseForDossier
      ? feedItem?.is_case_compatible === true ||
        feedItem?.compatibility_state === "notifyable" ||
        feedItem?.compatibility_state === "compatible"
      : null;
  const canNotifyActiveCase =
    activeCaseMatch?.can_notify ??
    (feedContextMatchesProfile ? feedItem?.can_notify : null) ??
    false;

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

  // Android'de sheet ilk açılırken karttaki parmak avatar'ın üstüne denk
  // gelebiliyor. Kısa settle gate phantom navigation'ı engeller.
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
        providerType: getActiveProviderType(profile),
        activeCases: myCases ?? [],
        acceptingNewJobs: profile.accepting_new_jobs,
        activeCaseMatchesTechnician:
          activeCaseForDossier
            ? (activeCaseMatch ? true : feedContextMatchesCase)
            : null,
        activeCaseCanNotify:
          activeCaseMatch?.can_notify ??
          (feedContextMatchesProfile ? feedItem?.can_notify : null),
        activeCaseNotifyState:
          activeCaseMatch?.notify_state ??
          (feedContextMatchesProfile ? feedItem?.notify_state : null),
        activeCaseMatchReason:
          activeCaseMatch?.reason_label ??
          (feedContextMatchesProfile ? feedItem?.match_reason_label : null),
      })
    : null;

  const handlePrimary = async () => {
    if (!cta || cta.primaryDisabled || !cta.primaryRoute) return;
    if (cta.mode === "ready" && cta.caseId && canNotifyActiveCase) {
      try {
        await notifyCase.mutateAsync({
          caseId: cta.caseId,
          technicianProfileId: profile?.id ?? technicianId ?? undefined,
        });
      } catch {
        Alert.alert(
          "Vaka bildirilemedi",
          "Usta bu vaka için uygun olmayabilir. Birazdan tekrar dene.",
        );
        return;
      }
    }
    close();
    router.push(cta.primaryRoute as Href);
  };

  return (
    <BottomSheetOverlay
      visible={isOpen}
      onClose={close}
      accessibilityLabel="Ön izlemeyi kapat"
      maxHeight="82%"
      contentStyle={{ overflow: "hidden" }}
    >
      <ActionSheetSurface title="Ön izleme">
        {isLoading ? (
          <View className="items-center gap-2 py-8">
            <ActivityIndicator color={colors.info} />
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
            onOpenFull={openFullProfile}
            cta={cta}
            primaryPending={notifyCase.isPending}
            contextLoading={Boolean(
              activeCaseForDossier?.id && dossierQuery.isLoading,
            )}
            onPrimary={() => {
              void handlePrimary();
            }}
          />
        )}
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}

type PreviewContentProps = {
  profile: TechnicianPublicView;
  onOpenFull: () => void;
  cta: TechnicianCta | null;
  primaryPending: boolean;
  contextLoading: boolean;
  onPrimary: () => void;
};

function PreviewContent({
  profile,
  onOpenFull,
  cta,
  primaryPending,
  contextLoading,
  onPrimary,
}: PreviewContentProps) {
  const { colors } = useNaroTheme();
  const verified = VERIFIED_META[profile.verified_level];
  const activeType = getActiveProviderType(profile);
  const primaryLabel = getProviderLabel(activeType);
  const avatarUri =
    profile.identity?.avatar_media?.preview_url ??
    profile.identity?.avatar_media?.download_url ??
    null;
  const fitCopy = cta ? buildFitCopy(profile, cta) : null;
  const fitSignals = buildFitSignals(profile).slice(0, 2);
  const trustMetrics = buildTrustMetrics(profile)
    .slice(0, 3)
    .map((metric) => {
      if (metric.key === "rating" && profile.rating_bayesian === null) {
        return { ...metric, label: "Puan" };
      }
      if (metric.key === "jobs" && profile.completed_jobs_30d === 0) {
        return { ...metric, label: "İş" };
      }
      return metric;
    });
  const districtLabel = profile.location_summary.primary_district_label;
  const cityLabel = profile.location_summary.city_label;
  const radiusKm = profile.location_summary.service_radius_km;
  const showHelper = Boolean(cta?.helperText);

  return (
    <View className="gap-3">
      <View className="rounded-[20px] border border-app-outline bg-app-surface px-3.5 py-3">
        <View className="flex-row items-center gap-3">
        <View className="relative">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${profile.display_name} tam profilini aç`}
            onPress={onOpenFull}
            hitSlop={8}
            className="active:opacity-80"
          >
            <View className="rounded-full border-2 border-brand-500/50 bg-app-surface-2 p-1">
              <Avatar name={profile.display_name} imageUri={avatarUri} size="lg" />
            </View>
          </Pressable>
          <View className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border border-app-surface bg-app-info">
            <Icon
              icon={MousePointerClick}
              size={10}
              color={colors.surface}
              strokeWidth={2.5}
            />
          </View>
        </View>

        <View className="min-w-0 flex-1 gap-1.5">
          <View className="gap-0.5">
            <Text
              variant="h2"
              tone="inverse"
              className="text-[18px] leading-[22px]"
              numberOfLines={1}
            >
              {profile.display_name}
            </Text>
            {profile.tagline ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
                numberOfLines={1}
              >
                {profile.tagline}
              </Text>
            ) : null}
          </View>

          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
            numberOfLines={1}
          >
            {primaryLabel} · {verified.label} ·{" "}
            {profile.accepting_new_jobs ? "İş alıyor" : "Yoğun"}
          </Text>
        </View>
        </View>
      </View>

      {fitCopy ? (
        <View
          className="gap-2 rounded-[15px] border px-3 py-2.5"
          style={{
            backgroundColor:
              fitCopy.tone === "success"
                ? withAlphaHex(colors.success, 0.09)
                : fitCopy.tone === "warning"
                  ? withAlphaHex(colors.warning, 0.12)
                  : withAlphaHex(colors.info, 0.09),
            borderColor:
              fitCopy.tone === "success"
                ? withAlphaHex(colors.success, 0.26)
                : fitCopy.tone === "warning"
                  ? withAlphaHex(colors.warning, 0.3)
                  : withAlphaHex(colors.info, 0.22),
          }}
        >
          <View className="flex-row items-center gap-2">
            <Icon
              icon={fitCopy.tone === "success" ? CheckCircle2 : Wrench}
              size={14}
              color={
                fitCopy.tone === "success"
                  ? colors.success
                  : fitCopy.tone === "warning"
                    ? colors.warning
                    : colors.info
              }
            />
            <Text variant="label" tone="inverse" className="text-[13px]">
              {fitCopy.title}
            </Text>
          </View>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted leading-[17px]"
            numberOfLines={2}
          >
            {fitCopy.body}
          </Text>
          {fitSignals.length > 0 && fitCopy.tone !== "warning" ? (
            <View className="flex-row flex-wrap gap-1.5">
              {fitSignals.map((signal) => (
                <View
                  key={signal}
                  className="rounded-full border border-app-outline bg-app-surface px-2.5 py-1"
                >
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[10px]"
                    numberOfLines={1}
                  >
                    {signal}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row gap-2">
        {trustMetrics.map((metric) => {
          const MetricIcon = TRUST_ICON[metric.key as keyof typeof TRUST_ICON];
          const iconColor =
            metric.tone === "success"
              ? colors.success
              : metric.tone === "warning"
                ? colors.warning
                : metric.tone === "info"
                  ? colors.info
                  : colors.textMuted;
          return (
            <PreviewMetric
              key={metric.key}
              icon={MetricIcon}
              iconColor={iconColor}
              value={metric.value}
              label={metric.label}
            />
          );
        })}
      </View>

      {districtLabel || cityLabel ? (
        <View className="flex-row items-center gap-2 rounded-[14px] border border-app-outline bg-app-surface px-3.5 py-2.5">
          <Icon icon={MapPin} size={13} color={colors.info} />
          <Text variant="caption" tone="muted" className="flex-1 text-[12px]">
            {[districtLabel, cityLabel].filter(Boolean).join(" · ")}
            {radiusKm ? ` · ${radiusKm} km hizmet` : ""}
          </Text>
        </View>
      ) : null}

      <View className="gap-1.5">
        <Button
          label={
            contextLoading
              ? "Vaka eşleşmesi yükleniyor…"
              : cta?.primaryLabel ?? "—"
          }
          size="lg"
          fullWidth
          disabled={
            contextLoading ||
            !cta ||
            cta.primaryDisabled ||
            primaryPending
          }
          variant={
            contextLoading || !cta || cta.primaryDisabled
              ? "surface"
              : cta.mode === "ready"
                ? "primary"
                : "secondary"
          }
          className={
            contextLoading || !cta || cta.primaryDisabled
              ? "border-app-outline bg-app-surface-2 opacity-100"
              : undefined
          }
          labelClassName={
            contextLoading || !cta || cta.primaryDisabled
              ? "text-app-text-muted"
              : undefined
          }
          onPress={onPrimary}
        />
        {showHelper && !contextLoading ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-subtle text-[11px]"
          >
            {cta?.helperText}
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
    <View className="flex-1 items-center gap-0.5 rounded-[13px] border border-app-outline bg-app-surface px-2 py-1.5">
      <Icon icon={icon} size={12} color={iconColor} strokeWidth={2.5} />
      <Text variant="label" tone="inverse" className="text-[12px]">
        {value}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-subtle text-[10px]"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
