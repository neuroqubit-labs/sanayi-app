import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import {
  isPaymentAccountRequiredError,
  paymentAccountRequiredMessage,
} from "@/features/technicians/paymentAccountErrors";

import {
  useSetTowAvailability,
  useTowAvailability,
} from "./api";
import type { TowEquipment } from "./schemas";

const DEFAULT_EQUIPMENT: TowEquipment[] = ["flatbed"];
const IDLE_HEARTBEAT_MS = 10 * 60 * 1000;

async function readCurrentCoord() {
  const currentPermission = await Location.getForegroundPermissionsAsync();
  const permission =
    currentPermission.status === "granted"
      ? currentPermission
      : await Location.requestForegroundPermissionsAsync();
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
  const [error, setError] = useState<string | null>(null);
  const [requiresPaymentAccount, setRequiresPaymentAccount] = useState(false);

  const equipment =
    availability.data?.equipment && availability.data.equipment.length > 0
      ? availability.data.equipment
      : DEFAULT_EQUIPMENT;

  const setOnline = useCallback(async () => {
    try {
      const coord = await readCurrentCoord();
      await mutation.mutateAsync({
        available: true,
        lat: coord.lat,
        lng: coord.lng,
        captured_at: new Date().toISOString(),
        equipment,
      });
      setError(null);
      setRequiresPaymentAccount(false);
    } catch (err) {
      if (isPaymentAccountRequiredError(err)) {
        setRequiresPaymentAccount(true);
        setError(paymentAccountRequiredMessage("Çekici modunu açmak"));
      } else {
        setRequiresPaymentAccount(false);
        setError(err instanceof Error ? err.message : "Konum alınamadı.");
      }
    }
  }, [equipment, mutation]);

  const setOffline = useCallback(async () => {
    await mutation.mutateAsync({
      available: false,
      equipment,
    });
    setError(null);
    setRequiresPaymentAccount(false);
  }, [equipment, mutation]);

  const heartbeat = useCallback(async () => {
    try {
      const coord = await readCurrentCoord();
      await mutation.mutateAsync({
        available: true,
        lat: coord.lat,
        lng: coord.lng,
        captured_at: new Date().toISOString(),
        equipment,
      });
      setError(null);
      setRequiresPaymentAccount(false);
    } catch (err) {
      if (isPaymentAccountRequiredError(err)) {
        setRequiresPaymentAccount(true);
        setError(paymentAccountRequiredMessage("Çekici modunu açık tutmak"));
      } else {
        setRequiresPaymentAccount(false);
        setError(err instanceof Error ? err.message : "Konum yenilenemedi.");
      }
      await mutation.mutateAsync({
        available: false,
        equipment,
      });
    }
  }, [equipment, mutation]);

  useEffect(() => {
    if (!enabled || !availability.data?.available) return;
    const id = setInterval(() => {
      void heartbeat();
    }, IDLE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [availability.data?.available, enabled, heartbeat]);

  return {
    availability,
    isOnline: availability.data?.available ?? false,
    isPending: mutation.isPending || availability.isLoading,
    error,
    requiresPaymentAccount,
    setOnline,
    setOffline,
  };
}
