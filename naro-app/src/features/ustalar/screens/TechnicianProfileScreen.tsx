import {
  ActionSheetSurface,
  Avatar,
  BackButton,
  BottomSheetOverlay,
  Button,
  Icon,
  Screen,
  StatusChip,
  Text,
  TrustBadge,
  useNaroTheme,
  withAlphaHex,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react-native";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMyCasesLive } from "@/features/cases/api";
import { useFavoriteTechniciansStore } from "@/features/profile";

import { useTechnicianPublicView, useTechnicianShowcaseDetail } from "../api";
import {
  VERIFIED_META,
  buildFitCopy,
  buildFitSignals,
  buildOperationItems,
  buildTrustMetrics,
  getActiveProviderType,
  getPrimaryMediaUrl,
  getProviderLabel,
  getSecondaryProviderLabels,
} from "../profile-view-model";
import type {
  ProofPreviewItem,
  PublicCaseShowcaseDetail,
  PublicCaseShowcasePreview,
  TechnicianPublicView,
} from "../schemas";
import { resolveTechnicianCta } from "../technician-cta";

const TRUST_ICON = {
  rating: Star,
  response: Clock,
  jobs: Wrench,
  certificates: BadgeCheck,
} as const;

/**
 * Teknisyen tam profili — karar akışı:
 * Uyum -> Güven -> Kanıt -> Operasyon -> Hakkında -> CTA.
 *
 * PII mask invariant (I-9): phone/email/legal/tax/iban/adres response'ta yok.
 */
export function TechnicianProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const technicianId = id ?? "";
  const { colors } = useNaroTheme();
  const [selectedShowcaseId, setSelectedShowcaseId] = useState<string | null>(
    null,
  );

  const { data: technician, isLoading, isError, refetch } =
    useTechnicianPublicView(technicianId);
  const showcaseDetailQuery = useTechnicianShowcaseDetail(
    technicianId,
    selectedShowcaseId ?? "",
  );
  const { data: myCases } = useMyCasesLive();

  const isFavorite = useFavoriteTechniciansStore((state) =>
    state.ids.includes(technicianId),
  );
  const toggleFavorite = useFavoriteTechniciansStore((state) => state.toggle);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color={colors.info} />
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

  const activeType = getActiveProviderType(technician);
  const primaryLabel = getProviderLabel(activeType);
  const verified = VERIFIED_META[technician.verified_level];
  const secondaryLabels = getSecondaryProviderLabels(technician);
  const proofItems = technician.proof_preview;
  const caseShowcases = technician.case_showcases;
  const heroMediaUrl = proofItems[0] ? getPrimaryMediaUrl(proofItems[0]) : null;
  const avatarUri =
    technician.identity?.avatar_media?.preview_url ??
    technician.identity?.avatar_media?.download_url ??
    null;

  const cta = resolveTechnicianCta({
    technicianId: technician.id,
    providerType: activeType,
    activeCases: myCases ?? [],
    acceptingNewJobs: technician.accepting_new_jobs,
  });
  const fitCopy = buildFitCopy(technician, cta);
  const fitSignals = buildFitSignals(technician);
  const trustMetrics = buildTrustMetrics(technician);
  const operationItems = buildOperationItems(technician);
  const aboutText =
    technician.about?.biography ?? technician.biography ?? technician.tagline;
  const showCtaHelper = Boolean(cta.helperText && cta.mode !== "mismatch");

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
          hitSlop={8}
          className={`h-11 w-11 items-center justify-center rounded-full border ${
            isFavorite
              ? "border-app-critical/40 bg-app-critical/10"
              : "border-app-outline bg-app-surface"
          } active:opacity-80`}
        >
          <Icon
            icon={Heart}
            size={18}
            color={isFavorite ? colors.critical : colors.textMuted}
            strokeWidth={isFavorite ? 2.5 : 2}
            fill={isFavorite ? colors.critical : "transparent"}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <HeroCard
          technician={technician}
          primaryLabel={primaryLabel}
          secondaryLabels={secondaryLabels}
          verifiedLabel={verified.label}
          verifiedTone={verified.tone}
          heroMediaUrl={heroMediaUrl}
          avatarUri={avatarUri}
        />

        <DecisionSection
          title="Vakanla uyum"
          icon={<Icon icon={Sparkles} size={15} color={colors.info} />}
        >
          <View
            className={[
              "border",
              fitCopy.tone === "warning"
                ? "gap-2 rounded-[18px] px-3.5 py-3"
                : "gap-3 rounded-[20px] px-4 py-4",
            ].join(" ")}
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
            <View className="flex-row items-start gap-2.5">
              <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-app-surface">
                <Icon
                  icon={fitCopy.tone === "warning" ? Wrench : CheckCircle2}
                  size={14}
                  color={
                    fitCopy.tone === "success"
                      ? colors.success
                      : fitCopy.tone === "warning"
                        ? colors.warning
                        : colors.info
                  }
                  strokeWidth={2.5}
                />
              </View>
              <View className="flex-1 gap-1">
                <Text variant="label" tone="inverse" className="text-[14px]">
                  {fitCopy.title}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted leading-[18px]"
                >
                  {fitCopy.body}
                </Text>
              </View>
            </View>
            {fitSignals.length > 0 && fitCopy.tone !== "warning" ? (
              <View className="flex-row flex-wrap gap-2">
                {fitSignals.map((label) => (
                  <SpecialtyChip key={label} label={label} />
                ))}
              </View>
            ) : null}
          </View>
        </DecisionSection>

        <DecisionSection
          title="Güven özeti"
          icon={<Icon icon={ShieldCheck} size={15} color={colors.success} />}
        >
          <View className="flex-row flex-wrap gap-2">
            {trustMetrics.map((metric) => {
              const MetricIcon =
                TRUST_ICON[metric.key as keyof typeof TRUST_ICON];
              const iconColor =
                metric.tone === "success"
                  ? colors.success
                  : metric.tone === "warning"
                    ? colors.warning
                    : metric.tone === "info"
                      ? colors.info
                      : colors.textMuted;
              return (
                <MetricCard
                  key={metric.key}
                  icon={<Icon icon={MetricIcon} size={14} color={iconColor} />}
                  value={metric.value}
                  label={metric.label}
                />
              );
            })}
          </View>
        </DecisionSection>

        <DecisionSection
          title="Kanıt vitrini"
          icon={<Icon icon={Camera} size={15} color={colors.info} />}
        >
          <ProofShowcase items={proofItems} />
        </DecisionSection>

        {caseShowcases.length > 0 ? (
          <DecisionSection
            title="Doğrulanmış işler"
            icon={<Icon icon={BadgeCheck} size={15} color={colors.success} />}
          >
            <CaseShowcaseList
              items={caseShowcases}
              onPress={(item) => setSelectedShowcaseId(item.id)}
            />
          </DecisionSection>
        ) : null}

        {operationItems.length > 0 ? (
          <DecisionSection
            title="Operasyon"
            icon={<Icon icon={MapPin} size={15} color={colors.info} />}
          >
            <View className="gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
              {operationItems.map((item) => (
                <View key={item} className="flex-row items-center gap-2">
                  <View className="h-1.5 w-1.5 rounded-full bg-app-info" />
                  <Text
                    variant="caption"
                    tone="muted"
                    className="flex-1 text-app-text-muted"
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </DecisionSection>
        ) : null}

        {aboutText ? (
          <DecisionSection title="Hakkında">
            <View className="rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
              <Text
                variant="body"
                tone="muted"
                className="text-app-text leading-6 text-[14px]"
              >
                {aboutText}
              </Text>
            </View>
          </DecisionSection>
        ) : null}

        <View className="mx-4 gap-2">
          <Button
            label={
              cta.mode === "mismatch" ? "Randevu alınamaz" : cta.primaryLabel
            }
            variant={
              cta.primaryDisabled
                ? "surface"
                : cta.mode === "ready"
                  ? "primary"
                  : "secondary"
            }
            size="lg"
            fullWidth
            disabled={cta.primaryDisabled}
            className={
              cta.primaryDisabled
                ? "border-app-outline bg-app-surface-2 opacity-100"
                : undefined
            }
            labelClassName={
              cta.primaryDisabled ? "text-app-text-muted" : undefined
            }
            onPress={() => {
              if (cta.primaryDisabled || !cta.primaryRoute) return;
              router.push(cta.primaryRoute as Href);
            }}
          />
          {showCtaHelper ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-center text-app-text-subtle text-[11px]"
            >
              {cta.helperText}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <ShowcaseDetailSheet
        visible={Boolean(selectedShowcaseId)}
        detail={showcaseDetailQuery.data ?? null}
        isLoading={showcaseDetailQuery.isLoading}
        onClose={() => setSelectedShowcaseId(null)}
      />
    </Screen>
  );
}

function HeroCard({
  technician,
  primaryLabel,
  secondaryLabels,
  verifiedLabel,
  verifiedTone,
  heroMediaUrl,
  avatarUri,
}: {
  technician: TechnicianPublicView;
  primaryLabel: string;
  secondaryLabels: string[];
  verifiedLabel: string;
  verifiedTone: "info" | "accent" | "success";
  heroMediaUrl: string | null;
  avatarUri: string | null;
}) {
  const { colors } = useNaroTheme();
  return (
    <View className="mx-4 overflow-hidden rounded-[28px] border border-app-outline-strong bg-app-surface">
      <View
        className="relative h-44 overflow-hidden"
        style={{ backgroundColor: withAlphaHex(colors.info, 0.11) }}
      >
        {heroMediaUrl ? (
          <Image
            source={{ uri: heroMediaUrl }}
            resizeMode="cover"
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center">
            <Text
              variant="display"
              tone="accent"
              className="text-[42px] leading-[48px] opacity-20"
            >
              Naro
            </Text>
          </View>
        )}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: heroMediaUrl
                ? withAlphaHex(colors.bg, 0.44)
                : withAlphaHex(colors.info, 0.08),
            },
          ]}
        />
        <View className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-brand-500/20" />
        <View className="absolute left-4 right-4 top-4 flex-row items-start justify-between gap-3">
          <TrustBadge label={primaryLabel} tone="accent" />
          <View className="flex-row flex-wrap justify-end gap-2">
            <TrustBadge label={verifiedLabel} tone={verifiedTone} />
            {technician.accepting_new_jobs ? (
              <StatusChip label="İş alıyor" tone="success" icon={CheckCircle2} />
            ) : (
              <StatusChip label="Yoğun" tone="neutral" />
            )}
          </View>
        </View>
      </View>

      <View className="-mt-12 items-center gap-3 px-5 pb-5">
        <View className="rounded-full border-4 border-app-surface bg-app-surface-2 p-1">
          <Avatar
            name={technician.display_name}
            imageUri={avatarUri}
            size="xl"
          />
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
          {secondaryLabels.map((label) => (
            <SpecialtyChip key={label} label={label} />
          ))}
          {technician.provider_mode === "business" ? (
            <SpecialtyChip label="İşletme" />
          ) : (
            <SpecialtyChip label="Bireysel" />
          )}
        </View>
      </View>
    </View>
  );
}

function DecisionSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="mx-4 gap-2.5">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text variant="eyebrow" tone="subtle">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function ProofShowcase({ items }: { items: ProofPreviewItem[] }) {
  const visibleItems = items.slice(0, 4);
  if (visibleItems.length === 0) {
    return (
      <View className="min-h-[116px] items-center justify-center gap-2 rounded-[20px] border border-dashed border-app-outline bg-app-surface px-4 py-5">
        <Text
          variant="display"
          tone="accent"
          className="text-[24px] leading-[30px] opacity-25"
        >
          Naro
        </Text>
        <Text variant="caption" tone="muted" className="text-center text-app-text-muted">
          Galeri eklendiğinde burada iş kanıtları görünecek.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {visibleItems.map((item) => (
        <ProofTile key={item.id} item={item} />
      ))}
    </View>
  );
}

function ProofTile({ item }: { item: ProofPreviewItem }) {
  const uri = getPrimaryMediaUrl(item);
  return (
    <View className="basis-[48%] overflow-hidden rounded-[18px] border border-app-outline bg-app-surface">
      <View className="h-28 bg-app-surface-2">
        {uri ? (
          <Image source={{ uri }} resizeMode="cover" className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text
              variant="display"
              tone="accent"
              className="text-[20px] leading-[26px] opacity-20"
            >
              Naro
            </Text>
          </View>
        )}
      </View>
      {(item.title || item.caption) ? (
        <View className="gap-0.5 px-3 py-2">
          {item.title ? (
            <Text variant="caption" tone="inverse" className="text-[12px]" numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          {item.caption ? (
            <Text variant="caption" tone="muted" className="text-app-text-subtle text-[10px]" numberOfLines={1}>
              {item.caption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CaseShowcaseList({
  items,
  onPress,
}: {
  items: PublicCaseShowcasePreview[];
  onPress: (item: PublicCaseShowcasePreview) => void;
}) {
  return (
    <View className="gap-2">
      {items.slice(0, 4).map((item) => (
        <CaseShowcaseCard key={item.id} item={item} onPress={() => onPress(item)} />
      ))}
    </View>
  );
}

function CaseShowcaseCard({
  item,
  onPress,
}: {
  item: PublicCaseShowcasePreview;
  onPress: () => void;
}) {
  const { colors } = useNaroTheme();
  const mediaUri =
    item.media?.media.thumb_url ??
    item.media?.media.preview_url ??
    item.media?.media.download_url ??
    null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} detayını aç`}
      hitSlop={8}
      onPress={onPress}
      className="min-h-[108px] flex-row gap-3 overflow-hidden rounded-[20px] border border-app-outline bg-app-surface px-3 py-3 active:bg-app-surface-2"
    >
      <View
        className="h-20 w-20 overflow-hidden rounded-[16px] bg-app-surface-2"
        style={{ backgroundColor: withAlphaHex(colors.info, 0.1) }}
      >
        {mediaUri ? (
          <Image source={{ uri: mediaUri }} resizeMode="cover" className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text variant="display" tone="accent" className="text-[18px] opacity-20">
              Naro
            </Text>
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row flex-wrap gap-1.5">
          <TrustBadge label={item.kind_label} tone="success" />
          {item.rating ? <TrustBadge label={`${item.rating}/5`} tone="warning" /> : null}
        </View>
        <Text variant="label" tone="inverse" numberOfLines={1}>
          {item.title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[17px]"
          numberOfLines={2}
        >
          {item.summary}
        </Text>
        <Text variant="caption" tone="subtle" className="text-[10px]">
          {[item.month_label, item.location_label].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

function ShowcaseDetailSheet({
  visible,
  detail,
  isLoading,
  onClose,
}: {
  visible: boolean;
  detail: PublicCaseShowcaseDetail | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <BottomSheetOverlay
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Doğrulanmış iş detayını kapat"
    >
      <ActionSheetSurface
        title={detail?.title ?? "Doğrulanmış iş"}
        description="Bu özet iki tarafın izniyle, kişisel ve finansal bilgiler çıkarılarak gösterilir."
      >
        {isLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator color={colors.info} />
          </View>
        ) : detail ? (
          <View className="gap-3">
            <Text
              variant="body"
              tone="muted"
              className="text-app-text-muted leading-6"
            >
              {detail.summary}
            </Text>
            {detail.media_items.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {detail.media_items.map((item) => {
                    const uri =
                      item.media.preview_url ??
                      item.media.thumb_url ??
                      item.media.download_url ??
                      null;
                    return (
                      <View
                        key={item.id}
                        className="h-28 w-36 overflow-hidden rounded-[16px] bg-app-surface-2"
                      >
                        {uri ? (
                          <Image
                            source={{ uri }}
                            resizeMode="cover"
                            className="h-full w-full"
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : null}
            {detail.delivery_report.length > 0 ? (
              <View className="gap-2 rounded-[16px] border border-app-outline bg-app-surface px-3 py-3">
                {detail.delivery_report.map((item) => (
                  <View
                    key={`${item.label}-${item.value}`}
                    className="flex-row justify-between gap-3"
                  >
                    <Text
                      variant="caption"
                      tone="muted"
                      className="flex-1 text-app-text-muted"
                    >
                      {item.label}
                    </Text>
                    <Text
                      variant="caption"
                      tone="inverse"
                      className="flex-1 text-right font-semibold"
                    >
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {detail.review_body ? (
              <View className="rounded-[16px] border border-app-warning/30 bg-app-warning-soft px-3 py-3">
                <Text variant="caption" tone="muted" className="text-app-text">
                  “{detail.review_body}”
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text variant="caption" tone="critical">
            Detay yüklenemedi.
          </Text>
        )}
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}

function MetricCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View className="min-w-[46%] flex-1 items-center gap-1 rounded-[14px] border border-app-outline bg-app-surface px-2 py-3">
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

function SpecialtyChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-app-outline bg-app-surface-2 px-3 py-1.5">
      <Text variant="caption" tone="muted" className="text-[11px]">
        {label}
      </Text>
    </View>
  );
}
