import { View } from "react-native";

import { BusinessSummaryCard } from "../components/BusinessSummaryCard";
import { CampaignsRow } from "../components/CampaignsRow";
import { OtherToolsList } from "../components/OtherToolsList";

type Props = {
  showCampaigns: boolean;
};

export function BusinessLiteLayout({ showCampaigns }: Props) {
  return (
    <View className="gap-4">
      <BusinessSummaryCard />
      {showCampaigns ? <CampaignsRow /> : null}
      <OtherToolsList />
    </View>
  );
}
