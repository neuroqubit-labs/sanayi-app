import type { ServiceCase } from "@naro/domain";
import type { buildTechnicianTrackingView } from "@naro/mobile-core";
import { Icon, StatusChip, Text, TrustBadge } from "@naro/ui";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Image, Pressable, View } from "react-native";

type TrackingView = ReturnType<typeof buildTechnicianTrackingView>;

type Props = {
  caseItem: ServiceCase;
  view: TrackingView;
  onPress: () => void;
};

const KIND_ICON: Record<string, LucideIcon> = {
  accident: AlertTriangle,
  towing: Truck,
  breakdown: Wrench,
  maintenance: Car,
};

const KIND_COLOR: Record<string, string> = {
  accident: "#ff7e7e",
  towing: "#0ea5e9",
  breakdown: "#f5b33f",
  maintenance: "#2dd28d",
};

export function JobRecordCard({ caseItem, view, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${view.header.summaryTitle} detayını aç`}
      onPress={onPress}
      className="flex-row gap-3 rounded-[22px] border border-app-outline bg-app-surface p-3 active:bg-app-surface-2"
    >
      <VisualSlot caseItem={caseItem} />

      <View className="flex-1 gap-2">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <StatusChip
            label={view.header.statusLabel}
            tone={view.header.statusTone}
          />
          <TrustBadge
            label={view.header.waitLabel}
            tone={
              view.waitState.actor === "technician"
                ? "accent"
                : view.waitState.actor === "customer"
                  ? "warning"
                  : "info"
            }
          />
        </View>

        <Text
          variant="label"
          tone="inverse"
          className="text-[14px] leading-[18px]"
          numberOfLines={1}
        >
          {view.header.summaryTitle}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
          numberOfLines={1}
        >
          {view.customerName} · {view.header.subtitle}
        </Text>

        <View className="gap-1">
          <View className="h-1.5 rounded-full bg-app-surface-2">
            <View
              className="h-1.5 rounded-full bg-brand-500"
              style={{ width: `${Math.max(4, view.progressValue)}%` }}
            />
          </View>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[10px]"
            numberOfLines={1}
          >
            {view.header.nextLabel}
          </Text>
        </View>

        {view.primaryAction ? (
          <View className="flex-row items-center gap-1.5">
            <Text
              variant="caption"
              tone="accent"
              className="flex-1 text-[11px]"
              numberOfLines={1}
            >
              Sıradaki: {view.primaryAction.label}
            </Text>
            <ArrowRight size={11} color="#d94a1f" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Sol 96×96 görsel slot — öncelik:
 * 1. Hasar kolajı (accident + 2+ foto)
 * 2. Tek hasar fotoğrafı (accident + 1 foto)
 * 3. Araç ana fotoğrafı
 * 4. Kind ikon + renk (fallback)
 */
function VisualSlot({ caseItem }: { caseItem: ServiceCase }) {
  const photos = caseItem.attachments
    .filter((a) => a.kind === "photo")
    .map((a) => a.asset?.preview_url ?? a.asset?.download_url ?? null)
    .filter((uri): uri is string => Boolean(uri))
    .slice(0, 4);

  const Icn = KIND_ICON[caseItem.kind] ?? Wrench;
  const color = KIND_COLOR[caseItem.kind] ?? "#83a7ff";

  if (caseItem.kind === "accident" && photos.length >= 2) {
    return (
      <View
        className="h-24 w-24 overflow-hidden rounded-[16px] border"
        style={{ borderColor: `${color}33` }}
      >
        <View className="flex-row h-12">
          <PhotoTile uri={photos[0]!} />
          <PhotoTile uri={photos[1]!} />
        </View>
        <View className="flex-row h-12">
          {photos[2] ? (
            <PhotoTile uri={photos[2]} />
          ) : (
            <FillerTile color={color} />
          )}
          {photos[3] ? (
            <PhotoTile uri={photos[3]} />
          ) : (
            <FillerTile color={color} icon={Icn} />
          )}
        </View>
      </View>
    );
  }

  if (photos.length >= 1) {
    return (
      <View
        className="h-24 w-24 overflow-hidden rounded-[16px] border"
        style={{ borderColor: `${color}33` }}
      >
        <Image
          source={{ uri: photos[0]! }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      className="h-24 w-24 items-center justify-center rounded-[16px] border"
      style={{
        backgroundColor: `${color}14`,
        borderColor: `${color}33`,
      }}
    >
      <Icon icon={Icn} size={36} color={color} strokeWidth={1.8} />
    </View>
  );
}

function PhotoTile({ uri }: { uri: string }) {
  return (
    <View className="flex-1 overflow-hidden">
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
    </View>
  );
}

function FillerTile({
  color,
  icon,
}: {
  color: string;
  icon?: LucideIcon;
}) {
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: `${color}1f` }}
    >
      {icon ? <Icon icon={icon} size={16} color={color} /> : null}
    </View>
  );
}
