import { View } from "react-native";

import { ActiveTowJobHero } from "../components/ActiveTowJobHero";
import { AvailabilityToggleCard } from "../components/AvailabilityToggleCard";
import { QuickQueueRow } from "../components/QuickQueueRow";
import { TodayEarningsCard } from "../components/TodayEarningsCard";

export function TowFocusedLayout() {
  return (
    <View className="gap-4">
      <ActiveTowJobHero />
      <AvailabilityToggleCard />
      <TodayEarningsCard />
      <QuickQueueRow />
    </View>
  );
}
