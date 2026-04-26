import { formatPhoneDisplay } from "@naro/mobile-core";
import {
  Avatar,
  Button,
  Icon,
  MaintenanceReminderCard,
  PlatformTrustCard,
  PremiumListRow,
  ProfileSummaryCard,
  Screen,
  SectionHeader,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useRouter } from "expo-router";
import {
  Bell,
  Check,
  ChevronRight,
  Plus,
  Receipt,
  Star,
  Wallet,
} from "lucide-react-native";
import { useMemo } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { useMyCasesLive } from "@/features/cases/api";
import { useUnreadNotificationCount } from "@/features/notifications";
import { useMe } from "@/features/user";
import { useVehicles, useVehicleStore } from "@/features/vehicles";
import { telemetry } from "@/runtime";
import { useAuthStore } from "@/services/auth/store";

import {
  APP_VERSION,
  INVOICES,
  MEMBERSHIP_LABEL,
  PROFILE_MENU_SECTIONS,
} from "../data/fixtures";
import { useUserProfileStore } from "../user-store";

export function ProfileScreen() {
  const router = useRouter();
  const clear = useAuthStore((state) => state.clear);
  // /users/me hydrate — auth ready olduğunda store'u doldurur.
  useMe();
  const { data: vehicles } = useVehicles();
  const setActiveVehicle = useVehicleStore((state) => state.setActiveVehicle);
  const unreadNotifications = useUnreadNotificationCount();
  const userName = useUserProfileStore((state) => state.fullName);
  const userPhone = useUserProfileStore((state) => state.phone);
  const userPhoneDisplay = useMemo(
    () => (userPhone ? formatPhoneDisplay(userPhone) : ""),
    [userPhone],
  );

  const maintenanceReminders = useMemo(() => {
    return (vehicles ?? []).flatMap((vehicle) =>
      vehicle.maintenanceReminders.map((reminder) => ({
        ...reminder,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
      })),
    );
  }, [vehicles]);

  const activeWarrantyCount = useMemo(
    () =>
      (vehicles ?? []).reduce(
        (acc, vehicle) => acc + vehicle.warranties.length,
        0,
      ),
    [vehicles],
  );

  // Canlı "tamamlanan iş" sayısı — /cases/me listesinde kapanmış statuslar.
  // Backend enum: completed, archived (models/case.py:88-89).
  const { data: myCases } = useMyCasesLive();
  const totalCompletedCases = useMemo(
    () =>
      (myCases ?? []).filter(
        (c) => c.status === "completed" || c.status === "archived",
      ).length,
    [myCases],
  );

  function onLogout() {
    Alert.alert(
      "Çıkış yapılsın mı?",
      "Uygulamadan çıkış yaptığında, tekrar giriş için OTP kodu gerekecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Çıkış yap",
          style: "destructive",
          onPress: async () => {
            await clear();
            telemetry.track("auth_logout", { app: "customer" });
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  }

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <ProfileSummaryCard
        name={userName}
        subtitle={userPhoneDisplay}
        badgeLabel="Premium üye"
        stats={[
          { label: "Tamamlanan iş", value: `${totalCompletedCases}` },
          { label: "Aktif garanti", value: `${activeWarrantyCount}` },
          { label: "Üyelik", value: MEMBERSHIP_LABEL.replace(" üye", "") },
        ]}
      />

      {/* Araç carousel */}
      <View className="gap-4">
        <SectionHeader
          title="Garaj"
          description="Her aracın ayrı bir hikayesi var — kayıtları, garantileri ve aktif durumu birlikte."
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-6"
          contentContainerStyle={{ gap: 12, paddingHorizontal: 24 }}
        >
          {(vehicles ?? []).map((vehicle) => (
            <Pressable
              key={vehicle.id}
              accessibilityRole="button"
              accessibilityLabel={`${vehicle.plate} aracını aç`}
              onPress={() => router.push(`/arac/${vehicle.id}` as Href)}
              className={[
                "w-64 gap-3 rounded-[26px] border px-4 py-4 active:opacity-90",
                vehicle.isActive
                  ? "border-brand-500/40 bg-brand-500/10"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              <View className="flex-row items-center gap-3">
                <Avatar name={`${vehicle.make} ${vehicle.model}`} size="lg" />
                <View className="flex-1 gap-0.5">
                  <Text variant="label" tone="inverse">
                    {vehicle.plate}
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted"
                    numberOfLines={1}
                  >
                    {vehicle.make} {vehicle.model} · {vehicle.year}
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {vehicle.warranties.length > 0 ? (
                  <TrustBadge
                    label={`${vehicle.warranties.length} garanti`}
                    tone="accent"
                  />
                ) : null}
                {vehicle.maintenanceReminders.length > 0 ? (
                  <TrustBadge
                    label="Bakım hatırlatması"
                    tone="warning"
                  />
                ) : null}
              </View>

              <View className="flex-row items-end justify-between gap-3">
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted flex-1"
                >
                  {vehicle.mileageKm.toLocaleString("tr-TR")} km ·{" "}
                  {vehicle.healthLabel ?? "Hazır"}
                </Text>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: vehicle.isActive }}
                  accessibilityLabel={
                    vehicle.isActive
                      ? "Aktif araç"
                      : `${vehicle.plate} aracını aktif yap`
                  }
                  onPress={(event) => {
                    event.stopPropagation();
                    if (!vehicle.isActive) setActiveVehicle(vehicle.id);
                  }}
                  hitSlop={8}
                  className={[
                    "h-8 w-8 items-center justify-center rounded-full border",
                    vehicle.isActive
                      ? "border-app-success bg-app-success"
                      : "border-app-outline bg-app-surface",
                  ].join(" ")}
                >
                  {vehicle.isActive ? (
                    <Icon icon={Check} size={16} color="#ffffff" strokeWidth={3} />
                  ) : null}
                </Pressable>
              </View>
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yeni araç ekle"
            onPress={() => router.push("/arac/yeni" as Href)}
            className="w-52 items-center justify-center gap-3 rounded-[26px] border border-dashed border-app-outline bg-app-surface px-4 py-4 active:bg-app-surface-2"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
              <Icon icon={Plus} size={20} color="#83a7ff" />
            </View>
            <Text variant="label" tone="inverse">
              Yeni araç ekle
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-center"
            >
              Plaka, marka, model üç adımda
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Bildirim merkezi */}
      <PremiumListRow
        title="Bildirim merkezi"
        subtitle={
          unreadNotifications > 0
            ? `${unreadNotifications} yeni bildirim`
            : "Tüm vaka ve teklif güncellemeleri"
        }
        leading={
          <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
            <Icon icon={Bell} size={18} color="#0ea5e9" />
          </View>
        }
        trailing={
          unreadNotifications > 0 ? (
            <View className="h-6 min-w-[28px] items-center justify-center rounded-full bg-app-critical px-2">
              <Text variant="caption" tone="inverse" className="text-[11px] font-semibold">
                {unreadNotifications}
              </Text>
            </View>
          ) : undefined
        }
        onPress={() => router.push("/bildirimler" as Href)}
      />

      {/* Bakım hatırlatmaları */}
      {maintenanceReminders.length > 0 ? (
        <View className="gap-3">
          <SectionHeader
            title="Bakım hatırlatmaları"
            description="Bütün araçlarının yaklaşan bakımları."
          />
          <View className="gap-3">
            {maintenanceReminders.map((reminder) => (
              <MaintenanceReminderCard
                key={reminder.id}
                title={reminder.title}
                subtitle={
                  reminder.subtitle
                    ? `${reminder.vehiclePlate} · ${reminder.subtitle}`
                    : reminder.vehiclePlate
                }
                dueLabel={reminder.dueLabel}
                tone={reminder.tone}
                onPress={() =>
                  router.push({
                    pathname: "/(modal)/talep/[kind]",
                    params: { kind: "maintenance", vehicleId: reminder.vehicleId },
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Favori ustalar — V1.1 */}
      <View className="gap-3">
        <SectionHeader
          title="Favori ustalar"
          description="Usta profilinde kalbe basarak buraya eklediklerin."
        />
        <View className="items-start gap-2 rounded-[22px] border border-dashed border-app-outline bg-app-surface px-4 py-4">
          <Text variant="label" tone="inverse">
            Yakında
          </Text>
          <Text tone="muted" className="text-app-text-muted">
            Favori ustalar listesi pilot sonrası açılacak. Şimdilik Çarşı'dan
            beğendiğin ustaların profiline her zaman erişebilirsin.
          </Text>
        </View>
      </View>

      {/* Korunmuş ödemeler */}
      <View className="gap-3">
        <SectionHeader
          title="Naro güvencesinde"
          description="Son işlemlerin + faturaların tek yerde, güvenli şekilde."
          actionLabel="Tüm faturalar"
          onActionPress={() => router.push("/profil/faturalar" as Href)}
        />
        <View className="gap-3">
          {INVOICES.slice(0, 3).map((invoice) => (
            <PremiumListRow
              key={invoice.id}
              title={invoice.title}
              subtitle={`${invoice.subtitle} · ${invoice.dateLabel}`}
              leading={
                <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                  <Icon icon={Receipt} size={18} color="#2dd28d" />
                </View>
              }
              trailing={
                <Text variant="label" tone="success">
                  {invoice.amountLabel}
                </Text>
              }
              onPress={() => router.push("/profil/faturalar" as Href)}
            />
          ))}
        </View>
      </View>

      <PlatformTrustCard />

      {/* Menü blokları */}
      {PROFILE_MENU_SECTIONS.map((section) => (
        <View key={section.title} className="gap-3">
          <SectionHeader title={section.title} />
          <View className="gap-3">
            {section.items.map((item) => (
              <PremiumListRow
                key={item.key}
                title={item.title}
                subtitle={item.subtitle}
                leading={
                  <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                    <Icon icon={item.icon} size={18} color="#f5f7ff" />
                  </View>
                }
                onPress={() => router.push(`/profil/${item.key}` as Href)}
              />
            ))}
          </View>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Uygulamayı değerlendir"
        onPress={() =>
          Alert.alert(
            "Uygulamayı değerlendir",
            "App Store / Play Store bağlantısı yakında.",
          )
        }
        className="flex-row items-center gap-3 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-app-warning/15">
          <Icon icon={Star} size={16} color="#f5b33f" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse">
            Uygulamayı değerlendir
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Kısa bir yıldız + yorum ile Naro'yu büyütmeye yardım et.
          </Text>
        </View>
        <Icon icon={ChevronRight} size={14} color="#83a7ff" />
      </Pressable>

      <Button
        label="Çıkış yap"
        variant="outline"
        size="lg"
        fullWidth
        leftIcon={<Icon icon={Wallet} size={16} color="#ff6b6b" />}
        onPress={onLogout}
      />

      <View className="items-center pt-2">
        <Text variant="caption" tone="muted" className="text-app-text-subtle">
          Naro · {APP_VERSION}
        </Text>
      </View>
    </Screen>
  );
}
