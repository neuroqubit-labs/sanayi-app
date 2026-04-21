import { getTrackingVehicleMeta } from "@naro/mobile-core";
import {
  Briefcase,
  Calendar,
  Car,
  ChevronDown,
  ChevronRight,
  Droplet,
  Fingerprint,
  Gauge,
  Palette,
  User,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { Text } from "../Text";

import { maskCustomerName } from "./helpers";

type Props = {
  vehicleId: string;
};

export function VehicleDetailSection({ vehicleId }: Props) {
  const vehicle = getTrackingVehicleMeta(vehicleId);
  const [expanded, setExpanded] = useState(false);

  if (!vehicle) return null;

  return (
    <View className="gap-2 rounded-[20px] border border-app-outline bg-app-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Araç bilgilerini ${expanded ? "kapat" : "aç"}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center gap-3 px-4 py-3.5 active:bg-app-surface-2"
      >
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={Car} size={18} color="#f45f25" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            variant="label"
            tone="inverse"
            className="text-[14px]"
            numberOfLines={1}
          >
            {vehicle.plate}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
            numberOfLines={1}
          >
            {vehicle.vehicleLabel} · {maskCustomerName(vehicle.customerName)}
          </Text>
        </View>
        <Icon
          icon={expanded ? ChevronDown : ChevronRight}
          size={16}
          color="#83a7ff"
        />
      </Pressable>

      {expanded ? (
        <View className="gap-3 border-t border-app-outline px-4 py-3.5">
          <View className="flex-row items-start gap-3">
            <Avatar name={vehicle.customerName} size="md" />
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Müşteri
              </Text>
              <Text
                variant="label"
                tone="inverse"
                className="text-[14px]"
                numberOfLines={1}
              >
                {maskCustomerName(vehicle.customerName)}
              </Text>
              {vehicle.previousCaseCount > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Icon icon={Briefcase} size={11} color="#83a7ff" />
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-subtle text-[11px]"
                  >
                    {vehicle.previousCaseCount} önceki vaka
                    {vehicle.lastCaseLabel ? ` · ${vehicle.lastCaseLabel}` : ""}
                  </Text>
                </View>
              ) : (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-subtle text-[11px]"
                >
                  Platformdaki ilk vaka
                </Text>
              )}
            </View>
          </View>

          <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-3">
            <Row
              icon={Calendar}
              label="Yıl"
              value={`${vehicle.year}`}
            />
            <Row
              icon={Palette}
              label="Renk"
              value={vehicle.color}
            />
            <Row
              icon={Droplet}
              label="Yakıt"
              value={vehicle.fuelType}
            />
            <Row
              icon={Gauge}
              label="Kilometre"
              value={vehicle.kmLabel}
            />
            <Row
              icon={Fingerprint}
              label="Şasi (VIN)"
              value={`•••• ${vehicle.vin.slice(-6)}`}
              mono
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              // V2: araç geçmişi ekranı
            }}
            className="flex-row items-center justify-center gap-1 rounded-[12px] border border-app-outline bg-app-surface-2 px-3 py-2 active:opacity-80"
          >
            <Icon icon={User} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px]"
            >
              Araç geçmişi (yakında)
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: typeof Car;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Icon icon={icon} size={13} color="#83a7ff" />
      <Text
        variant="caption"
        tone="muted"
        className="w-20 text-app-text-subtle text-[11px]"
      >
        {label}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className={`flex-1 text-[12px] text-app-text ${mono ? "font-mono" : ""}`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
