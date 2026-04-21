import { buildTechnicianTrackingView } from "@naro/mobile-core";
import { Screen, SectionHeader } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { useCasePool, useIncomingAppointments, useJobsFeed } from "@/features/jobs";
import { PoolCaseCard } from "@/features/pool";
import { useOfferSheetStore } from "@/features/pool";
import { useShellConfig } from "@/features/shell";

import { BusinessSummaryCard } from "../components/BusinessSummaryCard";
import { DiscoveryShopsFeed } from "../components/DiscoveryShopsFeed";
import { HomeCaseRow } from "../components/HomeCaseRow";
import { HomeHeader } from "../components/HomeHeader";
import { HomeHeroCard } from "../components/HomeHeroCard";
import { QuickActionTileRow } from "../components/QuickActionTileRow";
import { BusinessLiteLayout } from "../layouts/BusinessLiteLayout";
import { DamageShopLayout } from "../layouts/DamageShopLayout";
import { FullLayout } from "../layouts/FullLayout";
import { MinimalLayout } from "../layouts/MinimalLayout";
import { TowFocusedLayout } from "../layouts/TowFocusedLayout";

type HomeLayout = ReturnType<typeof useShellConfig>["home_layout"];

const LAYOUTS_WITH_BUSINESS_SUMMARY: HomeLayout[] = ["full", "business_lite"];

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
    .map(({ caseItem, view }) => ({
      caseItem,
      title: view.primaryAction?.label ?? view.header.summaryTitle,
      meta: view.header.updatedAtLabel,
    }))
    .slice(0, 6);
  const waitingCustomer = views
    .filter(({ view }) => view.waitState.actor === "customer")
    .map(({ caseItem, view }) => ({
      caseItem,
      title: view.header.summaryTitle,
      meta: view.header.updatedAtLabel,
    }))
    .slice(0, 6);

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

  const hasTowCapability = shellConfig.enabled_capabilities.includes("tow");
  const hasMobileService = shellConfig.enabled_capabilities.includes(
    "on_site_repair",
  );
  const hasCampaigns = shellConfig.enabled_capabilities.includes("campaigns");

  const showBusinessSummaryAtTop = LAYOUTS_WITH_BUSINESS_SUMMARY.includes(
    shellConfig.home_layout,
  );
  const showQuickActionTiles =
    shellConfig.home_layout === "full" ||
    shellConfig.home_layout === "business_lite";

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-6 pb-28">
      <HomeHeader />

      {showBusinessSummaryAtTop ? <BusinessSummaryCard /> : null}

      {heroAppointment ? (
        <HomeHeroCard
          caseItem={heroAppointment}
          totalPendingCount={incomingAppointments.length}
        />
      ) : null}

      {showQuickActionTiles ? (
        <QuickActionTileRow urgent={urgent} waiting={waitingCustomer} />
      ) : null}

      {renderLayoutExtras(shellConfig.home_layout, {
        hasTowCapability,
        hasMobileService,
        hasCampaigns,
      })}

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

      <DiscoveryShopsFeed />
    </Screen>
  );
}

function renderLayoutExtras(
  layout: HomeLayout,
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
