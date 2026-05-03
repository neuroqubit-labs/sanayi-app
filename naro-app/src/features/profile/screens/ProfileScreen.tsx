import { formatPhoneDisplay } from "@naro/mobile-core";
import {
  Avatar,
  Button,
  Icon,
  MaintenanceReminderCard,
  PremiumListRow,
  Screen,
  SectionHeader,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  Bell,
  CarFront,
  Check,
  ChevronRight,
  CreditCard,
  FileBadge2,
  HelpCircle,
  LogOut,
  Plus,
  Receipt,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { useMyCasesLive } from "@/features/cases/api";
import { useUnreadNotificationCount } from "@/features/notifications";
import { useMe } from "@/features/user";
import { useVehicles, useVehicleStore, type Vehicle } from "@/features/vehicles";
import { telemetry } from "@/runtime";
import { useAuthStore } from "@/services/auth/store";

import { useDeleteAccount } from "../api/useDeleteAccount";
import {
  APP_VERSION,
  FAVORITE_TECHNICIANS,
  MEMBERSHIP_LABEL,
  type FavoriteTechnician,
} from "../data/fixtures";
import { useFavoriteTechniciansStore } from "../favorites-store";
import { useUserProfileStore } from "../user-store";

export function ProfileScreen() {
  const router = useRouter();
  const clear = useAuthStore((state) => state.clear);
  useMe();
  const { data: vehicles } = useVehicles();
  const setActiveVehicle = useVehicleStore((state) => state.setActiveVehicle);
  const favoriteIds = useFavoriteTechniciansStore((state) => state.ids);
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

  const { data: myCases } = useMyCasesLive();
  const totalCompletedCases = useMemo(
    () =>
      (myCases ?? []).filter(
        (c) => c.status === "completed" || c.status === "archived",
      ).length,
    [myCases],
  );

  const favoriteTechnicians = useMemo(
    () =>
      FAVORITE_TECHNICIANS.filter((technician) =>
        favoriteIds.includes(technician.id),
      ),
    [favoriteIds],
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

  const deleteAccount = useDeleteAccount();

  function onDeleteAccount() {
    if (deleteAccount.isPending) return;
    Alert.alert(
      "Hesabı sil",
      "Hesabını sildiğinde 30 gün boyunca geri alabilirsin (destek ile iletişim). 30 gün sonra tüm verilerin kalıcı olarak silinir. Devam etmek istiyor musun?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Hesabı sil",
          style: "destructive",
          onPress: () => {
            deleteAccount.mutate(undefined, {
              onSuccess: async () => {
                telemetry.track("account_delete_requested", { app: "customer" });
                await clear();
                router.replace("/(auth)/login");
              },
              onError: (error) => {
                telemetry.captureError(error, { context: "account delete failed" });
                Alert.alert(
                  "Hesap silinemedi",
                  "Bağlantı kurulamadı. Lütfen birazdan tekrar deneyin.",
                );
              },
            });
          },
        },
      ],
    );
  }

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <ProfileHeader
        name={userName}
        phoneLabel={userPhoneDisplay}
        completedCases={totalCompletedCases}
        warrantyCount={activeWarrantyCount}
        unreadNotifications={unreadNotifications}
        onNotifications={() => router.push("/bildirimler" as Href)}
      />

      <GarageSection
        vehicles={vehicles ?? []}
        onOpenVehicle={(id) => router.push(`/arac/${id}` as Href)}
        onAddVehicle={() => router.push("/arac/yeni" as Href)}
        onSetActive={setActiveVehicle}
      />

      {maintenanceReminders.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="Bakım hatırlatmaları" />
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

      <AccountCenter
        unreadNotifications={unreadNotifications}
        onNavigate={(route) => router.push(route)}
      />

      <FavoriteTechniciansSection
        favorites={favoriteTechnicians}
        onOpen={(id) => router.push(`/usta/${id}` as Href)}
        onBrowse={() => router.push("/(tabs)/carsi" as Href)}
      />

      <SecondaryProfileActions
        onNavigate={(route) => router.push(route)}
        onRate={() =>
          Alert.alert(
            "Uygulamayı değerlendir",
            "App Store / Play Store bağlantısı yakında.",
          )
        }
      />

      <Button
        label="Çıkış yap"
        variant="outline"
        size="lg"
        fullWidth
        leftIcon={<Icon icon={LogOut} size={16} color="#ff6b6b" />}
        onPress={onLogout}
      />

      <Button
        label={deleteAccount.isPending ? "Hesap siliniyor…" : "Hesabımı sil"}
        variant="ghost"
        size="md"
        fullWidth
        disabled={deleteAccount.isPending}
        leftIcon={<Icon icon={Trash2} size={16} color="#ff6b6b" />}
        onPress={onDeleteAccount}
      />

      <View className="items-center pt-2">
        <Text variant="caption" tone="muted" className="text-app-text-subtle">
          Naro · {APP_VERSION}
        </Text>
      </View>
    </Screen>
  );
}

function ProfileHeader({
  name,
  phoneLabel,
  completedCases,
  warrantyCount,
  unreadNotifications,
  onNotifications,
}: {
  name: string;
  phoneLabel: string;
  completedCases: number;
  warrantyCount: number;
  unreadNotifications: number;
  onNotifications: () => void;
}) {
  return (
    <View className="gap-4 rounded-[26px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} size="lg" />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text
              variant="h2"
              tone="inverse"
              numberOfLines={1}
              className="text-[21px] leading-[25px]"
            >
              {name}
            </Text>
            <TrustBadge label={MEMBERSHIP_LABEL} tone="info" />
          </View>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted"
          >
            {phoneLabel || "Telefon bilgisi bekleniyor"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bildirim merkezi"
          onPress={onNotifications}
          className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2 active:bg-app-surface-3"
        >
          <Icon icon={Bell} size={18} color="#0ea5e9" />
          {unreadNotifications > 0 ? (
            <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-app-critical px-1">
              <Text variant="caption" tone="inverse" className="text-[10px]">
                {unreadNotifications}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <MetricChip label="İş" value={`${completedCases}`} />
        <MetricChip label="Garanti" value={`${warrantyCount}`} />
        <MetricChip label="Üyelik" value={MEMBERSHIP_LABEL.replace(" üye", "")} />
      </View>
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-[18px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
      <Text variant="label" tone="inverse" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="subtle" className="text-[11px]">
        {label}
      </Text>
    </View>
  );
}

function GarageSection({
  vehicles,
  onOpenVehicle,
  onAddVehicle,
  onSetActive,
}: {
  vehicles: Vehicle[];
  onOpenVehicle: (id: string) => void;
  onAddVehicle: () => void;
  onSetActive: (id: string) => void;
}) {
  const activeVehicle = vehicles.find((vehicle) => vehicle.isActive) ?? vehicles[0];
  const otherVehicles = activeVehicle
    ? vehicles.filter((vehicle) => vehicle.id !== activeVehicle.id)
    : vehicles;

  return (
    <View className="gap-3">
      <SectionHeader title="Garaj" />
      {activeVehicle ? (
        <ActiveVehicleCard
          vehicle={activeVehicle}
          onPress={() => onOpenVehicle(activeVehicle.id)}
        />
      ) : (
        <AddVehicleHero onPress={onAddVehicle} />
      )}

      {vehicles.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-6"
          contentContainerStyle={{ gap: 10, paddingHorizontal: 24 }}
        >
          {otherVehicles.map((vehicle) => (
            <VehicleMiniCard
              key={vehicle.id}
              vehicle={vehicle}
              onOpen={() => onOpenVehicle(vehicle.id)}
              onSetActive={() => onSetActive(vehicle.id)}
            />
          ))}
          <AddVehicleMiniCard onPress={onAddVehicle} />
        </ScrollView>
      ) : null}
    </View>
  );
}

function ActiveVehicleCard({
  vehicle,
  onPress,
}: {
  vehicle: Vehicle;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.plate} aracını aç`}
      onPress={onPress}
      className="gap-4 rounded-[26px] border border-brand-500/35 bg-brand-500/10 px-4 py-4 active:opacity-90"
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={`${vehicle.make} ${vehicle.model}`} size="lg" />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="h3" tone="inverse" className="text-[18px] leading-[22px]">
            {vehicle.plate}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={1}
            className="text-app-text-muted"
          >
            {vehicle.make} {vehicle.model} · {vehicle.year}
          </Text>
        </View>
        <TrustBadge label="Aktif" tone="success" />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <TrustBadge
          label={`${vehicle.mileageKm.toLocaleString("tr-TR")} km`}
          tone="neutral"
        />
        {vehicle.healthLabel ? (
          <TrustBadge label={vehicle.healthLabel} tone="accent" />
        ) : null}
        {vehicle.warranties.length > 0 ? (
          <TrustBadge label={`${vehicle.warranties.length} garanti`} tone="info" />
        ) : null}
        {vehicle.insuranceExpiryLabel ? (
          <TrustBadge
            label={`Sigorta ${vehicle.insuranceExpiryLabel}`}
            tone="neutral"
          />
        ) : null}
        {vehicle.maintenanceReminders.length > 0 ? (
          <TrustBadge label="Bakım yakın" tone="warning" />
        ) : null}
      </View>
    </Pressable>
  );
}

function VehicleMiniCard({
  vehicle,
  onOpen,
  onSetActive,
}: {
  vehicle: Vehicle;
  onOpen: () => void;
  onSetActive: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.plate} aracını aç`}
      onPress={onOpen}
      className="w-52 gap-3 rounded-[22px] border border-app-outline bg-app-surface px-3.5 py-3.5 active:bg-app-surface-2"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-app-surface-2">
          <Icon icon={CarFront} size={18} color="#83a7ff" />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="label" tone="inverse" numberOfLines={1}>
            {vehicle.plate}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={1}
            className="text-app-text-muted"
          >
            {vehicle.make} {vehicle.model}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${vehicle.plate} aracını aktif yap`}
        onPress={(event) => {
          event.stopPropagation();
          onSetActive();
        }}
        className="flex-row items-center justify-center gap-2 rounded-full border border-app-outline bg-app-surface-2 px-3 py-2 active:bg-app-surface-3"
      >
        <Icon icon={Check} size={13} color="#83a7ff" />
        <Text variant="caption" tone="accent">
          Aktif yap
        </Text>
      </Pressable>
    </Pressable>
  );
}

function AddVehicleHero({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Aracını ekle"
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-[26px] border border-app-success/30 bg-app-success-soft px-4 py-4 active:opacity-90"
    >
      <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-app-success/20">
        <Icon icon={CarFront} size={24} color="#2dd28d" />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="h3" tone="success">
          Aracını ekle
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted leading-[18px]"
        >
          Vaka ve usta önerileri araç profiline göre çalışır.
        </Text>
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-app-success">
        <Icon icon={Plus} size={18} color="#ffffff" />
      </View>
    </Pressable>
  );
}

function AddVehicleMiniCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Yeni araç ekle"
      onPress={onPress}
      className="w-36 items-center justify-center gap-2 rounded-[22px] border border-dashed border-app-outline bg-app-surface px-3 py-3.5 active:bg-app-surface-2"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={Plus} size={17} color="#83a7ff" />
      </View>
      <Text variant="caption" tone="inverse" className="text-center">
        Araç ekle
      </Text>
    </Pressable>
  );
}

function AccountCenter({
  unreadNotifications,
  onNavigate,
}: {
  unreadNotifications: number;
  onNavigate: (route: Href) => void;
}) {
  const items: AccountItem[] = [
    {
      title: "Kişisel bilgiler",
      subtitle: "Ad, telefon ve e-posta",
      icon: UserRound,
      color: "#83a7ff",
      route: "/profil/kisisel-bilgiler" as Href,
    },
    {
      title: "Bildirim tercihleri",
      subtitle:
        unreadNotifications > 0
          ? `${unreadNotifications} yeni bildirim`
          : "Push, SMS ve e-posta",
      icon: Bell,
      color: "#0ea5e9",
      route: "/profil/bildirimler" as Href,
    },
    {
      title: "Ödeme",
      subtitle: "Kartlar ve varsayılan yöntem",
      icon: CreditCard,
      color: "#2dd28d",
      route: "/profil/odeme-yontemleri" as Href,
    },
    {
      title: "Cihaz güvenliği",
      subtitle: "Oturum ve bağlı cihazlar",
      icon: Smartphone,
      color: "#f5b33f",
      route: "/profil/cihaz" as Href,
    },
    {
      title: "Destek",
      subtitle: "Yardım merkezi ve iletişim",
      icon: HelpCircle,
      color: "#f5f7ff",
      route: "/profil/destek" as Href,
    },
  ];

  return (
    <View className="gap-3">
      <SectionHeader title="Hesap merkezi" />
      <View className="gap-2.5 rounded-[24px] border border-app-outline bg-app-surface px-3 py-3">
        {items.map((item) => (
          <AccountCenterRow
            key={item.title}
            item={item}
            onPress={() => onNavigate(item.route)}
          />
        ))}
      </View>
    </View>
  );
}

type AccountItem = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  route: Href;
};

function AccountCenterRow({
  item,
  onPress,
}: {
  item: AccountItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[18px] px-2 py-2.5 active:bg-app-surface-2"
    >
      <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-app-surface-2">
        <Icon icon={item.icon} size={18} color={item.color} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {item.title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          numberOfLines={1}
          className="text-app-text-muted"
        >
          {item.subtitle}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={16} color="#6f7b97" />
    </Pressable>
  );
}

function FavoriteTechniciansSection({
  favorites,
  onOpen,
  onBrowse,
}: {
  favorites: FavoriteTechnician[];
  onOpen: (id: string) => void;
  onBrowse: () => void;
}) {
  return (
    <View className="gap-3">
      <SectionHeader
        title="Favori ustalar"
        actionLabel="Çarşı"
        onActionPress={onBrowse}
      />
      {favorites.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-6"
          contentContainerStyle={{ gap: 10, paddingHorizontal: 24 }}
        >
          {favorites.map((technician) => (
            <FavoriteTechnicianCard
              key={technician.id}
              technician={technician}
              onPress={() => onOpen(technician.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Favori usta eklemek için Çarşı'yı aç"
          onPress={onBrowse}
          className="flex-row items-center gap-3 rounded-[22px] border border-dashed border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={Star} size={17} color="#f5b33f" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="inverse">
              Henüz favori yok
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              Beğendiğin ustaları profilinden favorilere ekleyebilirsin.
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function FavoriteTechnicianCard({
  technician,
  onPress,
}: {
  technician: FavoriteTechnician;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${technician.name} profilini aç`}
      onPress={onPress}
      className="w-60 gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={technician.name} size="md" />
        <View className="min-w-0 flex-1">
          <Text variant="label" tone="inverse" numberOfLines={1}>
            {technician.name}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={1}
            className="text-app-text-muted"
          >
            {technician.specialty}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <TrustBadge label={technician.ratingLabel} tone="warning" />
        <TrustBadge label={technician.distanceLabel} tone="neutral" />
      </View>
    </Pressable>
  );
}

function SecondaryProfileActions({
  onNavigate,
  onRate,
}: {
  onNavigate: (route: Href) => void;
  onRate: () => void;
}) {
  return (
    <View className="gap-3">
      <SectionHeader title="Diğer" />
      <View className="gap-3">
        <PremiumListRow
          title="Faturalar"
          subtitle="Geçmiş işlemler ve makbuzlar"
          leading={<RoundIcon icon={Receipt} color="#2dd28d" />}
          onPress={() => onNavigate("/profil/faturalar" as Href)}
        />
        <PremiumListRow
          title="Platform güvencesi"
          subtitle="Ödeme, servis ve anlaşmazlık süreci"
          leading={<RoundIcon icon={ShieldCheck} color="#0ea5e9" />}
          onPress={() => onNavigate("/profil/guven" as Href)}
        />
        <PremiumListRow
          title="Kullanım ve gizlilik"
          subtitle="Koşullar, izinler ve veri politikası"
          leading={<RoundIcon icon={FileBadge2} color="#83a7ff" />}
          onPress={() => onNavigate("/profil/belgeler" as Href)}
        />
        <PremiumListRow
          title="Uygulamayı değerlendir"
          subtitle="Kısa bir yorum Naro'yu büyütür"
          leading={<RoundIcon icon={Star} color="#f5b33f" />}
          onPress={onRate}
        />
      </View>
    </View>
  );
}

function RoundIcon({
  icon,
  color,
}: {
  icon: LucideIcon;
  color: string;
}) {
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
      <Icon icon={icon} size={18} color={color} />
    </View>
  );
}
