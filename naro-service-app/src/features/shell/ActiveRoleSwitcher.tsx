import type { ProviderType } from "@naro/domain";
import { BottomSheetOverlay, Icon, Text } from "@naro/ui";
import { Check, ChevronDown, Truck, User, Wrench } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useTechnicianProfileStore } from "@/features/technicians";

import { useShellConfig } from "./useShellConfig";

const PROVIDER_LABEL: Record<ProviderType, string> = {
  usta: "Usta",
  cekici: "Çekici",
  kaporta_boya: "Kaporta/Boya",
  lastik: "Lastik",
  oto_elektrik: "Oto Elektrik",
  oto_aksesuar: "Oto Aksesuar",
};

const PROVIDER_ICON: Record<ProviderType, typeof Truck> = {
  usta: Wrench,
  cekici: Truck,
  kaporta_boya: Wrench,
  lastik: Wrench,
  oto_elektrik: Wrench,
  oto_aksesuar: Wrench,
};

export function ActiveRoleSwitcher() {
  const shellConfig = useShellConfig();
  const setActiveProviderType = useTechnicianProfileStore(
    (s) => s.setActiveProviderType,
  );
  const [open, setOpen] = useState(false);

  const hasMultipleRoles = shellConfig.secondary_provider_types.length > 0;
  if (!hasMultipleRoles) return null;

  const availableRoles: ProviderType[] = [
    shellConfig.primary_provider_type,
    ...shellConfig.secondary_provider_types,
  ];

  const ActiveIcon = PROVIDER_ICON[shellConfig.active_provider_type] ?? User;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aktif rolü değiştir"
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:bg-app-surface-2"
      >
        <Icon icon={ActiveIcon} size={12} color="#0ea5e9" />
        <Text variant="caption" tone="accent" className="text-[12px]">
          {PROVIDER_LABEL[shellConfig.active_provider_type]}
        </Text>
        <Icon icon={ChevronDown} size={11} color="#83a7ff" />
      </Pressable>

      <BottomSheetOverlay
        visible={open}
        onClose={() => setOpen(false)}
        accessibilityLabel="Kapat"
      >
        <View className="gap-3 rounded-t-[26px] border-t border-app-outline-strong bg-app-bg px-5 pb-8 pt-5">
          <Text variant="h3" tone="inverse">
            Şu an hangi roldesin?
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Rol seçimi ana ekran düzenini ve + butonu kısayollarını değiştirir.
          </Text>
          <View className="gap-2 pt-2">
            {availableRoles.map((role) => {
              const isActive = shellConfig.active_provider_type === role;
              const Icn = PROVIDER_ICON[role] ?? User;
              return (
                <Pressable
                  key={role}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => {
                    setActiveProviderType(role);
                    setOpen(false);
                  }}
                  className={[
                    "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5",
                    isActive
                      ? "border-brand-500/40 bg-brand-500/10"
                      : "border-app-outline bg-app-surface",
                  ].join(" ")}
                >
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isActive ? "#0ea5e926" : "#1d243d",
                    }}
                  >
                    <Icon
                      icon={Icn}
                      size={16}
                      color={isActive ? "#0ea5e9" : "#83a7ff"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      variant="label"
                      tone={isActive ? "accent" : "inverse"}
                    >
                      {PROVIDER_LABEL[role]}
                    </Text>
                    {isActive ? (
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-muted text-[11px]"
                      >
                        Aktif rol
                      </Text>
                    ) : null}
                  </View>
                  {isActive ? (
                    <Icon icon={Check} size={14} color="#0ea5e9" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheetOverlay>
    </>
  );
}
