import { buildTechnicianTrackingView } from "@naro/mobile-core";
import { Icon, Screen, SectionHeader, Text } from "@naro/ui";
import { Href, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { useCasePool, useIncomingAppointments, useJobsFeed } from "@/features/jobs";
import { PoolCaseCard } from "@/features/pool";
import { useOfferSheetStore } from "@/features/pool";
import { useShellConfig } from "@/features/shell";

import { HomeActionCard } from "../components/HomeActionCard";
import { HomeCaseRow } from "../components/HomeCaseRow";
import { HomeHeader } from "../components/HomeHeader";
import { HomeHeroCard } from "../components/HomeHeroCard";
import { BusinessLiteLayout } from "../layouts/BusinessLiteLayout";
import { DamageShopLayout } from "../layouts/DamageShopLayout";
import { FullLayout } from "../layouts/FullLayout";
import { MinimalLayout } from "../layouts/MinimalLayout";
import { TowFocusedLayout } from "../layouts/TowFocusedLayout";

export function HomeScreen() {
  const router = useRouter();
  const shellConfig = useShellConfig();
  const { data: jobs = [] } = useJobsFeed();
  const { data: pool = [] } = useCasePool();
  const { data: incomingAppointments = [] } = useIncomingAppointments();
  const openOfferSheet = useOfferSheetStore((state) => state.open);
  const views = jobs.map((caseItem) => ({
    caseItem,
    view: buildTechnicianTrackingView(caseItem),
  }));
  const urgent = views
    .filter(({ view }) => view.primaryTask?.urgency === "now")
    .slice(0, 2);
  const waitingCustomer = views
    .filter(({ view }) => view.waitState.actor === "customer")
    .slice(0, 2);

  const recentStages = views
    .flatMap(({ caseItem, view }) =>
      view.stages
        .flatMap((stage) =>
          stage.evidencePreview.slice(0, 1).map((proof) => ({
            caseItem,
            stageTitle: stage.title,
            proof,
          })),
        )
        .slice(0, 1),
    )
    .slice(0, 3);

  const heroAppointment = incomingAppointments[0];
  const extraAppointments = incomingAppointments.length - 1;

  const hasTowCapability = shellConfig.enabled_capabilities.includes("tow");
  const hasMobileService = shellConfig.enabled_capabilities.includes(
    "on_site_repair",
  );
  const hasCampaigns = shellConfig.enabled_capabilities.includes("campaigns");

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-6 pb-28">
      <HomeHeader />

      {heroAppointment ? (
        <View className="gap-3">
          <SectionHeader
            title="Gelen randevu talebi"
            description={`${incomingAppointments.length} talep yanıt bekliyor`}
          />
          <HomeHeroCard caseItem={heroAppointment} />
          {extraAppointments > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Diğer randevu taleplerini gör"
              onPress={() => router.push("/(tabs)/islerim" as Href)}
              className="flex-row items-center justify-between rounded-[14px] border border-app-outline bg-app-surface-2 px-4 py-3 active:opacity-85"
            >
              <Text variant="caption" tone="muted" className="text-[12px]">
                {extraAppointments} diğer randevu talebi
              </Text>
              <Icon icon={ChevronRight} size={14} color="#83a7ff" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {renderLayoutHero(shellConfig.home_layout, {
        hasTowCapability,
        hasMobileService,
        hasCampaigns,
      })}

      {urgent.length > 0 ? (
        <View className="gap-4">
          <SectionHeader
            title="Bugün Senden Beklenenler"
            description="Aktif süreçte hemen aksiyon bekleyen adımlar."
            actionLabel="Tüm işler"
            onActionPress={() => router.push("/(tabs)/islerim")}
          />
          <View className="gap-3">
            {urgent.map(({ caseItem, view }) => (
              <HomeActionCard
                key={caseItem.id}
                caseItem={caseItem}
                onPress={() => router.push(`/is/${caseItem.id}` as Href)}
                titleOverride={
                  view.primaryAction?.label ?? view.header.summaryTitle
                }
                meta={view.header.updatedAtLabel}
                trailingBadge={{ label: "Şimdi", tone: "accent" }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {waitingCustomer.length > 0 ? (
        <View className="gap-4">
          <SectionHeader
            title="Müşteri Bekleyenler"
            description="Onay veya son teyit bekleyen dosyalar."
          />
          <View className="gap-3">
            {waitingCustomer.map(({ caseItem, view }) => (
              <HomeActionCard
                key={caseItem.id}
                caseItem={caseItem}
                onPress={() => router.push(`/is/${caseItem.id}` as Href)}
                meta={view.header.updatedAtLabel}
                trailingBadge={{ label: "Müşteri", tone: "warning" }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {pool.length > 0 ? (
        <View className="gap-4">
          <SectionHeader
            title="Havuzdan sana özel"
            description="Uzmanlığına uygun açık vakalar — teklif göndermek bir tık"
            actionLabel="Havuz"
            onActionPress={() => router.push("/(tabs)/havuz")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {pool.slice(0, 4).map((caseItem) => (
              <View key={caseItem.id} className="w-[300px]">
                <PoolCaseCard
                  caseItem={caseItem}
                  onPress={() => router.push(`/vaka/${caseItem.id}` as Href)}
                  onOffer={() => openOfferSheet(caseItem.id)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {recentStages.length > 0 ? (
        <View className="gap-4">
          <SectionHeader
            title="Son Aşamalar"
            description="Aktif işlerde son yüklenen görsel ve durum güncellemeleri."
          />
          <View className="gap-2">
            {recentStages.map(({ caseItem, stageTitle, proof }) => (
              <HomeCaseRow
                key={proof.id}
                caseItem={caseItem}
                onPress={() => router.push(`/is/${caseItem.id}` as Href)}
                titleOverride={stageTitle}
                subtitleOverride={proof.title}
                meta={proof.meta}
                trailingBadge={{ label: "İlerleme", tone: "info" }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function renderLayoutHero(
  layout: ReturnType<typeof useShellConfig>["home_layout"],
  flags: {
    hasTowCapability: boolean;
    hasMobileService: boolean;
    hasCampaigns: boolean;
  },
) {
  switch (layout) {
    case "tow_focused":
      return <TowFocusedLayout />;
    case "full":
      return (
        <FullLayout
          showTowCapability={flags.hasTowCapability}
          showMobileService={flags.hasMobileService}
        />
      );
    case "business_lite":
      return <BusinessLiteLayout showCampaigns={flags.hasCampaigns} />;
    case "minimal":
      return <MinimalLayout />;
    case "damage_shop":
      return <DamageShopLayout />;
  }
}
