import { Tabs } from "expo-router";
import { Vibration } from "react-native";

import { useVehicleSwitcherStore } from "@/features/vehicles";
import { CustomerTabBar } from "@/shared/navigation/tab-bar/CustomerTabBar";

export default function TabsLayout() {
  const openVehicleSwitcher = useVehicleSwitcherStore((state) => state.open);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#060915" },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
      tabBar={(props) => <CustomerTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
        }}
      />
      <Tabs.Screen
        name="carsi"
        options={{
          title: "Çarşı",
        }}
      />
      <Tabs.Screen
        name="kayitlar"
        options={{
          title: "Kayıtlar",
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarAccessibilityLabel:
            "Profil. Basılı tutarsan araç seçiciyi açar.",
        }}
        listeners={{
          tabLongPress: () => {
            Vibration.vibrate(15);
            openVehicleSwitcher();
          },
        }}
      />
    </Tabs>
  );
}
