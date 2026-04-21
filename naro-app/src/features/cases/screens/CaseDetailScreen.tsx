import type { ServiceCase } from "@naro/domain";
import type {
  CustomerTrackingView,
  TrackingStage,
  TrackingUtilityPreview,
} from "@naro/mobile-core";
import {
  Button,
  CASE_KIND_META,
  Icon,
  Screen,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowUpRight,
  CarFront,
  ChevronRight,
  Clock,
  FileImage,
  FileText,
  Hourglass,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Wrench,
} from "lucide-react-native";
import { useEffect } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useAppointmentCountdown,
  useApproveAppointmentMock,
  useCancelAppointment,
  useCaseDetail,
  useCustomerTrackingView,
  useDeclineAppointmentMock,
  useMarkCaseSeen,
} from "../api";

type StageTone = "accent" | "neutral" | "success" | "warning" | "critical" | "info";

function utilityIcon(kind: TrackingUtilityPreview["kind"]) {
  switch (kind) {
    case "offers":
      return Wrench;
    case "documents":
      return FileText;
    case "messages":
      return MessageSquare;
    case "service_profile":
      return ShieldCheck;
    case "approvals":
      return FileText;
    case "customer":
      return ShieldCheck;
  }
}

function utilityColor(kind: TrackingUtilityPreview["kind"]) {
  switch (kind) {
    case "offers":
      return "#83a7ff";
    case "documents":
      return "#8bd3a8";
    case "messages":
      return "#f5b33f";
    case "service_profile":
      return "#6ee7f9";
    case "approvals":
      return "#f6a6b2";
    case "customer":
      return "#83a7ff";
  }
}

function stageTone(state: TrackingStage["state"]): StageTone {
  switch (state) {
    case "completed_compact":
      return "success";
    case "active_expanded":
      return "accent";
    case "blocked":
      return "critical";
    case "waiting_counterparty":
      return "warning";
    case "upcoming_visible":
      return "info";
  }
}

function stageContainerClass(state: TrackingStage["state"]) {
  switch (state) {
    case "completed_compact":
      return "rounded-[24px] border border-app-outline bg-app-surface px-4 py-4";
    case "active_expanded":
      return "rounded-[30px] border border-app-outline-strong bg-app-surface-2 px-5 py-5";
    case "blocked":
      return "rounded-[28px] border border-app-critical/40 bg-app-surface px-4 py-4";
    case "waiting_counterparty":
      return "rounded-[28px] border border-app-warning/40 bg-app-surface px-4 py-4";
    case "upcoming_visible":
      return "rounded-[24px] border border-app-outline bg-app-surface px-4 py-4";
  }
}

function stageDotClass(state: TrackingStage["state"]) {
  switch (state) {
    case "completed_compact":
      return "bg-app-success";
    case "active_expanded":
      return "bg-brand-500";
    case "blocked":
      return "bg-app-critical";
    case "waiting_counterparty":
      return "bg-app-warning";
    case "upcoming_visible":
      return "bg-app-info";
  }
}

function EvidencePreview({
  stage,
}: {
  stage: TrackingStage;
}) {
  if (!stage.evidencePreview.length) {
    return null;
  }

  return (
    <View className="gap-2 pt-1">
      {stage.evidencePreview.map((item) => (
        <View key={item.id} className="flex-row items-start gap-3">
          <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-bg">
            <Icon icon={FileImage} size={16} color="#83a7ff" />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text variant="label" tone="inverse" className="flex-1">
                {item.title}
              </Text>
              {item.isNew ? <TrustBadge label="Yeni" tone="accent" /> : null}
            </View>
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              {item.subtitle}
            </Text>
            <Text variant="caption" tone="subtle">
              {item.meta}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function StageCard({
  stage,
  isLast,
  onPress,
}: {
  stage: TrackingStage;
  isLast: boolean;
  onPress?: () => void;
}) {
  const cardContent = (
    <View className={stageContainerClass(stage.state)}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <TrustBadge label={stage.statusLabel} tone={stageTone(stage.state)} />
            {stage.waitLabel ? (
              <TrustBadge label={stage.waitLabel} tone="warning" />
            ) : null}
            {stage.costImpact ? (
              <TrustBadge label={stage.costImpact} tone="success" />
            ) : null}
          </View>
          <Text
            variant={stage.state === "active_expanded" ? "h2" : "h3"}
            tone="inverse"
          >
            {stage.title}
          </Text>
        </View>
        <View className="items-end gap-2">
          {stage.isNew ? <TrustBadge label="Yeni" tone="accent" /> : null}
          <Text variant="caption" tone="subtle">
            {stage.timeLabel}
          </Text>
        </View>
      </View>

      <Text
        tone="muted"
        className={
          stage.state === "active_expanded"
            ? "text-app-text-muted"
            : "text-app-text-muted"
        }
      >
        {stage.subtitle}
      </Text>

      <EvidencePreview stage={stage} />
    </View>
  );

  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View
          className={`mt-2 h-3 w-3 rounded-full ${stageDotClass(stage.state)}`}
        />
        {!isLast ? (
          <View className="mt-2 w-px flex-1 bg-app-outline" />
        ) : null}
      </View>
      <View className="flex-1 pb-4">
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${stage.title} detayini ac`}
            onPress={onPress}
            className="active:opacity-90"
          >
            {cardContent}
          </Pressable>
        ) : (
          cardContent
        )}
      </View>
    </View>
  );
}

function UtilityCard({
  item,
  onPress,
}: {
  item: TrackingUtilityPreview;
  onPress?: () => void;
}) {
  const content = (
    <View className="w-[248px] gap-3 rounded-[26px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
          <Icon icon={utilityIcon(item.kind)} size={18} color={utilityColor(item.kind)} />
        </View>
        {item.badgeLabel ? (
          <TrustBadge label={item.badgeLabel} tone={item.badgeTone ?? "info"} />
        ) : null}
      </View>
      <View className="gap-1">
        <Text variant="label" tone="inverse">
          {item.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted">
          {item.subtitle}
        </Text>
      </View>
      {item.meta ? (
        <Text variant="caption" tone="subtle">
          {item.meta}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} detayini ac`}
      onPress={onPress}
      className="active:opacity-90"
    >
      {content}
    </Pressable>
  );
}

export function CaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useCaseDetail(id ?? "");
  const { data: trackingView } = useCustomerTrackingView(id ?? "");
  const markSeen = useMarkCaseSeen(id ?? "");
  const countdown = useAppointmentCountdown(id ?? "");
  const cancelAppointment = useCancelAppointment(id ?? "");
  const approveAppointmentMock = useApproveAppointmentMock(id ?? "");
  const declineAppointmentMock = useDeclineAppointmentMock(id ?? "");

  useEffect(() => {
    if (id) {
      void markSeen.mutateAsync();
    }
  }, [id, markSeen]);

  if (!caseItem || !trackingView) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Vaka bulunamadi
        </Text>
        <Button label="Geri don" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const primaryRoute = trackingView.primaryAction?.route;
  const isPendingAppointment = caseItem.status === "appointment_pending";
  const appointmentDeclined = caseItem.appointment?.status === "declined";
  const appointmentExpired = caseItem.appointment?.status === "expired";
  const isDev = typeof __DEV__ !== "undefined" && __DEV__;

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-32">
        <CaseHeaderCard
          caseItem={caseItem}
          trackingView={trackingView}
          onBack={() => router.back()}
          onOpenProfile={() =>
            router.push(`/(modal)/vaka-profili/${caseItem.id}` as Href)
          }
        />

        {isPendingAppointment ? (
          <View className="gap-3 rounded-[24px] border border-app-warning/40 bg-app-warning/10 px-4 py-4">
            <View className="flex-row items-center gap-2">
              <Icon icon={Hourglass} size={16} color="#f5b33f" />
              <Text variant="label" tone="warning" className="flex-1 text-[14px]">
                Usta yanıtı bekleniyor
              </Text>
              {countdown.label ? (
                <View className="flex-row items-center gap-1 rounded-full bg-app-warning/20 px-2.5 py-1">
                  <Icon icon={Clock} size={11} color="#f5b33f" />
                  <Text variant="caption" tone="warning" className="text-[11px]">
                    {countdown.label}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              Randevu talebin iletildi. Usta onaylayana kadar süreç başlamaz.
              İstersen bekleme süresince iptal edebilirsin.
            </Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Randevuyu iptal et"
                  variant="outline"
                  fullWidth
                  loading={cancelAppointment.isPending}
                  onPress={() => {
                    Alert.alert(
                      "Randevu talebini iptal et",
                      "Talep iptal edilecek, teklif tekrar havuza dönecek.",
                      [
                        { text: "Vazgeç", style: "cancel" },
                        {
                          text: "İptal et",
                          style: "destructive",
                          onPress: () => void cancelAppointment.mutateAsync(),
                        },
                      ],
                    );
                  }}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Servise yaz"
                  variant="outline"
                  fullWidth
                  onPress={() =>
                    router.push(`/vaka/${caseItem.id}/mesajlar` as Href)
                  }
                />
              </View>
            </View>
            {isDev ? (
              <View className="flex-row gap-2 border-t border-app-warning/30 pt-3">
                <Button
                  label="[dev] Onayla"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onPress={() => void approveAppointmentMock.mutateAsync()}
                />
                <Button
                  label="[dev] Reddet"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onPress={() => void declineAppointmentMock.mutateAsync()}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {appointmentDeclined ? (
          <View className="gap-2 rounded-[24px] border border-app-critical/40 bg-app-critical/10 px-4 py-4">
            <Text variant="label" tone="critical" className="text-[14px]">
              Usta randevuyu reddetti
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              {caseItem.appointment?.decline_reason ??
                "Usta şu an uygun değil — alternatiflere bakabilirsin."}
            </Text>
            <Button
              label="Alternatif ustaları aç"
              variant="outline"
              onPress={() => router.push("/(tabs)/carsi" as Href)}
            />
          </View>
        ) : null}

        {appointmentExpired ? (
          <View className="gap-2 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
            <Text variant="label" tone="inverse" className="text-[14px]">
              Randevu süresi doldu
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              Usta 24 saat içinde yanıt vermedi. Tekrar dene veya alternatif seç.
            </Text>
          </View>
        ) : null}

        <View
          className="overflow-hidden rounded-[28px] border bg-app-surface"
          style={{ borderColor: `${CASE_KIND_META[caseItem.kind].iconColor}3a` }}
        >
          <View
            className="gap-4 px-5 py-5"
            style={{
              backgroundColor: `${CASE_KIND_META[caseItem.kind].iconColor}14`,
            }}
          >
            <View className="flex-row items-center justify-between gap-3">
              <StatusChip
                label={trackingView.header.statusLabel}
                tone={trackingView.header.statusTone}
              />
              <Text variant="caption" tone="subtle">
                {trackingView.header.updatedAtLabel}
              </Text>
            </View>
            <View className="flex-row items-start gap-4">
              <View
                className="h-14 w-14 items-center justify-center rounded-[18px]"
                style={{
                  backgroundColor: `${CASE_KIND_META[caseItem.kind].iconColor}26`,
                }}
              >
                <Icon
                  icon={CASE_KIND_META[caseItem.kind].icon}
                  size={26}
                  color={CASE_KIND_META[caseItem.kind].iconColor}
                  strokeWidth={2.2}
                />
              </View>
              <View className="flex-1 gap-2">
                <Text
                  variant="display"
                  tone="inverse"
                  className="text-[24px] leading-[28px]"
                  numberOfLines={2}
                >
                  {trackingView.header.summaryTitle}
                </Text>
                <Text
                  tone="muted"
                  className="text-app-text-muted text-[13px] leading-[19px]"
                >
                  {trackingView.header.summaryDescription}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <TrustBadge label={trackingView.header.waitLabel} tone="warning" />
              <TrustBadge
                label={`Sıradaki: ${trackingView.header.nextLabel}`}
                tone="info"
              />
              {trackingView.header.totalLabel ? (
                <TrustBadge label={trackingView.header.totalLabel} tone="success" />
              ) : null}
              {trackingView.header.estimateLabel ? (
                <TrustBadge
                  label={trackingView.header.estimateLabel}
                  tone="accent"
                />
              ) : null}
            </View>
          </View>
        </View>

        <View className="gap-1">
          <Text variant="eyebrow" tone="subtle">
            Süreç Takibi
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Geride ne olduğunu, şu an hangi aşamada olduğunu ve sonraki eşiği tek dikey akışta oku.
          </Text>
        </View>

        <View>
          {trackingView.stages.map((stage, index) => (
            <StageCard
              key={stage.id}
              stage={stage}
              isLast={index === trackingView.stages.length - 1}
              onPress={
                stage.drilldownRoute
                  ? () => router.push(stage.drilldownRoute as Href)
                  : undefined
              }
            />
          ))}
        </View>

        <View className="gap-3">
          <Text variant="h3" tone="inverse">
            Detay kisa yollari
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {trackingView.utilityPreviews.map((item) => (
              <UtilityCard
                key={item.id}
                item={item}
                onPress={
                  item.route ? () => router.push(item.route as Href) : undefined
                }
              />
            ))}
          </ScrollView>
        </View>
      </Screen>

      {primaryRoute ? (
        <View className="gap-3 border-t border-app-outline bg-app-bg px-6 pb-5 pt-4">
          <Text tone="subtle">
            {`${trackingView.header.waitLabel} · ${trackingView.header.nextLabel}`}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ustayla mesajlaş"
              onPress={() => router.push(`/vaka/${caseItem.id}/mesajlar` as Href)}
              className="h-12 w-12 items-center justify-center rounded-[14px] border border-app-outline bg-app-surface active:bg-app-surface-2"
            >
              <Icon icon={MessageCircle} size={18} color="#83a7ff" />
            </Pressable>
            <View className="flex-1">
              <Button
                label={trackingView.primaryAction?.label ?? "Detayi ac"}
                fullWidth
                onPress={() => router.push(primaryRoute as Href)}
              />
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

type CaseHeaderCardProps = {
  caseItem: ServiceCase;
  trackingView: CustomerTrackingView;
  onBack: () => void;
  onOpenProfile: () => void;
};

function CaseHeaderCard({
  caseItem,
  trackingView,
  onBack,
  onOpenProfile,
}: CaseHeaderCardProps) {
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const { header } = trackingView;
  const vehicleMeta = header.subtitle?.includes("·")
    ? header.subtitle
    : null;

  return (
    <View className="overflow-hidden rounded-[24px] border border-app-outline-strong bg-app-surface-2">
      {/* Üst satır: geri + "Vakam" + status chip */}
      <View className="flex-row items-center gap-3 px-4 pt-3 pb-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={onBack}
          className="h-9 w-9 items-center justify-center rounded-full bg-app-surface active:bg-app-surface-3"
        >
          <Icon icon={ArrowLeft} size={16} color="#f5f7ff" />
        </Pressable>
        <Text
          variant="eyebrow"
          tone="subtle"
          className="flex-1 text-[10px]"
        >
          Vakam
        </Text>
        <StatusChip
          label={header.statusLabel}
          tone={header.statusTone}
        />
      </View>

      {/* Ana kart — tap profil modalı açar */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vaka profilini aç"
        onPress={onOpenProfile}
        className="gap-3 px-4 pb-4 pt-2 active:opacity-90"
      >
        <View className="flex-row items-start gap-3">
          <View
            className={`h-11 w-11 items-center justify-center rounded-[14px] ${kindMeta.softBg}`}
          >
            <Icon
              icon={kindMeta.icon}
              size={20}
              color={kindMeta.iconColor}
            />
          </View>
          <View className="flex-1 gap-1">
            <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
            <Text
              variant="h3"
              tone="inverse"
              className="text-[17px] leading-[22px]"
              numberOfLines={2}
            >
              {header.title}
            </Text>
          </View>
          <Icon icon={ChevronRight} size={14} color="#83a7ff" />
        </View>

        {vehicleMeta ? (
          <View className="flex-row items-center gap-2 self-start rounded-full border border-app-outline bg-app-surface px-3 py-1.5">
            <Icon icon={CarFront} size={12} color="#83a7ff" />
            <Text
              variant="caption"
              tone="inverse"
              className="text-[11px]"
              numberOfLines={1}
            >
              {vehicleMeta}
            </Text>
          </View>
        ) : null}

        {/* Şu an + Sıradaki */}
        <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
          <View className="flex-row items-center gap-2">
            <Icon icon={Hourglass} size={11} color="#83a7ff" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[10px]"
            >
              Şu an
            </Text>
            <Text
              variant="label"
              tone="inverse"
              className="flex-1 text-right text-[12px]"
              numberOfLines={1}
            >
              {header.waitLabel}
            </Text>
          </View>
          {header.nextLabel ? (
            <View className="flex-row items-center gap-2">
              <Icon icon={ArrowUpRight} size={11} color="#83a7ff" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-subtle text-[10px]"
              >
                Sıradaki
              </Text>
              <Text
                variant="label"
                tone="accent"
                className="flex-1 text-right text-[12px]"
                numberOfLines={1}
              >
                {header.nextLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[10px]"
        >
          Güncellendi · {header.updatedAtLabel}
        </Text>
      </Pressable>
    </View>
  );
}
