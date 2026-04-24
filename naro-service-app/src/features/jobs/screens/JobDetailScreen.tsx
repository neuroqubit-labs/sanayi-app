import type {
  TrackingStage,
  TrackingUtilityPreview,
} from "@naro/mobile-core";
import {
  BackButton,
  Button,
  Icon,
  PremiumListRow,
  Screen,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  ClipboardList,
  FileImage,
  FileText,
  MessageSquare,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useJobDetail,
  useMarkJobSeen,
  useTechnicianTrackingJob,
} from "../api.case-live";
import { CustomerPreviewCard } from "../components/CustomerPreviewCard";

type StageTone = "accent" | "neutral" | "success" | "warning" | "critical" | "info";

function utilityIcon(kind: TrackingUtilityPreview["kind"]) {
  switch (kind) {
    case "documents":
      return FileText;
    case "approvals":
      return ShieldCheck;
    case "customer":
      return User;
    case "messages":
      return MessageSquare;
    case "offers":
      return Wrench;
    case "service_profile":
      return ShieldCheck;
  }
}

function utilityColor(kind: TrackingUtilityPreview["kind"]) {
  switch (kind) {
    case "documents":
      return "#8bd3a8";
    case "approvals":
      return "#f5b33f";
    case "customer":
      return "#83a7ff";
    case "messages":
      return "#f6a6b2";
    case "offers":
      return "#83a7ff";
    case "service_profile":
      return "#6ee7f9";
  }
}

function utilityRoute(
  kind: TrackingUtilityPreview["kind"],
  caseId: string,
): string | null {
  switch (kind) {
    case "messages":
      return `/is/${caseId}/mesajlar`;
    case "documents":
      return `/is/${caseId}/belgeler`;
    case "offers":
      return `/is/${caseId}/teklifim`;
    default:
      return null;
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

function UtilityCard({
  item,
  onPress,
}: {
  item: TrackingUtilityPreview;
  onPress?: () => void;
}) {
  const content = (
    <View className="w-[220px] gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
          <Icon icon={utilityIcon(item.kind)} size={16} color={utilityColor(item.kind)} />
        </View>
        {item.badgeLabel ? (
          <TrustBadge label={item.badgeLabel} tone={item.badgeTone ?? "info"} />
        ) : null}
      </View>
      <View className="gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {item.title}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
          {item.subtitle}
        </Text>
      </View>
      {item.meta ? (
        <Text variant="caption" tone="subtle" className="text-[10px]">
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
      accessibilityLabel={`${item.title} aç`}
      onPress={onPress}
      className="active:opacity-90"
    >
      {content}
    </Pressable>
  );
}

function EvidencePreview({ stage }: { stage: TrackingStage }) {
  if (!stage.evidencePreview.length) return null;
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

function CommandStrip({
  commands,
  onPress,
}: {
  commands: {
    id: string;
    title: string;
    description: string;
    route: string;
    urgency: "background" | "soon" | "now";
  }[];
  onPress: (route: string) => void;
}) {
  if (!commands.length) return null;
  return (
    <View className="gap-3 pt-2">
      <Text variant="eyebrow" tone="subtle">
        Mikro görevler
      </Text>
      <View className="gap-2">
        {commands.map((task) => (
          <PremiumListRow
            key={task.id}
            title={task.title}
            subtitle={task.description}
            onPress={() => onPress(task.route)}
            badge={
              <TrustBadge
                label={task.urgency === "now" ? "Şimdi" : "Sıradaki"}
                tone={task.urgency === "now" ? "accent" : "info"}
              />
            }
          />
        ))}
      </View>
    </View>
  );
}

function RequirementsCard({
  title,
  items,
}: {
  title: string;
  items: {
    id: string;
    title: string;
    hint?: string;
    required: boolean;
  }[];
}) {
  if (!items.length) return null;
  return (
    <View className="gap-3 pt-2">
      <Text variant="eyebrow" tone="subtle">
        {title}
      </Text>
      <View className="gap-2">
        {items.map((item) => (
          <PremiumListRow
            key={item.id}
            title={item.title}
            subtitle={item.hint}
            trailing={
              <TrustBadge
                label={item.required ? "Zorunlu" : "Opsiyonel"}
                tone={item.required ? "warning" : "info"}
              />
            }
          />
        ))}
      </View>
    </View>
  );
}

function StageCard({
  stage,
  isLast,
  onPress,
  extra,
}: {
  stage: TrackingStage;
  isLast: boolean;
  onPress?: () => void;
  extra?: React.ReactNode;
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

      <Text tone="muted" className="text-app-text-muted">
        {stage.subtitle}
      </Text>

      <EvidencePreview stage={stage} />
      {extra}
    </View>
  );

  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className={`mt-2 h-3 w-3 rounded-full ${stageDotClass(stage.state)}`} />
        {!isLast ? <View className="mt-2 w-px flex-1 bg-app-outline" /> : null}
      </View>
      <View className="flex-1 pb-4">
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${stage.title} detayını aç`}
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

export function JobDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useJobDetail(id ?? "");
  const { data: view } = useTechnicianTrackingJob(id ?? "");
  const markSeen = useMarkJobSeen(id ?? "");

  useEffect(() => {
    if (id) {
      void markSeen.mutateAsync();
    }
  }, [id, markSeen]);

  if (!caseItem || !view) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          İş bulunamadı
        </Text>
        <Button label="Geri dön" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const checklist =
    view.primaryTask?.kind.includes("upload")
      ? caseItem.tasks.find((task) => task.id === view.primaryTask?.id)
          ?.evidence_requirements ?? []
      : [];

  const primaryActionLabel = view.primaryAction?.label ?? "";
  const primaryActionRoute = view.primaryAction?.route;

  const unreadMessages = caseItem.thread.unread_count ?? 0;
  const progressValue = view.progressValue ?? 0;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-36">
      {/* Top bar */}
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            {view.header.eyebrow}
          </Text>
          <Text variant="h2" tone="inverse" numberOfLines={1}>
            {view.header.title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vaka profilini aç"
          onPress={() => router.push(`/vaka/${caseItem.id}` as Href)}
          className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface active:bg-app-surface-2"
        >
          <Icon icon={ClipboardList} size={16} color="#f5f7ff" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mesajları aç"
          onPress={() => router.push(`/is/${caseItem.id}/mesajlar` as Href)}
          className="relative h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface active:bg-app-surface-2"
        >
          <Icon icon={MessageSquare} size={16} color="#f5f7ff" />
          {unreadMessages > 0 ? (
            <View className="absolute right-1 top-1 h-4 min-w-[16px] items-center justify-center rounded-full bg-app-critical px-1">
              <Text
                variant="caption"
                tone="inverse"
                className="text-[9px] font-semibold"
              >
                {unreadMessages}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Müşteri Preview */}
      <CustomerPreviewCard
        caseItem={caseItem}
        customerName={view.header.title}
        previousCaseCount={0}
      />

      {/* Özet + Progress */}
      <View className="gap-4 rounded-[28px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
        <View className="flex-row items-center justify-between gap-3">
          <StatusChip label={view.header.statusLabel} tone={view.header.statusTone} />
          <Text variant="caption" tone="subtle">
            {view.header.updatedAtLabel}
          </Text>
        </View>
        <View className="gap-2">
          <Text variant="display" tone="inverse" className="text-[24px] leading-[28px]">
            {view.header.summaryTitle}
          </Text>
          <Text tone="muted" className="text-app-text-muted">
            {view.header.summaryDescription}
          </Text>
        </View>
        <View className="gap-1.5">
          <View className="h-2 rounded-full bg-app-surface">
            <View
              className="h-2 rounded-full bg-brand-500"
              style={{ width: `${Math.max(4, progressValue)}%` }}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <Text variant="caption" tone="accent" className="text-[11px]">
              %{progressValue} tamamlandı
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              {view.header.nextLabel}
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <TrustBadge label={view.header.waitLabel} tone="warning" />
          {view.header.totalLabel ? (
            <TrustBadge label={view.header.totalLabel} tone="success" />
          ) : null}
        </View>
      </View>

      {/* Süreç omurgası */}
      <View className="gap-1">
        <Text variant="h3" tone="inverse" className="text-[15px]">
          İş omurgası
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px]"
        >
          Aktif pencere + yaklaşan adımlar. Mikro görev tap et → mikro ekran.
        </Text>
      </View>

      <View>
        {view.stages.map((stage, index) => {
          const isActiveStage = stage.state === "active_expanded";
          return (
            <StageCard
              key={stage.id}
              stage={stage}
              isLast={index === view.stages.length - 1}
              onPress={
                stage.drilldownRoute
                  ? () => router.push(stage.drilldownRoute as Href)
                  : undefined
              }
              extra={
                isActiveStage ? (
                  <>
                    <RequirementsCard
                      title="Gerekli görseller"
                      items={checklist}
                    />
                    <CommandStrip
                      commands={view.commandStrip}
                      onPress={(route) => router.push(route as Href)}
                    />
                  </>
                ) : undefined
              }
            />
          );
        })}
      </View>

      {/* Utility kısayolları */}
      <View className="gap-3">
        <Text variant="h3" tone="inverse" className="text-[15px]">
          Operasyon kısayolları
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {view.utilityPreviews.map((item) => {
            const route = utilityRoute(item.kind, caseItem.id);
            return (
              <UtilityCard
                key={item.id}
                item={item}
                onPress={route ? () => router.push(route as Href) : undefined}
              />
            );
          })}
          {caseItem.origin === "technician" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(`/is/${caseItem.id}/sigorta` as Href)
              }
              className="w-[220px] gap-3 rounded-[22px] border border-brand-500/30 bg-brand-500/10 px-4 py-4 active:opacity-90"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
                  <Icon icon={ShieldCheck} size={16} color="#0ea5e9" />
                </View>
                <TrustBadge
                  label={caseItem.insurance_claim?.status ?? "drafted"}
                  tone="info"
                />
              </View>
              <View className="gap-0.5">
                <Text variant="label" tone="inverse" className="text-[13px]">
                  Sigorta Dosyası
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[11px]"
                  numberOfLines={1}
                >
                  {caseItem.insurance_claim?.insurer ?? "Sigorta"}
                </Text>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {/* Sticky bottom next-action */}
      {primaryActionLabel && primaryActionRoute ? (
        <View
          className="absolute inset-x-0 bottom-0 border-t border-app-outline bg-app-bg px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="gap-1.5">
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              Sıradaki adım
            </Text>
            <Button
              label={primaryActionLabel}
              size="lg"
              fullWidth
              onPress={() => router.push(primaryActionRoute as Href)}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
