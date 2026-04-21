import { View } from "react-native";

import { ActiveJobsCountCard } from "../components/ActiveJobsCountCard";
import { AvailabilityToggleCard } from "../components/AvailabilityToggleCard";

export function MinimalLayout() {
  return (
    <View className="gap-4">
      <ActiveJobsCountCard />
      <AvailabilityToggleCard />
    </View>
  );
}
