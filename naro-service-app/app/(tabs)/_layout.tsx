import { Icon } from "@naro/ui";
import { Tabs } from "expo-router";
import { Briefcase, LayoutDashboard, ListChecks, User } from "lucide-react-native";
import { View } from "react-native";

import { QuickActionsFab } from "@/shared/components/QuickActionsFab";

const BRAND_ACTIVE = "#d94a1f";
const NEUTRAL_INACTIVE = "#6b7280";

export default function TabsLayout() {
  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: BRAND_ACTIVE,
          tabBarInactiveTintColor: NEUTRAL_INACTIVE,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Anasayfa",
            tabBarIcon: ({ color, size }) => (
              <Icon icon={LayoutDashboard} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="islerim"
          options={{
            title: "İşlerim",
            tabBarIcon: ({ color, size }) => <Icon icon={Briefcase} color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="havuz"
          options={{
            title: "İş Havuzu",
            tabBarIcon: ({ color, size }) => <Icon icon={ListChecks} color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profil"
          options={{
            title: "Profil",
            tabBarIcon: ({ color, size }) => <Icon icon={User} color={color} size={size} />,
          }}
        />
      </Tabs>
      <QuickActionsFab />
    </View>
  );
}
