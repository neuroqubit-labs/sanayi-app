import { View } from "react-native";

import { TowCapabilityCard } from "@/features/tow";

import { BusinessSummaryCard } from "../components/BusinessSummaryCard";
import { CampaignsRow } from "../components/CampaignsRow";
import { MobileServiceRow } from "../components/MobileServiceRow";
import { OtherToolsList } from "../components/OtherToolsList";

type Props = {
  showTowCapability: boolean;
  showMobileService: boolean;
};

export function FullLayout({ showTowCapability, showMobileService }: Props) {
  return (
    <View className="gap-4">
      <BusinessSummaryCard />
      {showTowCapability ? <TowCapabilityCard /> : null}
      <CampaignsRow />
      {showMobileService ? <MobileServiceRow /> : null}
      <OtherToolsList />
    </View>
  );
}
