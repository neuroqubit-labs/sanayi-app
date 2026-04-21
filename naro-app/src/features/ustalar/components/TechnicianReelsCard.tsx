import { Avatar, Button, Icon, Text, TrustBadge } from "@naro/ui";
import { Href, useRouter } from "expo-router";
import {
  Clock,
  Heart,
  MapPin,
  Quote,
  Sparkles,
  Star,
  Tag,
} from "lucide-react-native";
import { Pressable, View, type ViewStyle } from "react-native";

import {
  attachTechnicianToCase,
  prefillDraftForTechnician,
  useTechnicianCaseAction,
} from "@/features/cases";
import { useFavoriteTechniciansStore } from "@/features/profile";
import { useActiveVehicle } from "@/features/vehicles";

import { useUstaPreviewStore } from "../preview-store";
import type { TechnicianProfile } from "../types";

export type ReelSectionKind =
  | "case_match"
  | "maintenance"
  | "personal"
  | "discover";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";
const CARD_SHADOW_STYLE: ViewStyle = {
  shadowColor: "#020617",
  shadowOffset: { width: 0, height: 20 },
  shadowOpacity: 0.34,
  shadowRadius: 30,
  elevation: 14,
};

const SECTION_META: Record<
  ReelSectionKind,
  { label: string; tone: "accent" | "info" | "neutral" | "success" }
> = {
  case_match: { label: "Vakan için seçildi", tone: "accent" },
  maintenance: { label: "Bakım zamanı", tone: "success" },
  personal: { label: "Sana özel", tone: "info" },
  discover: { label: "Keşfet", tone: "neutral" },
};

export type TechnicianReelsCardProps = {
  profile: TechnicianProfile;
  section: ReelSectionKind;
  reason: string;
  cardHeight: number;
};

export function TechnicianReelsCard({
  profile,
  section,
  reason,
  cardHeight,
}: TechnicianReelsCardProps) {
  const router = useRouter();
  const action = useTechnicianCaseAction(profile.id);
  const { data: activeVehicle } = useActiveVehicle();
  const openPreview = useUstaPreviewStore((state) => state.open);
  const isFavorite = useFavoriteTechniciansStore((state) =>
    state.ids.includes(profile.id),
  );
  const toggleFavorite = useFavoriteTechniciansStore((state) => state.toggle);
  const sectionMeta = SECTION_META[section];
  const profileRoute = `/usta/${profile.id}` as Href;
  const primaryLabel =
    action.mode === "open_case" ? "Profili Gör" : action.primaryLabel;
  const buttonClassName = action.disabled
    ? "rounded-[18px] border border-white/10 bg-white/5 active:bg-white/5"
    : "rounded-[18px]";

  const openCardPreview = () => openPreview(profile.id);
  const openFullProfile = () => router.push(profileRoute);

  const handlePrimary = () => {
    if (action.disabled) return;
    if (action.mode === "open_case") {
      openCardPreview();
      return;
    }
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
  };

  const topCampaign = profile.campaigns[0];
  const topReview = profile.reviews[0];

  return (
    <View style={{ height: cardHeight }} className="px-4 pb-3 pt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${profile.name} ön izlemesini aç`}
        onPress={openCardPreview}
        style={CARD_SHADOW_STYLE}
        className="flex-1 overflow-hidden rounded-[32px] border border-white/10 bg-app-surface active:opacity-95"
      >
        {/* Hero band */}
        <View className="relative h-44 overflow-hidden border-b border-white/10 bg-brand-500/10">
          <View className="absolute inset-x-0 top-0 h-px bg-white/20" />
          <View className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-brand-500/20" />
          <View className="absolute -left-10 bottom-[-24px] h-36 w-36 rounded-full bg-white/5" />
          <View className="absolute right-10 top-12 h-16 w-16 rounded-full bg-white/5" />

          <View className="absolute left-5 right-16 top-4 flex-row flex-wrap items-center gap-2">
            {section !== "personal" ? (
              <TrustBadge
                label={sectionMeta.label}
                tone={sectionMeta.tone}
                icon={section === "case_match" ? Sparkles : undefined}
              />
            ) : null}
            {profile.badges[0] ? (
              <TrustBadge
                label={profile.badges[0].label}
                tone={profile.badges[0].tone}
              />
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"
            }
            accessibilityState={{ selected: isFavorite }}
            onPress={(event) => {
              event.stopPropagation();
              toggleFavorite(profile.id);
            }}
            hitSlop={8}
            className={`absolute right-4 top-4 h-10 w-10 items-center justify-center rounded-full border ${
              isFavorite
                ? "border-app-critical/35 bg-app-critical/15"
                : "border-white/10 bg-black/20"
            } active:opacity-80`}
          >
            <Icon
              icon={Heart}
              size={16}
              color={isFavorite ? "#ff6b6b" : "#f5f7ff"}
              strokeWidth={isFavorite ? 2.5 : 2}
              fill={isFavorite ? "#ff6b6b" : "transparent"}
            />
          </Pressable>

          <View className="absolute inset-x-0 bottom-3 items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.name} profilini aç`}
              onPress={(event) => {
                event.stopPropagation();
                openFullProfile();
              }}
              hitSlop={8}
              className="active:opacity-80"
            >
              <View className="rounded-[28px] border border-white/10 bg-black/20 p-1.5">
                <Avatar
                  name={profile.name}
                  size="xl"
                  className="border-white/10 bg-white/10"
                />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Body */}
        <View className="flex-1 gap-4 px-5 pt-5">
          <View className="gap-1.5">
            <Text
              variant="display"
              tone="inverse"
              className="text-center text-[30px] leading-[32px]"
            >
              {profile.name}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-center text-app-text-muted text-[13px] leading-[18px]"
            >
              {profile.tagline}
            </Text>
          </View>

          <View className="flex-row justify-center gap-2">
            <MiniMetric
              icon={Star}
              iconColor="#f5b33f"
              value={profile.rating.toFixed(1)}
              label={`${profile.reviewCount} yorum`}
            />
            <MiniMetric
              icon={MapPin}
              iconColor="#83a7ff"
              value={`${profile.distanceKm.toFixed(1)} km`}
              label="Uzaklık"
            />
            <MiniMetric
              icon={Clock}
              iconColor="#2dd28d"
              value={`${profile.responseMinutes} dk`}
              label="Yanıt"
            />
          </View>

          <View className="rounded-[20px] border border-brand-500/20 bg-brand-500/10 px-4 py-3">
            <Text
              variant="caption"
              tone="accent"
              className="text-center leading-[18px]"
            >
              {reason}
            </Text>
          </View>

          {profile.specialties.length ? (
            <View className="flex-row flex-wrap justify-center gap-2">
              {profile.specialties.slice(0, 4).map((specialty) => (
                <View
                  key={specialty}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                >
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-[11px] text-app-text"
                  >
                    {specialty}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {topCampaign ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                openCardPreview();
              }}
              className="flex-row items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 active:opacity-90"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full border border-app-success/20 bg-app-success/10">
                <Icon icon={Tag} size={14} color="#2dd28d" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="success" className="text-[13px]">
                  {topCampaign.title}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px]"
                >
                  {topCampaign.subtitle}
                </Text>
              </View>
              <Text variant="label" tone="success">
                {topCampaign.priceLabel}
              </Text>
            </Pressable>
          ) : null}

          {topReview ? (
            <View className="flex-1 flex-row items-start gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-brand-500/15">
                <Icon icon={Quote} size={13} color="#0ea5e9" />
              </View>
              <View className="flex-1 gap-1">
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text leading-5"
                >
                  "{topReview.body}"
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-subtle"
                >
                  — {topReview.author}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-1" />
          )}
        </View>

        {/* Footer CTA */}
        <View className="gap-2 border-t border-white/10 bg-black/10 px-5 py-4">
          <View className="flex-row gap-2">
            <Button
              label={primaryLabel}
              variant={action.disabled ? "outline" : "primary"}
              size="lg"
              className={`${buttonClassName} flex-1`}
              labelClassName="text-[15px] font-semibold"
              disabled={action.disabled}
              onPress={(event) => {
                event.stopPropagation();
                handlePrimary();
              }}
            />
          </View>
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-subtle"
          >
            {action.helperText ??
              `${profile.priceLabel} · ${profile.availabilityLabel}`}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

type MiniMetricProps = {
  icon: typeof Star;
  iconColor: string;
  value: string;
  label: string;
};

function MiniMetric({ icon, iconColor, value, label }: MiniMetricProps) {
  return (
    <View className="flex-1 items-center gap-1 rounded-[18px] border border-white/10 bg-white/5 px-2.5 py-2.5">
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
