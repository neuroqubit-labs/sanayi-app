import * as Location from "expo-location";
import { useCallback } from "react";

import {
  useSetTowAvailability,
  useTowAvailability,
} from "./api";
import type { TowEquipment } from "./schemas";

const DEFAULT_EQUIPMENT: TowEquipment[] = ["flatbed"];

async function readCurrentCoord() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Çekici modunu açmak için konum izni gerekli.");
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

export function useTowAvailabilityController(enabled: boolean = true) {
  const availability = useTowAvailability(enabled);
  const mutation = useSetTowAvailability();

  const setOnline = useCallback(async () => {
    const coord = await readCurrentCoord();
    await mutation.mutateAsync({
      available: true,
      lat: coord.lat,
      lng: coord.lng,
      captured_at: new Date().toISOString(),
      equipment:
        availability.data?.equipment && availability.data.equipment.length > 0
          ? availability.data.equipment
          : DEFAULT_EQUIPMENT,
    });
  }, [availability.data?.equipment, mutation]);

  const setOffline = useCallback(async () => {
    await mutation.mutateAsync({
      available: false,
      equipment: availability.data?.equipment ?? DEFAULT_EQUIPMENT,
    });
  }, [availability.data?.equipment, mutation]);

  return {
    availability,
    isOnline: availability.data?.available ?? false,
    isPending: mutation.isPending || availability.isLoading,
    setOnline,
    setOffline,
  };
}
