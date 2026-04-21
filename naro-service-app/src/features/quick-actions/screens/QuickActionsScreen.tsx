import {
  ActionSheetSurface,
  Avatar,
  Icon,
  shellMotion,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  ChevronRight,
  ClipboardList,
  List,
  MapPinned,
  Power,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClaimSourceSheetStore } from "@/features/insurance-claim";
import {
  resolveCampaignVisibility,
  resolveInsuranceCreationVisibility,
  useTechnicianProfileStore,
} from "@/features/technicians";

import {
  buildTechnicianQuickActionTags,
  resolveTechnicianQuickActionMode,
  type ServiceQuickActionKey,
} from "../model";

export function QuickActionsScreen() {
  const router = useRouter();
  const profile = useTechnicianProfileStore();
  const openHasarSheet = useClaimSourceSheetStore((s) => s.show);
  const setAvailability = useTechnicianProfileStore(
    (state) => state.setAvailability,
  );

  const mode = resolveTechnicianQuickActionMode(profile);
  const tags = buildTechnicianQuickActionTags(profile);
  const campaignsVisible = resolveCampaignVisibility(profile.provider_type);
  const insuranceVisible = resolveInsuranceCreationVisibility(
    profile.provider_type,
  );

  const filterVisibleActions = (keys: ServiceQuickActionKey[]) =>
    keys.filter((k) => {
      if (!campaignsVisible && (k === "campaign_create" || k === "campaigns"))
        return false;
      if (!insuranceVisible && k === "insurance") return false;
      return true;
    });

  const availabilityTone =
    profile.availability === "available"
      ? "success"
      : profile.availability === "busy"
        ? "warning"
        : "critical";
  const availabilityLabel =
    profile.availability === "available"
      ? "Açık"
      : profile.availability === "busy"
        ? "Yoğun"
        : "Çevrimdışı";

  const actionMap: Record<ServiceQuickActionKey, ActionCardProps> = {
    availability: {
      label:
        profile.availability === "available"
          ? "Müsaitliği Durdur"
          : "Müsaitliği Aç",
      description:
        profile.availability === "available"
          ? "Yeni iş teklifleri kısa süreli durur."
          : "Havuz ve teklif akışları tekrar açılır.",
      icon: Power,
      tone: profile.availability === "available" ? "success" : "warning",
      onPress: () =>
        setAvailability(
          profile.availability === "available" ? "busy" : "available",
        ),
    },
    insurance: {
      label: "Hasar Dosyası Aç",
      description: "Sigorta iletimine uygun yeni tamir dosyası başlat.",
      icon: ShieldCheck,
      tone: "info",
      onPress: () => {
        router.back();
        // Small delay so the sheet overlays the host page, not the quick-actions modal
        setTimeout(() => openHasarSheet(), 150);
      },
    },
    pool: {
      label:
        mode.key === "towing"
          ? "Yol Yardımı Havuzu"
          : mode.key === "mobile"
            ? "Saha İşlerini Aç"
            : "Havuzu Aç",
      description:
        mode.key === "towing"
          ? "Transfer ve çekici taleplerini tek yerde gör."
          : mode.key === "mobile"
            ? "Yerinde çözülebilecek işleri öne al."
            : "Yeni talepleri ve uygun vakaları taramaya başla.",
      icon: mode.key === "towing" ? Truck : Wrench,
      tone: "accent",
      onPress: () => router.replace("/(tabs)/havuz" as Href),
    },
    records: {
      label:
        mode.key === "insurance" || mode.key === "full_service"
          ? "Aktif Dosyalar"
          : "Aktif İşler",
      description:
        mode.key === "insurance" || mode.key === "full_service"
          ? "Devam eden işler, hasarlar ve müşteri bekleyen dosyalar."
          : "Açık işlerini ve teslim adımlarını gözden geçir.",
      icon: ClipboardList,
      tone: "neutral",
      onPress: () => router.replace("/(tabs)/islerim" as Href),
    },
    campaign_create: {
      label:
        mode.key === "full_service" ? "Paket veya Kampanya" : "Yeni Kampanya",
      description:
        mode.key === "mobile"
          ? "Saha servis paketi veya bakım teklifi hazırla."
          : "Servisini öne çıkaran yeni teklif veya paket tanımla.",
      icon: Sparkles,
      tone: "warning",
      onPress: () => router.replace("/(modal)/kampanya-olustur"),
    },
    campaigns: {
      label: "Kampanyalarım",
      description: "Yayındaki ve taslaktaki kampanyaları düzenle.",
      icon: List,
      tone: "warning",
      onPress: () => router.replace("/(modal)/kampanyalarim"),
    },
    revenue: {
      label: "Gelir Özeti",
      description: "Net, komisyon ve bekleyen tahsilatları kontrol et.",
      icon: TrendingUp,
      tone: "success",
      onPress: () => router.replace("/(modal)/gelir-ozeti"),
    },
    profile: {
      label: "Profili Aç",
      description: "Uzmanlık, bölge ve yetkinlik ayarlarını gözden geçir.",
      icon: MapPinned,
      tone: "neutral",
      onPress: () => router.replace("/(tabs)/profil" as Href),
    },
  };

  const primaryActions = filterVisibleActions(mode.primary).map((actionKey) => ({
    actionKey,
    ...actionMap[actionKey],
  }));
  const secondaryActions = filterVisibleActions(mode.secondary).map(
    (actionKey) => ({
      actionKey,
      ...actionMap[actionKey],
    }),
  );

  return (
    <View className="flex-1 justify-end">
      <Animated.View
        entering={FadeIn.duration(shellMotion.base)}
        exiting={FadeOut.duration(shellMotion.fast)}
        className="absolute inset-0 bg-black/70"
      >
        <Pressable className="flex-1" onPress={() => router.back()} />
      </Animated.View>

      <SafeAreaView edges={["bottom"]} className="px-3 pb-3">
        <Animated.View
          entering={FadeInDown.duration(shellMotion.slow)}
          exiting={FadeOutDown.duration(shellMotion.base)}
        >
          <ActionSheetSurface title={mode.title} description={mode.description}>
            <View className="gap-3">
              <View className="gap-3 rounded-[26px] border border-white/8 bg-[#10192b] px-4 py-4">
                <View className="flex-row items-center gap-3">
                  <Avatar name={profile.name} size="lg" />
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text variant="h3" tone="inverse">
                        {profile.name}
                      </Text>
                      <TrustBadge label={mode.eyebrow} tone="accent" />
                    </View>
                    <Text
                      tone="muted"
                      className="text-app-text-muted"
                      numberOfLines={2}
                    >
                      {profile.tagline}
                    </Text>
                  </View>
                  <StatusChip
                    label={availabilityLabel}
                    tone={availabilityTone}
                  />
                </View>

                {tags.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {tags.map((tag) => (
                      <TrustBadge
                        key={`${tag.tone}-${tag.label}`}
                        label={tag.label}
                        tone={tag.tone}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              {primaryActions[0] ? (
                <PrimaryActionCard {...primaryActions[0]} />
              ) : null}

              <View className="flex-row gap-3">
                {primaryActions.slice(1, 3).map((action) => (
                  <View key={action.actionKey} className="flex-1">
                    <PrimaryActionCard {...action} />
                  </View>
                ))}
              </View>

              {secondaryActions.length > 0 ? (
                <View className="gap-2 pt-1">
                  <Text variant="eyebrow" tone="subtle">
                    Diğer Araçlar
                  </Text>
                  {secondaryActions.map((action) => (
                    <SecondaryActionRow key={action.actionKey} {...action} />
                  ))}
                </View>
              ) : null}
            </View>
          </ActionSheetSurface>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

type ActionTone = "accent" | "success" | "warning" | "info" | "neutral";

type ActionCardProps = {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: ActionTone;
  onPress: () => void;
};

const ACTION_TONE_STYLE: Record<
  ActionTone,
  {
    surface: string;
    iconSurface: string;
    iconColor: string;
  }
> = {
  accent: {
    surface: "border-brand-500/25 bg-brand-500/10",
    iconSurface: "bg-brand-500/15",
    iconColor: "#f45f25",
  },
  success: {
    surface: "border-app-success/25 bg-app-success-soft",
    iconSurface: "bg-app-success/10",
    iconColor: "#2dd28d",
  },
  warning: {
    surface: "border-app-warning/25 bg-app-warning-soft",
    iconSurface: "bg-app-warning/10",
    iconColor: "#f5b33f",
  },
  info: {
    surface: "border-app-info/25 bg-app-info-soft",
    iconSurface: "bg-app-info/10",
    iconColor: "#4aa8ff",
  },
  neutral: {
    surface: "border-app-outline bg-app-surface",
    iconSurface: "bg-app-surface-2",
    iconColor: "#aab6cf",
  },
};

function PrimaryActionCard({
  label,
  description,
  icon,
  tone,
  onPress,
}: ActionCardProps) {
  const style = ACTION_TONE_STYLE[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={[
        "min-h-[112px] gap-3 rounded-[24px] border px-4 py-4 active:opacity-90",
        style.surface,
      ].join(" ")}
    >
      <View
        className={[
          "h-11 w-11 items-center justify-center rounded-[16px]",
          style.iconSurface,
        ].join(" ")}
      >
        <Icon icon={icon} size={20} color={style.iconColor} />
      </View>
      <View className="gap-1">
        <Text
          variant="h3"
          tone="inverse"
          className="text-[17px] leading-[21px]"
        >
          {label}
        </Text>
        <Text
          tone="muted"
          className="text-[13px] leading-[18px] text-app-text-muted"
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

function SecondaryActionRow({
  label,
  description,
  icon,
  tone,
  onPress,
}: ActionCardProps) {
  const style = ACTION_TONE_STYLE[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3 active:opacity-90"
    >
      <View
        className={[
          "h-10 w-10 items-center justify-center rounded-[14px]",
          style.iconSurface,
        ].join(" ")}
      >
        <Icon icon={icon} size={18} color={style.iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {label}
        </Text>
        <Text tone="muted" variant="caption" className="text-app-text-muted">
          {description}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={16} color="#7f8ba5" />
    </Pressable>
  );
}
