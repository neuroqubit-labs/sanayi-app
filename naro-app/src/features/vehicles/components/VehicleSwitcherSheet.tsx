import {
  ActionSheetSurface,
  Avatar,
  Icon,
  StatusChip,
  Text,
} from "@naro/ui";
import { CheckCircle2, Circle } from "lucide-react-native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicles } from "../api";
import { useVehicleStore } from "../store";
import { useVehicleSwitcherStore } from "../switcher-store";

export function VehicleSwitcherSheet() {
  const isOpen = useVehicleSwitcherStore((state) => state.isOpen);
  const close = useVehicleSwitcherStore((state) => state.close);
  const insets = useSafeAreaInsets();

  const { data: vehicles } = useVehicles();
  const setActiveVehicle = useVehicleStore((state) => state.setActiveVehicle);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Araç seçiciyi kapat"
        onPress={close}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{ width: "100%", paddingBottom: insets.bottom + 8 }}
        >
          <ActionSheetSurface title="Araç seç">

            <ScrollView
              showsVerticalScrollIndicator={false}
              className="max-h-[420px]"
              contentContainerStyle={{ gap: 12 }}
            >
              {(vehicles ?? []).map((vehicle) => {
                const isActive = vehicle.isActive;
                return (
                  <Pressable
                    key={vehicle.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${vehicle.plate} aktif yap`}
                    onPress={() => {
                      setActiveVehicle(vehicle.id);
                      close();
                    }}
                    className={[
                      "flex-row items-center gap-3 rounded-[22px] border px-4 py-3.5 active:opacity-90",
                      isActive
                        ? "border-brand-500/50 bg-brand-500/10"
                        : "border-app-outline bg-app-surface",
                    ].join(" ")}
                  >
                    <Avatar name={`${vehicle.make} ${vehicle.model}`} size="md" />
                    <View className="flex-1 gap-0.5">
                      <Text variant="label" tone="inverse">
                        {vehicle.plate}
                      </Text>
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-muted"
                      >
                        {vehicle.make} {vehicle.model} · {vehicle.year}
                      </Text>
                      <View className="mt-1 flex-row flex-wrap items-center gap-2">
                        <StatusChip
                          label={`${vehicle.mileageKm.toLocaleString("tr-TR")} km`}
                          tone="neutral"
                        />
                        {vehicle.healthLabel ? (
                          <StatusChip
                            label={vehicle.healthLabel}
                            tone={isActive ? "accent" : "info"}
                          />
                        ) : null}
                      </View>
                    </View>
                    <Icon
                      icon={isActive ? CheckCircle2 : Circle}
                      size={22}
                      color={isActive ? "#2dd28d" : "#6f7b97"}
                    />
                  </Pressable>
                );
              })}

            </ScrollView>
          </ActionSheetSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
