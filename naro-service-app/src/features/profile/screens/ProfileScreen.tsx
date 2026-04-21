import type {
  TechnicianCapability,
  TechnicianCertificate,
  TechnicianCertificateKind,
} from "@naro/domain";
import { PRIMARY_TECHNICIAN_ID } from "@naro/mobile-core";
import {
  Avatar,
  Button,
  HeroMetric,
  Icon,
  ProfileSection,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { useRouter } from "expo-router";
import {
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  PlayCircle,
  Quote,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Truck,
  Wrench,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { CertificateSection } from "@/features/profile/components/CertificateSection";
import {
  ProfileEditSheet,
  type ProfileEditTarget,
} from "@/features/profile/components/ProfileEditSheet";
import { ProfileManagementHub } from "@/features/profile/components/ProfileManagementHub";
import { useShellConfig } from "@/features/shell";
import {
  type GalleryItem,
  MONTHLY_STATS,
  getProviderTypeMeta,
  useTechnicianProfileStore,
} from "@/features/technicians";
import { telemetry } from "@/runtime";
import { useAuthStore } from "@/services/auth/store";
import { openMediaAsset } from "@/shared/media/openAsset";
import { useServiceMediaUpload } from "@/shared/media/useServiceMediaUpload";

type CapabilityKey = keyof TechnicianCapability;

export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clear = useAuthStore((s) => s.clear);
  const profile = useTechnicianProfileStore();
  const toggleCapability = useTechnicianProfileStore(
    (state) => state.toggleCapability,
  );
  const setAvailability = useTechnicianProfileStore(
    (state) => state.setAvailability,
  );

  const shellConfig = useShellConfig();
  const providerMeta = getProviderTypeMeta(shellConfig.active_provider_type);
  const campaignsVisible =
    shellConfig.enabled_capabilities.includes("campaigns");

  const updateField = useTechnicianProfileStore((s) => s.updateField);
  const updateBusiness = useTechnicianProfileStore((s) => s.updateBusiness);
  const addSpecialty = useTechnicianProfileStore((s) => s.addSpecialty);
  const removeSpecialty = useTechnicianProfileStore((s) => s.removeSpecialty);
  const addExpertise = useTechnicianProfileStore((s) => s.addExpertise);
  const removeExpertise = useTechnicianProfileStore((s) => s.removeExpertise);
  const { isUploading: isMediaUploading, pickAndUpload } = useServiceMediaUpload();
  const [editTarget, setEditTarget] = useState<ProfileEditTarget | null>(null);

  const openEdit = (target: ProfileEditTarget) => setEditTarget(target);
  const handleEditSave = (result: Parameters<
    NonNullable<Parameters<typeof ProfileEditSheet>[0]["onSave"]>
  >[0]) => {
    if (result.kind === "text") {
      updateField(result.field, result.value);
    } else if (result.kind === "textarea") {
      updateField(result.field, result.value);
    } else if (result.kind === "tags") {
      const current = profile[result.field];
      const next = result.value;
      current.filter((t) => !next.includes(t)).forEach((t) => {
        if (result.field === "specialties") removeSpecialty(t);
        else removeExpertise(t);
      });
      next.filter((t) => !current.includes(t)).forEach((t) => {
        if (result.field === "specialties") addSpecialty(t);
        else addExpertise(t);
      });
    } else if (result.kind === "business") {
      updateBusiness(result.value);
    }
  };

  const availabilityTone =
    profile.availability === "available"
      ? "success"
      : profile.availability === "busy"
        ? "warning"
        : "critical";
  const availabilityLabel =
    profile.availability === "available"
      ? "Açık"
      : profile.availability === "busy"
        ? "Yoğun"
        : "Çevrimdışı";

  const approvedCount = profile.certificates.filter(
    (c) => c.status === "approved",
  ).length;

  async function onLogout() {
    Alert.alert("Çıkış yapılsın mı?", "Tekrar giriş için OTP kodu gerekecek.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış yap",
        style: "destructive",
        onPress: async () => {
          await clear();
          telemetry.track("auth_logout", { app: "service" });
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const toggleAvailability = () => {
    setAvailability(
      profile.availability === "available" ? "busy" : "available",
    );
  };

  const openCertificateUpload = (kind: TechnicianCertificateKind) => {
    router.push({
      pathname: "/(modal)/sertifika-yukle",
      params: { kind, context: "profile" },
    });
  };

  const handleOpenCertificate = (certificate: TechnicianCertificate) => {
    void openMediaAsset(certificate.asset);
  };

  const handleUploadAvatar = async () => {
    try {
      const uploaded = await pickAndUpload({
        purpose: "user_avatar",
        ownerRef: PRIMARY_TECHNICIAN_ID,
        selection: "photo",
        fallbackName: `avatar-${Date.now()}.jpg`,
      });
      if (!uploaded) return;
      updateField("avatar_asset", uploaded.asset);
      Alert.alert("Profil fotoğrafı güncellendi");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Profil fotoğrafı yüklenemedi.";
      Alert.alert("Yükleme başarısız", message);
    }
  };

  const handleUploadPromo = async () => {
    try {
      const uploaded = await pickAndUpload({
        purpose: "technician_promo_video",
        ownerRef: PRIMARY_TECHNICIAN_ID,
        selection: "video",
        fallbackName: `promo-${Date.now()}.mp4`,
      });
      if (!uploaded) return;
      updateField("promo_video_asset", uploaded.asset);
      updateField("promo_video_url", uploaded.asset.download_url ?? uploaded.localUri);
      Alert.alert("Tanıtım videosu güncellendi");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tanıtım videosu yüklenemedi.";
      Alert.alert("Yükleme başarısız", message);
    }
  };

  const handleAddGallery = async (selection: "photo" | "video") => {
    try {
      const uploaded = await pickAndUpload({
        purpose:
          selection === "video"
            ? "technician_gallery_video"
            : "technician_gallery_photo",
        ownerRef: PRIMARY_TECHNICIAN_ID,
        selection,
        fallbackName: `gallery-${selection}-${Date.now()}${
          selection === "video" ? ".mp4" : ".jpg"
        }`,
      });
      if (!uploaded) return;

      const item: GalleryItem = {
        id: `gallery-${Date.now()}`,
        kind: selection,
        title: uploaded.name,
        caption: selection === "video" ? "Yeni tanıtım videosu" : "Yeni galeri yüklemesi",
        asset: uploaded.asset,
      };
      updateField("gallery", [item, ...profile.gallery]);
      Alert.alert(
        selection === "video" ? "Galeri videosu eklendi" : "Galeri görseli eklendi",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Galeri medyası yüklenemedi.";
      Alert.alert("Yükleme başarısız", message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-app-bg" edges={["top"]}>
      <ScrollView
        contentContainerClassName="gap-5 pb-40"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="mx-4 overflow-hidden rounded-[28px] border border-app-outline-strong bg-app-surface">
          <View className="relative h-36 overflow-hidden bg-brand-500/15">
            <View className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-brand-500/25" />
            <View className="absolute -left-10 bottom-[-30px] h-32 w-32 rounded-full bg-brand-500/10" />
            <View className="absolute right-4 top-4">
              <StatusChip label={availabilityLabel} tone={availabilityTone} />
            </View>
            <View className="absolute left-4 top-4">
              <TrustBadge label={providerMeta.shortLabel} tone="accent" />
            </View>
          </View>

          <View className="-mt-12 items-center gap-3 px-5 pb-5">
            <View className="relative">
              <View className="rounded-full border-4 border-app-surface bg-app-surface-2 p-1">
                <Avatar
                  name={profile.name}
                  imageUri={
                    profile.avatar_asset?.preview_url ??
                    profile.avatar_asset?.download_url ??
                    null
                  }
                  size="xl"
                />
              </View>
              {profile.verified_level !== "basic" ? (
                <View className="absolute bottom-1 right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-app-surface bg-app-success">
                  <Icon
                    icon={CheckCircle2}
                    size={14}
                    color="#0b0e1c"
                    strokeWidth={3}
                  />
                </View>
              ) : null}
            </View>

            <View className="items-center gap-1">
              <Text
                variant="display"
                tone="inverse"
                className="text-center text-[22px] leading-[26px]"
              >
                {profile.name}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-center text-app-text-muted"
              >
                {profile.tagline}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-center text-app-text-subtle text-[11px]"
              >
                {providerMeta.label} · {MONTHLY_STATS.completed_jobs} iş
              </Text>
            </View>

            <View className="mt-1 flex-row gap-2 self-stretch">
              <HeroMetric
                icon={Star}
                iconColor="#f5b33f"
                value={MONTHLY_STATS.rating_avg.toFixed(1)}
                label={`${MONTHLY_STATS.review_count} yorum`}
              />
              <HeroMetric
                icon={Briefcase}
                iconColor="#83a7ff"
                value={`${MONTHLY_STATS.completed_jobs}`}
                label="Tamamlanan"
              />
              <HeroMetric
                icon={Clock}
                iconColor="#2dd28d"
                value={`${MONTHLY_STATS.response_minutes} dk`}
                label="Yanıt"
              />
            </View>

            <View className="mt-2 flex-row gap-2 self-stretch">
              <View className="flex-1">
                <Button
                  label={
                    profile.availability === "available"
                      ? "Müsaitliği durdur"
                      : "Müsait olarak aç"
                  }
                  variant={
                    profile.availability === "available" ? "outline" : "primary"
                  }
                  onPress={toggleAvailability}
                  fullWidth
                />
              </View>
            </View>
          </View>
        </View>

        {/* Yönetim merkezi — anasayfadan taşınan 4 kısayol */}
        <ProfileManagementHub />

        {/* Sağlayıcı profili */}
        <ProfileSection
          title="Sağlayıcı profili"
          description={`${providerMeta.label} olarak kayıtlısın`}
          accessory={
            <TrustBadge
              label={
                profile.verified_level === "premium"
                  ? "Naro Pro"
                  : profile.verified_level === "verified"
                    ? "Doğrulandı"
                    : "Temel"
              }
              tone={profile.verified_level === "basic" ? "neutral" : "success"}
            />
          }
        >
          <View className="mx-4 gap-2 rounded-[20px] border border-brand-500/30 bg-brand-500/10 px-4 py-3.5">
            <View className="flex-row items-center gap-2">
              <Icon icon={Sparkles} size={13} color="#0ea5e9" />
              <Text variant="eyebrow" tone="subtle">
                Hizmet tipi
              </Text>
            </View>
            <Text
              variant="label"
              tone="inverse"
              className="text-[14px] leading-[19px]"
            >
              {providerMeta.label}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted leading-[18px]"
            >
              {providerMeta.description}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  "Tipi değiştir",
                  "Hizmet tipini değiştirmek için admin onayı gerekir. Yakında.",
                )
              }
              className="mt-1 self-start rounded-full border border-app-outline bg-app-surface px-3 py-1 active:opacity-80"
            >
              <Text variant="caption" tone="muted" className="text-[11px]">
                Tipi değiştir
              </Text>
            </Pressable>
          </View>
        </ProfileSection>

        {/* Sertifikalar */}
        <ProfileSection
          title="Sertifikalar"
          description={`${approvedCount}/6 doğrulandı · verified_level: ${profile.verified_level}`}
        >
          <CertificateSection
            certificates={profile.certificates}
            onUpload={openCertificateUpload}
            onManage={handleOpenCertificate}
          />
        </ProfileSection>

        <ProfileSection
          title="Medya vitrini"
          description="Avatar, galeri ve tanıtım videonu aynı upload hattından yönet."
        >
          <View className="gap-3 px-4">
            <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
              <View className="gap-1">
                <Text variant="label" tone="inverse" className="text-[14px]">
                  Profil fotoğrafı
                </Text>
                <Text variant="caption" tone="muted" className="text-app-text-muted">
                  {profile.avatar_asset
                    ? "Profil kapağında kullanılan görsel yüklü."
                    : "Henüz bir profil fotoğrafı yüklemedin."}
                </Text>
              </View>
              <Button
                label={profile.avatar_asset ? "Avatarı değiştir" : "Avatar yükle"}
                variant="outline"
                loading={isMediaUploading}
                onPress={() => void handleUploadAvatar()}
                fullWidth
              />
            </View>

            <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
              <View className="gap-1">
                <Text variant="label" tone="inverse" className="text-[14px]">
                  Tanıtım videosu
                </Text>
                <Text variant="caption" tone="muted" className="text-app-text-muted">
                  {profile.promo_video_asset
                    ? "Tanıtım videon hazır. İstersen açabilir veya yenileyebilirsin."
                    : "Atölyeni ve iş disiplinini gösterecek kısa bir video ekle."}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button
                  label={
                    profile.promo_video_asset ? "Videoyu değiştir" : "Video yükle"
                  }
                  variant="outline"
                  loading={isMediaUploading}
                  onPress={() => void handleUploadPromo()}
                  className="flex-1"
                />
                {profile.promo_video_asset ? (
                  <Button
                    label="Aç"
                    variant="surface"
                    leftIcon={<Icon icon={PlayCircle} size={14} color="#f5f7ff" />}
                    onPress={() => void openMediaAsset(profile.promo_video_asset)}
                  />
                ) : null}
              </View>
            </View>

            <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text variant="label" tone="inverse" className="text-[14px]">
                    Galeri
                  </Text>
                  <Text variant="caption" tone="muted" className="text-app-text-muted">
                    {profile.gallery.length} medya kaydı. Public vitrinde kullanılacak.
                  </Text>
                </View>
                <TrustBadge
                  label={`${profile.gallery.length} kayıt`}
                  tone={profile.gallery.length > 0 ? "success" : "info"}
                />
              </View>
              <View className="flex-row gap-2">
                <Button
                  label="Foto ekle"
                  variant="outline"
                  loading={isMediaUploading}
                  onPress={() => void handleAddGallery("photo")}
                  className="flex-1"
                />
                <Button
                  label="Video ekle"
                  variant="outline"
                  loading={isMediaUploading}
                  onPress={() => void handleAddGallery("video")}
                  className="flex-1"
                />
              </View>
              <View className="gap-2">
                {profile.gallery.slice(0, 4).map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title ?? "Galeri medyası"} aç`}
                    onPress={() => void openMediaAsset(item.asset, "preview")}
                    className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface-2 px-4 py-3 active:opacity-85"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
                      <Icon
                        icon={item.kind === "video" ? PlayCircle : FileText}
                        size={16}
                        color={item.kind === "video" ? "#0ea5e9" : "#83a7ff"}
                      />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text variant="label" tone="inverse" className="text-[13px]">
                        {item.title ?? (item.kind === "video" ? "Galeri videosu" : "Galeri görseli")}
                      </Text>
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-muted text-[11px]"
                      >
                        {item.caption ?? "Servis vitrini medyası"}
                      </Text>
                    </View>
                    <TrustBadge
                      label={item.kind === "video" ? "Video" : "Foto"}
                      tone={item.kind === "video" ? "accent" : "info"}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ProfileSection>

        {/* Hakkımda */}
        <ProfileSection
          title="Hakkımda"
          onEdit={() =>
            openEdit({
              kind: "textarea",
              field: "biography",
              title: "Hakkımda",
              description: "Müşteriye hizmet tarzını ve deneyimini anlat.",
              placeholder: "Kısa bir biyografi yaz…",
              initial: profile.biography,
            })
          }
        >
          <View className="mx-4 gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text leading-[20px]"
            >
              {profile.biography}
            </Text>
          </View>
        </ProfileSection>

        {/* Kampanyalarım — provider_type gated */}
        {campaignsVisible ? (
          <ProfileSection
            title="Kampanyalarım"
            description="Yayındaki paket ve teklifler"
            onEdit={() => router.push("/(modal)/kampanyalarim")}
            editLabel="Tümü"
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3 px-4"
            >
              {SAMPLE_CAMPAIGNS.map((campaign) => (
                <View
                  key={campaign.id}
                  className="w-[220px] gap-2 rounded-[20px] border border-app-success/30 bg-app-success-soft px-4 py-3.5"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-app-success/20">
                    <Icon icon={Tag} size={14} color="#2dd28d" />
                  </View>
                  <Text variant="label" tone="inverse" className="text-[14px]">
                    {campaign.title}
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[12px]"
                  >
                    {campaign.subtitle}
                  </Text>
                  <Text variant="label" tone="success">
                    {campaign.priceLabel}
                  </Text>
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(modal)/kampanya-olustur")}
                className="w-[180px] items-center justify-center gap-2 rounded-[20px] border border-dashed border-app-outline-strong bg-app-surface-2 px-4 py-3.5 active:opacity-85"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500/15">
                  <Icon icon={Sparkles} size={15} color="#f45f25" />
                </View>
                <Text variant="label" tone="inverse" className="text-[13px]">
                  Yeni Kampanya
                </Text>
              </Pressable>
            </ScrollView>
          </ProfileSection>
        ) : null}

        {/* Hizmet kapsamı (capabilities) */}
        <ProfileSection
          title="Hizmet kapsamı"
          description="Hangi işleri alıyorsun? + butonundaki aksiyonlar buna bağlı."
        >
          <View className="mx-4 gap-2">
            <CapabilityRow
              icon={ShieldCheck}
              color="#83a7ff"
              label="Sigorta dosyası takip ederim"
              description="Kasko / trafik dosyaları için sigortaya ileti hazırlayabilirsin."
              enabled={profile.capabilities.insurance_case_handler}
              onToggle={() => toggleCapability("insurance_case_handler")}
            />
            <CapabilityRow
              icon={Wrench}
              color="#2dd28d"
              label="Yerinde onarım yapabilirim"
              description="Müşterinin bulunduğu yerde tamir / teşhis yapabilirsin."
              enabled={profile.capabilities.on_site_repair}
              onToggle={() => toggleCapability("on_site_repair")}
            />
            <CapabilityRow
              icon={Truck}
              color="#f5b33f"
              label="Çekici koordinasyonu"
              description="Sahneden aracı alır, atölyeye getirebilirsin."
              enabled={profile.capabilities.towing_coordination}
              onToggle={() => toggleCapability("towing_coordination")}
            />
            <CapabilityRow
              icon={Sparkles}
              color="#0ea5e9"
              label="Valet / pickup hizmeti"
              description="Müşteriden aracı alır, teslim sonrası götürürsün."
              enabled={profile.capabilities.valet_service}
              onToggle={() => toggleCapability("valet_service")}
            />
          </View>
        </ProfileSection>

        {/* Uzmanlık */}
        <ProfileSection
          title="Uzmanlık & hizmetler"
          description="Hizmet ve alan etiketleri"
          onEdit={() =>
            openEdit({
              kind: "tags",
              field: "specialties",
              title: "Uzmanlık etiketleri",
              description:
                "Ana hizmet etiketlerin. Havuz ve öneri motorunda kullanılır.",
              initial: profile.specialties,
            })
          }
        >
          <View className="gap-3 px-4">
            <View className="flex-row flex-wrap gap-2">
              {profile.specialties.map((specialty) => (
                <TrustBadge key={specialty} label={specialty} tone="accent" />
              ))}
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="eyebrow" tone="subtle">
                Alt uzmanlıklar
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Alt uzmanlıkları düzenle"
                onPress={() =>
                  openEdit({
                    kind: "tags",
                    field: "expertise",
                    title: "Alt uzmanlıklar",
                    description:
                      "Daha dar alanlar (örn. zamanlama kiti, OBD teşhis). Profilde detay olarak görünür.",
                    initial: profile.expertise,
                  })
                }
                className="rounded-full border border-app-outline px-3 py-1 active:opacity-80"
              >
                <Text variant="caption" tone="inverse" className="text-[11px]">
                  Düzenle
                </Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {profile.expertise.map((item) => (
                <View
                  key={item}
                  className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-3 py-1.5"
                >
                  <Icon icon={Wrench} size={11} color="#83a7ff" />
                  <Text variant="caption" tone="muted" className="text-[12px]">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ProfileSection>

        {/* Çalışma saatleri */}
        <ProfileSection
          title="Çalışma saatleri"
          onEdit={() =>
            openEdit({
              kind: "text",
              field: "working_hours",
              title: "Çalışma saatleri",
              description:
                "Hafta içi + hafta sonu açılış kapanış bilgisi.",
              placeholder: "Hafta içi 09:00–18:30 · Cumartesi 10:00–15:00",
              initial: profile.working_hours,
            })
          }
        >
          <View className="mx-4 flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
              <Icon icon={Clock} size={16} color="#0ea5e9" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Müsaitlik
              </Text>
              <Text variant="label" tone="inverse" className="text-[13px]">
                {profile.working_hours}
              </Text>
            </View>
          </View>
        </ProfileSection>

        {/* Konum + işletme */}
        <ProfileSection
          title="İşletme bilgileri"
          onEdit={() =>
            openEdit({
              kind: "business",
              field: "business",
              title: "İşletme bilgileri",
              description:
                "Vergi levhasındaki ünvan ve hizmet adresi. Doğrulama için admin kontrol eder.",
              initial: {
                legal_name: profile.business.legal_name,
                tax_number: profile.business.tax_number ?? "",
                address: profile.business.address,
                city_district: profile.business.city_district ?? "",
              },
            })
          }
        >
          <View className="mx-4 gap-3 overflow-hidden rounded-[20px] border border-app-outline bg-app-surface">
            <View className="relative h-24 overflow-hidden bg-brand-500/10">
              <View className="absolute inset-0 flex-row flex-wrap">
                {Array.from({ length: 32 }).map((_, idx) => (
                  <View
                    key={idx}
                    className="h-6 border-b border-r border-brand-500/15"
                    style={{ width: `${100 / 8}%` }}
                  />
                ))}
              </View>
              <View className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 items-center justify-center rounded-full border-2 border-app-surface bg-brand-500">
                <Icon icon={MapPin} size={14} color="#0b0e1c" strokeWidth={3} />
              </View>
            </View>
            <View className="gap-3 px-4 pb-3.5">
              <ProfileRow
                label="Ticari ünvan"
                value={profile.business.legal_name}
              />
              <ProfileRow
                label="Adres"
                value={`${profile.business.address}${profile.business.city_district ? ` · ${profile.business.city_district}` : ""}`}
                icon={MapPin}
              />
              <View className="flex-row items-start gap-2">
                <View className="flex-1">
                  <ProfileRow
                    label="Hizmet bölgesi"
                    value={profile.area_label}
                    icon={MapPin}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hizmet bölgesini düzenle"
                  onPress={() =>
                    openEdit({
                      kind: "text",
                      field: "area_label",
                      title: "Hizmet bölgesi",
                      description: "Havuz önerilerinde mesafe hesaplaması için kullanılır.",
                      placeholder: "Maslak Sanayi, Sarıyer / İstanbul",
                      initial: profile.area_label,
                    })
                  }
                  className="rounded-full border border-app-outline px-3 py-1 active:opacity-80"
                >
                  <Text variant="caption" tone="inverse" className="text-[11px]">
                    Düzenle
                  </Text>
                </Pressable>
              </View>
              {profile.business.tax_number ? (
                <ProfileRow
                  label="Vergi no"
                  value={profile.business.tax_number}
                  icon={FileText}
                />
              ) : null}
            </View>
          </View>
        </ProfileSection>

        {/* Yorumlar */}
        <ProfileSection
          title={`Yorumlar (${MONTHLY_STATS.review_count})`}
          description="Son müşteri geri bildirimleri"
          onEdit={() => router.push("/(modal)/yorumlar")}
          editLabel="Tümü"
        >
          <View className="gap-3 px-4">
            {SAMPLE_REVIEWS.map((review) => (
              <View
                key={review.id}
                className="flex-row items-start gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5"
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500/15">
                  <Icon icon={Quote} size={13} color="#0ea5e9" />
                </View>
                <View className="flex-1 gap-1">
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text leading-[20px]"
                  >
                    "{review.body}"
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <Icon
                      icon={BadgeCheck}
                      size={11}
                      color="#2dd28d"
                      strokeWidth={2.5}
                    />
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text-subtle text-[11px]"
                    >
                      {review.author}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ProfileSection>

        {/* Ayarlar */}
        <ProfileSection title="Ayarlar">
          <View className="mx-4 gap-2">
            <SettingsRow
              icon={Settings}
              label="Bildirim tercihleri"
              onPress={() => router.push("/bildirimler")}
            />
            <SettingsRow
              icon={FileText}
              label="Belgeler ve KVKK"
              onPress={() => Alert.alert("Yakında")}
            />
            <SettingsRow
              icon={ShieldCheck}
              label="Platform güvencesi"
              onPress={() => Alert.alert("Yakında")}
            />
          </View>
        </ProfileSection>

        <View className="px-4">
          <Button
            label="Çıkış yap"
            variant="outline"
            onPress={onLogout}
            fullWidth
          />
        </View>

        <View
          className="items-center pt-1"
          style={{ paddingBottom: insets.bottom + 4 }}
        >
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[10px]"
          >
            Naro Servis · 1.0.0
          </Text>
        </View>
      </ScrollView>

      <ProfileEditSheet
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEditSave}
      />
    </SafeAreaView>
  );
}

function ProfileRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: typeof MapPin;
}) {
  return (
    <View className="flex-row items-start gap-3">
      {icon ? (
        <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-app-surface-2">
          <Icon icon={icon} size={14} color="#83a7ff" />
        </View>
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text variant="eyebrow" tone="subtle">
          {label}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text text-[13px] leading-[18px]"
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function CapabilityRow({
  icon,
  color,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: typeof Wrench;
  color: string;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onToggle}
      className={`flex-row items-start gap-3 rounded-[16px] border px-4 py-3.5 ${
        enabled
          ? "border-app-success/40 bg-app-success/10"
          : "border-app-outline bg-app-surface"
      } active:opacity-85`}
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          enabled ? "bg-app-success/20" : "bg-app-surface-2"
        }`}
      >
        <Icon icon={icon} size={16} color={color} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {label}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px] leading-[16px]"
        >
          {description}
        </Text>
      </View>
      <View
        className={`h-6 w-10 rounded-full ${
          enabled ? "bg-app-success" : "bg-app-surface-2"
        } justify-center px-0.5`}
      >
        <View
          className={`h-5 w-5 rounded-full bg-white ${
            enabled ? "self-end" : "self-start"
          }`}
        />
      </View>
    </Pressable>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: typeof Settings;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={icon} size={14} color="#83a7ff" />
      </View>
      <Text variant="label" tone="inverse" className="flex-1 text-[13px]">
        {label}
      </Text>
    </Pressable>
  );
}

const SAMPLE_CAMPAIGNS = [
  {
    id: "c-1",
    title: "Motor Yağı + Filtre",
    subtitle: "Orijinal yağ + işçilik dahil",
    priceLabel: "1.450 ₺'den",
  },
  {
    id: "c-2",
    title: "Balata & Disk Seti",
    subtitle: "Ön takım komple set",
    priceLabel: "3.200 ₺'den",
  },
  {
    id: "c-3",
    title: "OBD Teşhis",
    subtitle: "Tam sistem kontrol",
    priceLabel: "500 ₺",
  },
];

const SAMPLE_REVIEWS = [
  {
    id: "r-1",
    body:
      "Zamanlama kiti işimde adım adım fotoğraf paylaştılar. Faturası net, süresi sözündeydi.",
    author: "Mehmet A.",
  },
  {
    id: "r-2",
    body:
      "Elektrik arızasını hızlı tespit ettiler, gereksiz parça değişimine yönlendirmediler. Güvenli.",
    author: "Selin Y.",
  },
];

// Used to guard capability keys via types export
export type { CapabilityKey };
