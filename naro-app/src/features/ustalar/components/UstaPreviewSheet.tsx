import {
  ActionSheetSurface,
  Avatar,
  Button,
  Icon,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  Briefcase,
  ChevronRight,
  Clock,
  Heart,
  Lock,
  MapPin,
  MousePointerClick,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Timer,
  X,
} from "lucide-react-native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  attachTechnicianToCase,
  prefillDraftForTechnician,
  useActiveCase,
  useTechnicianCaseAction,
} from "@/features/cases";
import {
  getCaseKindLabel,
  getCaseStatusLabel,
} from "@/features/cases/presentation";
import { useFavoriteTechniciansStore } from "@/features/profile";
import { useActiveVehicle } from "@/features/vehicles";

import { useTechnicianProfile } from "../api";
import { useUstaPreviewStore } from "../preview-store";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";

export function UstaPreviewSheet() {
  const technicianId = useUstaPreviewStore((state) => state.technicianId);
  const close = useUstaPreviewStore((state) => state.close);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profile } = useTechnicianProfile(technicianId ?? "");
  const action = useTechnicianCaseAction(technicianId ?? "");
  const { data: activeVehicle } = useActiveVehicle();
  const { data: activeCase } = useActiveCase();
  const isFavorite = useFavoriteTechniciansStore((state) =>
    technicianId ? state.ids.includes(technicianId) : false,
  );
  const toggleFavorite = useFavoriteTechniciansStore((state) => state.toggle);

  const offer =
    technicianId && activeCase
      ? (activeCase.offers.find((o) => o.technician_id === technicianId) ??
        null)
      : null;

  const isOpen = Boolean(technicianId);

  const openFullProfile = () => {
    if (!technicianId) return;
    close();
    router.push(`/usta/${technicianId}` as Href);
  };

  const openCaseManagement = () => {
    if (!activeCase) return;
    close();
    router.push(`/vaka/${activeCase.id}` as Href);
  };

  const handlePrimary = () => {
    if (!technicianId || action.disabled) return;
    if (action.attachOnPrimary && action.caseId) {
      attachTechnicianToCase(action.caseId, technicianId);
    }
    if (action.prefillOnPrimary) {
      prefillDraftForTechnician(
        action.kind,
        technicianId,
        activeVehicle?.id ?? DEFAULT_VEHICLE_ID,
      );
    }
    close();
    router.push(action.primaryRoute as Href);
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ön izlemeyi kapat"
        onPress={close}
        className="flex-1 justify-end bg-black/60"
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <ActionSheetSurface
            title="Usta önizleme"
            description="Kısa bilgi — tam profil için aşağıya dokun."
          >
            {profile ? (
              <View className="gap-4">
                <View className="absolute -right-1 -top-1 flex-row gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"
                    }
                    accessibilityState={{ selected: isFavorite }}
                    onPress={() => toggleFavorite(profile.id)}
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
                    onPress={close}
                    hitSlop={10}
                    className="h-8 w-8 items-center justify-center rounded-full border border-app-outline bg-app-surface"
                  >
                    <Icon icon={X} size={14} color="#83a7ff" />
                  </Pressable>
                </View>

                <View className="items-center gap-3">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${profile.name} tam profilini aç`}
                    onPress={openFullProfile}
                    hitSlop={8}
                    className="items-center gap-1.5 active:opacity-80"
                  >
                    <View className="rounded-full border-2 border-brand-500/60 p-[3px]">
                      <Avatar name={profile.name} size="xl" />
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
                      {profile.name}
                    </Text>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-center text-app-text-muted"
                    >
                      {profile.tagline}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap justify-center gap-2">
                    {profile.badges.slice(0, 2).map((badge) => (
                      <TrustBadge
                        key={badge.id}
                        label={badge.label}
                        tone={badge.tone}
                      />
                    ))}
                  </View>
                </View>

                <View className="flex-row gap-2">
                  <PreviewMetric
                    icon={Star}
                    iconColor="#f5b33f"
                    value={profile.rating.toFixed(1)}
                    label={`${profile.reviewCount} yorum`}
                  />
                  <PreviewMetric
                    icon={MapPin}
                    iconColor="#83a7ff"
                    value={`${profile.distanceKm.toFixed(1)} km`}
                    label="Uzaklık"
                  />
                  <PreviewMetric
                    icon={Clock}
                    iconColor="#2dd28d"
                    value={`${profile.responseMinutes} dk`}
                    label="Yanıt"
                  />
                </View>

                {offer ? (
                  <View className="gap-3 rounded-[18px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
                    <View className="flex-row items-center gap-2">
                      <Icon icon={Lock} size={13} color="#2dd28d" />
                      <Text variant="eyebrow" tone="subtle">
                        Bu vaka için teklif
                      </Text>
                      <View className="ml-auto">
                        <TrustBadge label="Bağlayıcı" tone="success" />
                      </View>
                    </View>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text leading-[19px]"
                    >
                      {offer.headline}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Text
                        variant="display"
                        tone="inverse"
                        className="text-[22px] leading-[26px]"
                      >
                        {offer.price_label}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
                        <Icon icon={Timer} size={11} color="#83a7ff" />
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-[11px]"
                        >
                          {offer.eta_label}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
                        <Icon icon={ShieldCheck} size={11} color="#2dd28d" />
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-[11px]"
                        >
                          {offer.warranty_label}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-[11px]"
                        >
                          {offer.delivery_mode}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="rounded-[16px] border border-brand-500/30 bg-brand-500/10 px-4 py-3">
                    <View className="flex-row items-center gap-2">
                      <Icon icon={Sparkles} size={13} color="#0ea5e9" />
                      <Text variant="eyebrow" tone="subtle">
                        Neden önerildi
                      </Text>
                    </View>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="mt-1 text-app-text-muted leading-5"
                    >
                      {profile.reason}
                    </Text>
                  </View>
                )}

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  className="max-h-[200px]"
                  contentContainerStyle={{ gap: 12 }}
                >
                  {offer ? null : (
                    <View className="gap-2 rounded-[16px] border border-app-outline bg-app-surface px-3.5 py-3">
                      <Text variant="eyebrow" tone="subtle">
                        Fiyat bandı
                      </Text>
                      <View className="flex-row items-center justify-between">
                        <Text variant="h3" tone="inverse">
                          {profile.priceLabel}
                        </Text>
                        <StatusChip
                          label={profile.availabilityLabel}
                          tone="success"
                        />
                      </View>
                    </View>
                  )}

                  {profile.campaigns[0] ? (
                    <View className="flex-row items-center gap-3 rounded-[16px] border border-app-success/30 bg-app-success-soft px-3.5 py-3">
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-app-success/20">
                        <Icon icon={Tag} size={14} color="#2dd28d" />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text
                          variant="label"
                          tone="success"
                          className="text-[13px]"
                        >
                          {profile.campaigns[0].title}
                        </Text>
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-app-text-muted text-[12px]"
                        >
                          {profile.campaigns[0].subtitle}
                        </Text>
                      </View>
                      <Text variant="label" tone="success">
                        {profile.campaigns[0].priceLabel}
                      </Text>
                    </View>
                  ) : null}

                  {profile.reviews[0] ? (
                    <View className="flex-row items-start gap-3 rounded-[16px] border border-app-outline bg-app-surface px-3.5 py-3">
                      <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-brand-500/15">
                        <Icon icon={Quote} size={13} color="#0ea5e9" />
                      </View>
                      <View className="flex-1 gap-1">
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-app-text leading-5"
                        >
                          "{profile.reviews[0].body}"
                        </Text>
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-app-text-subtle"
                        >
                          — {profile.reviews[0].author}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                {activeCase ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Vakana git"
                    onPress={openCaseManagement}
                    className="flex-row items-center gap-3 rounded-[16px] border border-brand-500/50 bg-brand-500/10 px-3.5 py-3 active:opacity-85"
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500/25">
                      <Icon icon={Briefcase} size={14} color="#0ea5e9" />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <View className="flex-row items-center gap-1.5">
                        <Text
                          variant="eyebrow"
                          tone="accent"
                          className="text-[10px]"
                        >
                          Vakana git
                        </Text>
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-app-text-subtle text-[10px]"
                        >
                          · {getCaseKindLabel(activeCase.kind)} · {getCaseStatusLabel(activeCase.status)}
                        </Text>
                      </View>
                      <Text
                        variant="label"
                        tone="inverse"
                        className="text-[13px]"
                        numberOfLines={1}
                      >
                        {activeCase.title}
                      </Text>
                    </View>
                    <Icon icon={ChevronRight} size={14} color="#0ea5e9" />
                  </Pressable>
                ) : null}

                <View className="gap-1.5">
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
              </View>
            ) : (
              <Text
                tone="muted"
                className="py-4 text-center text-app-text-muted"
              >
                Usta bilgisi yükleniyor…
              </Text>
            )}
          </ActionSheetSurface>
        </Pressable>
      </Pressable>
    </Modal>
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
