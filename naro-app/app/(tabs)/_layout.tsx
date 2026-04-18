import { Icon } from "@naro/ui";
import { Tabs } from "expo-router";
import { FileText, Home, User, Wrench } from "lucide-react-native";
import { View } from "react-native";

import { QuickActionsFab } from "@/shared/components/QuickActionsFab";

const BRAND_ACTIVE = "#0284c7";
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
            title: "Ana Sayfa",
            tabBarIcon: ({ color, size }) => <Icon icon={Home} color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="kayitlar"
          options={{
            title: "Kayıtlar",
            tabBarIcon: ({ color, size }) => <Icon icon={FileText} color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="ustalar"
          options={{
            title: "Ustalar",
            tabBarIcon: ({ color, size }) => <Icon icon={Wrench} color={color} size={size} />,
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
