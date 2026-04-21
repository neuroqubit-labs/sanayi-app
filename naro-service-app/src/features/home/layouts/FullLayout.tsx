import { View } from "react-native";

import { TowCapabilityCard } from "@/features/tow";

import { MobileServiceRow } from "../components/MobileServiceRow";

type Props = {
  showTowCapability: boolean;
  showMobileService: boolean;
};

/**
 * Full layout extras — HomeScreen zaten BusinessSummaryCard + QuickActionTileRow
 * + havuz + recent stages + discovery feed'i ekliyor. Burada sadece layout'a
 * özgü ekstra widget'lar: tow capability kartı ve mobil servis hattı satırı.
 * Kampanyalar + tools gibi 4 router artık Profil'de.
 */
export function FullLayout({ showTowCapability, showMobileService }: Props) {
  if (!showTowCapability && !showMobileService) return null;
  return (
    <View className="gap-4">
      {showTowCapability ? <TowCapabilityCard /> : null}
      {showMobileService ? <MobileServiceRow /> : null}
    </View>
  );
}
