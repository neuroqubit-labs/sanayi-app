import { View } from "react-native";

import { CampaignsRow } from "../components/CampaignsRow";
import { DamagePoolCard } from "../components/DamagePoolCard";
import { ExpertiseRequestsCard } from "../components/ExpertiseRequestsCard";

export function DamageShopLayout() {
  return (
    <View className="gap-4">
      <DamagePoolCard />
      <ExpertiseRequestsCard />
      <CampaignsRow />
    </View>
  );
}
