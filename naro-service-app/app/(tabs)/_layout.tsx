import { Tabs } from "expo-router";

import { ServiceTabBar } from "@/shared/navigation/tab-bar/ServiceTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#060915" },
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <ServiceTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Anasayfa",
        }}
      />
      <Tabs.Screen
        name="havuz"
        options={{
          title: "Havuz",
        }}
      />
      <Tabs.Screen
        name="islerim"
        options={{
          title: "Kayıtlar",
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
        }}
      />
    </Tabs>
  );
}
