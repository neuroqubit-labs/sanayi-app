import { useNaroTheme } from "@naro/ui";
import { Tabs } from "expo-router";

import { ServiceTabBar } from "@/shared/navigation/tab-bar/ServiceTabBar";

export default function TabsLayout() {
  const { colors } = useNaroTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
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
