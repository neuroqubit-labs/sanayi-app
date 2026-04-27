import {
  Avatar,
  GlassIconBadge,
  NARO_LOGO,
  PressableCard,
  Text,
  TrustBadge,
  useNaroTheme,
  withAlphaHex,
  type NaroThemePalette,
  type ThemeScheme,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Star,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import {
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";

import { useUstaPreviewStore } from "../preview-store";
import { getPrimaryMediaUrl } from "../profile-view-model";
import type { TechnicianFeedItem } from "../schemas";

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

type ShowcaseTile = {
  title: string;
  caption: string;
  tone: "info" | "success" | "warning";
  imageUri?: string | null;
};

export type TechnicianFeedCardProps = {
  item: TechnicianFeedItem;
  itemHeight?: number;
  sectionTitle?: string;
};

export function TechnicianFeedCard({
  item,
  itemHeight,
  sectionTitle,
}: TechnicianFeedCardProps) {
  const router = useRouter();
  const { colors, scheme } = useNaroTheme();
  const { width } = useWindowDimensions();
  const activeType = item.active_provider_type ?? item.provider_type;
  const primaryLabel =
    PROVIDER_TYPE_LABEL[activeType] ?? PROVIDER_TYPE_LABEL.usta ?? "Servis";
  const secondaryLabels = item.secondary_provider_types
    .filter((t) => t !== activeType)
    .map((t) => PROVIDER_TYPE_LABEL[t])
    .filter((label): label is string => Boolean(label));
  const verified = VERIFIED_META[item.verified_level];
  const ratingValue =
    item.rating_bayesian !== null ? item.rating_bayesian.toFixed(1) : null;
  const districtLabel = item.location_summary.primary_district_label;
  const cityLabel = item.location_summary.city_label;
  const radiusKm = item.location_summary.service_radius_km;
  const compact = itemHeight ? itemHeight < 720 || width < 390 : width < 390;
  const cardWidth = Math.max(260, width - 40);
  const showcaseHeight = compact ? 154 : 178;
  const quickBarParts: string[] = [];

  if (ratingValue) quickBarParts.push(`${ratingValue}★`);
  if (districtLabel) quickBarParts.push(districtLabel);
  if (radiusKm) quickBarParts.push(`${radiusKm} km hizmet`);

  const quickBarLabel = quickBarParts.join(" · ");
  const specialtyPreview = [primaryLabel, ...secondaryLabels].slice(0, 2);
  const overflowSpecialtyCount = Math.max(
    0,
    secondaryLabels.length + 1 - specialtyPreview.length,
  );
  const showcaseTiles = buildShowcaseTiles({
    acceptingNewJobs: item.accepting_new_jobs,
    completedJobs30d: item.completed_jobs_30d,
    districtLabel,
    cityLabel,
    primaryLabel,
    ratingCount: item.rating_count,
    ratingValue,
    proofPreview: item.proof_preview,
    caseShowcases: item.case_showcases,
    secondaryLabels,
  });

  const openPreview = useUstaPreviewStore((state) => state.open);
  const closePreview = useUstaPreviewStore((state) => state.close);
  const showPreview = () => openPreview(item.id, item);
  const openFullProfile = () => {
    closePreview();
    router.push(`/usta/${item.id}` as Href);
  };

  return (
    <PressableCard
      variant="elevated"
      radius="xl"
      className="flex-1 overflow-hidden"
      onPress={showPreview}
      accessibilityLabel={`${item.display_name} önizlemesini aç`}
      style={{
        backgroundColor: colors.surface,
        borderColor: withAlphaHex(colors.info, scheme === "dark" ? 0.26 : 0.16),
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: scheme === "dark" ? 0.28 : 0.16,
        shadowRadius: 28,
        elevation: 12,
      }}
    >
      <TechnicianMediaHero
        acceptingNewJobs={item.accepting_new_jobs}
        colors={colors}
        compact={compact}
        scheme={scheme}
        subtitle={quickBarLabel}
        title={primaryLabel}
        verifiedLabel={verified.label}
        verifiedTone={verified.tone}
        width={cardWidth}
      />

      <View
        className={[
          "flex-1 justify-between px-4 pt-3",
          compact ? "gap-2 pb-3" : "gap-3 pb-4",
        ].join(" ")}
      >
        <View className="flex-row items-start gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.display_name} tam profilini aç`}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              openFullProfile();
            }}
            className="rounded-[24px] active:opacity-85"
          >
            <View
              className="rounded-[24px] border p-1"
              style={{
                backgroundColor: withAlphaHex(
                  colors.surface,
                  scheme === "dark" ? 0.24 : 0.78,
                ),
                borderColor: withAlphaHex(colors.info, 0.28),
              }}
            >
              <Avatar name={item.display_name} size="lg" />
            </View>
          </Pressable>

          <View className="min-w-0 flex-1 gap-2">
            <View className="gap-1">
              <Text
                variant="h2"
                tone="inverse"
                className="text-[20px] leading-[24px]"
                numberOfLines={1}
              >
                {item.display_name}
              </Text>
              {item.tagline ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px] leading-[17px]"
                  numberOfLines={compact ? 1 : 2}
                >
                  {item.tagline}
                </Text>
              ) : null}
            </View>

            <View className="flex-row flex-wrap gap-1.5">
              {specialtyPreview.map((label, index) => (
                <SpecialtyChip
                  key={`${label}-${index}`}
                  label={label}
                  highlighted={index === 0}
                />
              ))}
              {overflowSpecialtyCount > 0 ? (
                <SpecialtyChip label={`+${overflowSpecialtyCount}`} />
              ) : null}
            </View>
          </View>
        </View>

        {sectionTitle ? (
          <View
            style={{
              backgroundColor: withAlphaHex(
                item.context_group === "primary"
                  ? colors.info
                  : colors.outlineStrong,
                item.context_group === "primary" ? 0.18 : 0.22,
              ),
              borderColor: withAlphaHex(
                item.context_group === "primary"
                  ? colors.info
                  : colors.outlineStrong,
                0.45,
              ),
            }}
            className="self-start flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
          >
            {item.context_group === "primary" ? (
              <CheckCircle2
                size={12}
                color={colors.info}
                strokeWidth={2.5}
              />
            ) : null}
            <Text
              variant="label"
              className="text-[11px] uppercase tracking-[0.08em]"
              style={{
                color:
                  item.context_group === "primary"
                    ? colors.info
                    : colors.textMuted,
              }}
              numberOfLines={1}
            >
              {sectionTitle}
            </Text>
          </View>
        ) : null}

        <ContextSignalRail item={item} colors={colors} scheme={scheme} />

        <ShowcaseBand
          colors={colors}
          height={showcaseHeight}
          scheme={scheme}
          tiles={showcaseTiles}
          width={cardWidth}
        />

        <MetricRail
          cityLabel={cityLabel}
          colors={colors}
          completedJobs30d={item.completed_jobs_30d}
          compact={compact}
          districtLabel={districtLabel}
          ratingCount={item.rating_count}
          ratingValue={ratingValue}
          radiusKm={radiusKm}
          scheme={scheme}
        />
      </View>
    </PressableCard>
  );
}

type ContextChip = {
  label: string;
  tone: "success" | "info" | "warning" | "neutral";
};

function buildContextChips(item: TechnicianFeedItem): ContextChip[] {
  const chips: ContextChip[] = [];
  if (item.can_notify) {
    chips.push({
      label: item.notify_badge ?? "Bildirilebilir",
      tone: "success",
    });
  } else if (item.notify_state === "already_notified") {
    chips.push({ label: "Bildirildi", tone: "info" });
  } else if (item.notify_state === "has_offer") {
    chips.push({ label: "Teklif geldi", tone: "success" });
  } else if (item.notify_state === "limit_reached") {
    chips.push({ label: "Limit doldu", tone: "warning" });
  } else if (item.context_group === "other") {
    chips.push({ label: "Bu vaka için uygun değil", tone: "neutral" });
  }

  if (item.match_badge) {
    chips.push({
      label: item.match_badge,
      tone: item.context_group === "primary" ? "info" : "neutral",
    });
  }

  for (const badge of item.fit_badges.slice(0, 3)) {
    chips.push({ label: badge, tone: "neutral" });
  }

  return chips.slice(0, 5);
}

function ContextSignalRail({
  item,
  colors,
  scheme,
}: {
  item: TechnicianFeedItem;
  colors: NaroThemePalette;
  scheme: ThemeScheme;
}) {
  const chips = buildContextChips(item);
  if (chips.length === 0 && !item.match_reason_label) return null;

  return (
    <View
      className="gap-2 rounded-[18px] border px-3 py-2.5"
      style={{
        backgroundColor: withAlphaHex(
          item.context_group === "primary" ? colors.infoSoft : colors.surface2,
          scheme === "dark" ? 0.42 : 0.74,
        ),
        borderColor: withAlphaHex(
          item.context_group === "primary" ? colors.info : colors.outlineStrong,
          item.context_group === "primary" ? 0.24 : 0.36,
        ),
      }}
    >
      {item.match_reason_label ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[16px]"
          numberOfLines={2}
        >
          {item.match_reason_label}
        </Text>
      ) : null}
      {chips.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {chips.map((chip) => (
            <ContextChipPill
              key={`${chip.label}-${chip.tone}`}
              chip={chip}
              colors={colors}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ContextChipPill({
  chip,
  colors,
}: {
  chip: ContextChip;
  colors: NaroThemePalette;
}) {
  const color =
    chip.tone === "success"
      ? colors.success
      : chip.tone === "warning"
        ? colors.warning
        : chip.tone === "info"
          ? colors.info
          : colors.textMuted;
  return (
    <View
      className="rounded-full border px-2.5 py-1"
      style={{
        backgroundColor: withAlphaHex(color, 0.1),
        borderColor: withAlphaHex(color, 0.24),
      }}
    >
      <Text
        variant="caption"
        tone="muted"
        className="text-[10px] leading-[13px]"
        style={{ color }}
        numberOfLines={1}
      >
        {chip.label}
      </Text>
    </View>
  );
}

function buildShowcaseTiles({
  acceptingNewJobs,
  completedJobs30d,
  districtLabel,
  cityLabel,
  primaryLabel,
  caseShowcases,
  proofPreview,
  ratingCount,
  ratingValue,
  secondaryLabels,
}: {
  acceptingNewJobs: boolean;
  completedJobs30d: number;
  districtLabel?: string | null;
  cityLabel?: string | null;
  primaryLabel: string;
  caseShowcases: TechnicianFeedItem["case_showcases"];
  proofPreview: TechnicianFeedItem["proof_preview"];
  ratingCount: number;
  ratingValue: string | null;
  secondaryLabels: string[];
}): ShowcaseTile[] {
  const locationLabel = districtLabel ?? cityLabel ?? "Yakında";
  const activityTitle =
    completedJobs30d > 0
      ? `${completedJobs30d} iş`
      : acceptingNewJobs
        ? "İş alıyor"
      : "Yoğun";

  if (caseShowcases.length > 0) {
    return caseShowcases.slice(0, 3).map((item, index) => ({
      title: item.kind_label,
      caption: item.location_label ?? item.month_label ?? "doğrulanmış iş",
      tone: index === 0 ? "success" : index === 1 ? "info" : "warning",
      imageUri:
        item.media?.media.thumb_url ??
        item.media?.media.preview_url ??
        item.media?.media.download_url ??
        null,
    }));
  }

  if (proofPreview.length > 0) {
    return proofPreview.slice(0, 3).map((item, index) => ({
      title:
        item.title ??
        (index === 0 ? primaryLabel : item.kind === "video" ? "Video kanıt" : "İş kanıtı"),
      caption: item.caption ?? (item.kind === "video" ? "vitrin videosu" : locationLabel),
      tone: index === 0 ? "info" : index === 1 ? "success" : "warning",
      imageUri: getPrimaryMediaUrl(item),
    }));
  }

  return [
    {
      title: primaryLabel,
      caption: locationLabel,
      tone: "info",
    },
    {
      title: secondaryLabels[0] ?? "İşçilik",
      caption: completedJobs30d > 0 ? "son 30 gün" : "usta vitrini",
      tone: "success",
    },
    {
      title: ratingValue ?? activityTitle,
      caption: ratingValue ? `${ratingCount} değerlendirme` : "doğrulanmış",
      tone: "warning",
    },
  ];
}

type TechnicianMediaHeroProps = {
  width: number;
  title: string;
  subtitle: string;
  verifiedLabel: string;
  verifiedTone: "info" | "accent" | "success";
  acceptingNewJobs: boolean;
  compact: boolean;
  colors: NaroThemePalette;
  scheme: ThemeScheme;
};

function TechnicianMediaHero({
  width,
  title,
  subtitle,
  verifiedLabel,
  verifiedTone,
  acceptingNewJobs,
  compact,
  colors,
  scheme,
}: TechnicianMediaHeroProps) {
  const heroHeight = compact ? 150 : 164;
  const heroBackground = withAlphaHex(
    scheme === "dark" ? colors.bgMuted : colors.text,
    scheme === "dark" ? 0.82 : 0.76,
  );
  const heroFilm = withAlphaHex(colors.info, scheme === "dark" ? 0.16 : 0.2);

  return (
    <View className="relative overflow-hidden" style={{ height: heroHeight }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
      >
        <View
          className="overflow-hidden px-4 py-4"
          style={{ width, height: heroHeight, backgroundColor: heroBackground }}
        >
          <View
            pointerEvents="none"
            className="absolute inset-0"
            style={{ backgroundColor: heroFilm }}
          />
          <View
            pointerEvents="none"
            className="absolute -right-14 -top-14 h-52 w-52 rounded-full"
            style={{ backgroundColor: withAlphaHex(colors.infoSoft, 0.18) }}
          />
          <View
            pointerEvents="none"
            className="absolute -left-16 bottom-[-54px] h-44 w-44 rounded-full"
            style={{ backgroundColor: withAlphaHex(colors.surface, 0.08) }}
          />
          <View
            pointerEvents="none"
            className="absolute right-4 top-8 rounded-[28px] border px-4 py-3"
            style={{
              backgroundColor: withAlphaHex(colors.surface, 0.06),
              borderColor: withAlphaHex(colors.surface, 0.1),
              transform: [{ rotate: "-6deg" }],
            }}
          >
            <Text
              variant="h2"
              tone="neutral"
              className="text-[32px] leading-[36px]"
              style={{ color: withAlphaHex(colors.surface, 0.16) }}
            >
              Naro
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <TrustBadge label={verifiedLabel} tone={verifiedTone} />
            {acceptingNewJobs ? (
              <TrustBadge
                label="İş alıyor"
                tone="success"
                icon={CheckCircle2}
              />
            ) : null}
          </View>

          <View className={["mt-auto", compact ? "gap-2" : "gap-3"].join(" ")}>
            <View className="flex-row items-end justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text
                  variant="eyebrow"
                  tone="neutral"
                  className="text-[11px]"
                  style={{ color: withAlphaHex(colors.surface, 0.74) }}
                  numberOfLines={1}
                >
                  Atölye vitrini
                </Text>
                <Text
                  variant="h2"
                  tone="neutral"
                  className="text-[22px] leading-[25px]"
                  style={{ color: colors.surface }}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>
              <GlassIconBadge
                icon={ShieldCheck}
                color={colors.info}
                surfaceColor={colors.infoSoft}
                size="sm"
              />
            </View>

            {subtitle ? (
              <View
                className="self-start rounded-full border px-3 py-1.5"
                style={{
                  backgroundColor: withAlphaHex(colors.surface, 0.12),
                  borderColor: withAlphaHex(colors.surface, 0.16),
                }}
              >
                <Text
                  variant="caption"
                  tone="neutral"
                  className="text-[11px]"
                  style={{ color: withAlphaHex(colors.surface, 0.86) }}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-3 right-4 flex-row gap-1.5">
        <View className="h-1.5 w-4 rounded-full bg-app-surface" />
        <View
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: withAlphaHex(colors.surface, 0.36) }}
        />
        <View
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: withAlphaHex(colors.surface, 0.24) }}
        />
      </View>
    </View>
  );
}

function MetricRail({
  cityLabel,
  colors,
  completedJobs30d,
  compact,
  districtLabel,
  ratingCount,
  ratingValue,
  radiusKm,
  scheme,
}: {
  cityLabel?: string | null;
  colors: NaroThemePalette;
  completedJobs30d: number;
  compact: boolean;
  districtLabel?: string | null;
  ratingCount: number;
  ratingValue: string | null;
  radiusKm?: number | null;
  scheme: ThemeScheme;
}) {
  return (
    <View
      className={[
        "flex-row items-center gap-2 rounded-[18px] border px-3",
        compact ? "py-2" : "py-2.5",
      ].join(" ")}
      style={{
        backgroundColor: withAlphaHex(
          colors.infoSoft,
          scheme === "dark" ? 0.42 : 0.7,
        ),
        borderColor: withAlphaHex(colors.info, 0.2),
      }}
    >
      <DecisionPoint
        color={colors.warning}
        icon={Star}
        label={ratingValue ? `${ratingCount} yorum` : "İlk yorum"}
        surfaceColor={colors.warningSoft}
        value={ratingValue ?? "Yeni"}
      />
      <Divider colors={colors} compact={compact} />
      <DecisionPoint
        color={colors.info}
        icon={MapPin}
        label={cityLabel && districtLabel ? cityLabel : "Konum"}
        surfaceColor={colors.infoSoft}
        value={districtLabel ?? cityLabel ?? "Yakında"}
      />
      <Divider colors={colors} compact={compact} />
      <DecisionPoint
        color={colors.success}
        icon={Wrench}
        label={completedJobs30d > 0 ? "30g iş" : "Hizmet"}
        surfaceColor={colors.successSoft}
        value={
          completedJobs30d > 0
            ? completedJobs30d.toString()
            : radiusKm
              ? `${radiusKm} km`
              : "Hazır"
        }
      />
    </View>
  );
}

function DecisionPoint({
  icon,
  color,
  surfaceColor,
  value,
  label,
}: {
  icon: LucideIcon;
  color: string;
  surfaceColor: string;
  value: string;
  label: string;
}) {
  return (
    <View className="min-w-0 flex-1 items-center gap-1">
      <GlassIconBadge
        icon={icon}
        color={color}
        surfaceColor={surfaceColor}
        size="sm"
      />
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

function ShowcaseBand({
  colors,
  height,
  scheme,
  tiles,
  width,
}: {
  colors: NaroThemePalette;
  height: number;
  scheme: ThemeScheme;
  tiles: ShowcaseTile[];
  width: number;
}) {
  const tileHeight = height - 16;
  const tileWidth = Math.max(152, Math.min(214, (width - 74) * 0.48));

  return (
    <View
      className="overflow-hidden rounded-[22px] border p-2"
      style={{
        height,
        backgroundColor: withAlphaHex(
          colors.surface2,
          scheme === "dark" ? 0.76 : 0.92,
        ),
        borderColor: withAlphaHex(colors.outlineStrong, 0.4),
      }}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-1"
      >
        {tiles.map((tile, index) => (
          <ShowcaseTileCard
            key={`${tile.title}-${index}`}
            colors={colors}
            height={tileHeight}
            scheme={scheme}
            tile={tile}
            width={tileWidth}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ShowcaseTileCard({
  colors,
  height,
  scheme,
  tile,
  width,
}: {
  colors: NaroThemePalette;
  height: number;
  scheme: ThemeScheme;
  tile: ShowcaseTile;
  width: number;
}) {
  const toneColor = getToneColor(colors, tile.tone);
  const toneSurface = getToneSurface(colors, tile.tone);

  return (
    <View
      className="overflow-hidden rounded-[18px] border px-4 py-3"
      style={{
        width,
        height,
        backgroundColor: withAlphaHex(
          toneSurface,
          scheme === "dark" ? 0.34 : 0.78,
        ),
        borderColor: withAlphaHex(toneColor, scheme === "dark" ? 0.32 : 0.2),
      }}
    >
      {tile.imageUri ? (
        <>
          <Image
            source={{ uri: tile.imageUri }}
            resizeMode="cover"
            className="absolute inset-0 h-full w-full"
          />
          <View
            pointerEvents="none"
            className="absolute inset-0"
            style={{
              backgroundColor: withAlphaHex(
                colors.bg,
                scheme === "dark" ? 0.42 : 0.32,
              ),
            }}
          />
        </>
      ) : (
        <>
          <View
            pointerEvents="none"
            className="absolute -right-7 -top-9 h-32 w-32 rounded-full"
            style={{ backgroundColor: withAlphaHex(toneColor, 0.14) }}
          />
          <Image
            source={NARO_LOGO}
            resizeMode="contain"
            className="absolute bottom-3 right-3 h-12 w-12 opacity-20"
          />
        </>
      )}
      <View className="mt-auto gap-0.5">
        <Text
          variant="label"
          tone="inverse"
          className="text-[16px] leading-[19px]"
          numberOfLines={1}
        >
          {tile.title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[15px]"
          numberOfLines={1}
        >
          {tile.caption}
        </Text>
      </View>
    </View>
  );
}

function Divider({
  colors,
  compact,
}: {
  colors: NaroThemePalette;
  compact: boolean;
}) {
  return (
    <View
      className={compact ? "h-9 w-px" : "h-10 w-px"}
      style={{ backgroundColor: withAlphaHex(colors.outlineStrong, 0.48) }}
    />
  );
}

function getToneColor(colors: NaroThemePalette, tone: ShowcaseTile["tone"]) {
  if (tone === "success") return colors.success;
  if (tone === "warning") return colors.warning;
  return colors.info;
}

function getToneSurface(colors: NaroThemePalette, tone: ShowcaseTile["tone"]) {
  if (tone === "success") return colors.successSoft;
  if (tone === "warning") return colors.warningSoft;
  return colors.infoSoft;
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
