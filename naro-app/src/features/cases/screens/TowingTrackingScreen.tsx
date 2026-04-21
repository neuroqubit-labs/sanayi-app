import {
  Avatar,
  BackButton,
  Button,
  Icon,
  Screen,
  StatusChip,
  Text,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Check,
  CheckCircle2,
  Circle,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { Alert, Linking, Platform, Pressable, ScrollView, View } from "react-native";

import { useCaseDetail } from "../api";

type DispatchStage = {
  id: string;
  title: string;
  meta: string;
  status: "done" | "active" | "pending";
};

const MOCK_OPERATOR = {
  name: "Nihat Yılmaz",
  vehicle: "Ford Transit çekici",
  plate: "34 FGH 91",
  rating: 4.8,
  reviews: 214,
  phone: "+905551234567",
};

const MOCK_ETA_MIN = 18;

function buildDispatchStages(): DispatchStage[] {
  return [
    {
      id: "received",
      title: "Talep alındı",
      meta: "Az önce",
      status: "done",
    },
    {
      id: "assigned",
      title: "Operatör atandı",
      meta: `${MOCK_OPERATOR.name} · ${MOCK_OPERATOR.vehicle}`,
      status: "done",
    },
    {
      id: "on_way",
      title: "Yola çıktı",
      meta: `Tahmini varış ${MOCK_ETA_MIN} dk`,
      status: "active",
    },
    {
      id: "arrived",
      title: "Aracının yanında",
      meta: "Henüz ulaşmadı",
      status: "pending",
    },
    {
      id: "delivered",
      title: "Servise ulaştırıldı",
      meta: "Bekleniyor",
      status: "pending",
    },
  ];
}

function dialNumber(number: string) {
  const url = Platform.OS === "ios" ? `telprompt:${number}` : `tel:${number}`;
  Linking.openURL(url).catch(() => {
    Alert.alert(
      "Arama başlatılamadı",
      "Lütfen numarayı manuel olarak ara: " + number,
    );
  });
}

export function TowingTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useCaseDetail(id ?? "");

  const stages = buildDispatchStages();

  const handleCancel = () => {
    Alert.alert(
      "Çekici talebini iptal et",
      "Operatör yolda. İptal etmek üzeresin, emin misin?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal et",
          style: "destructive",
          onPress: () => router.replace("/(tabs)"),
        },
      ],
    );
  };

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <View className="flex-1 gap-0.5">
            <Text variant="eyebrow" tone="subtle">
              Çekici çağrısı
            </Text>
            <Text variant="h2" tone="inverse">
              Operatör yolda
            </Text>
          </View>
          <StatusChip
            label={`${MOCK_ETA_MIN} dk`}
            tone="accent"
            icon={Truck}
          />
        </View>

        <View className="mt-4 px-5">
          <MapHero />
        </View>

        <View className="mt-4 gap-4 px-5">
          <OperatorCard
            name={MOCK_OPERATOR.name}
            vehicle={MOCK_OPERATOR.vehicle}
            plate={MOCK_OPERATOR.plate}
            rating={MOCK_OPERATOR.rating}
            reviews={MOCK_OPERATOR.reviews}
            onCall={() => dialNumber(MOCK_OPERATOR.phone)}
          />

          <TrustStrip />

          <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text variant="eyebrow" tone="subtle">
                Çekici süreci
              </Text>
              <Text variant="caption" tone="muted" className="text-app-text-muted">
                Canlı
              </Text>
            </View>
            <View className="gap-3">
              {stages.map((stage, index) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  isLast={index === stages.length - 1}
                />
              ))}
            </View>
          </View>

          {caseItem?.request ? (
            <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
              <Text variant="eyebrow" tone="subtle">
                Talep özetin
              </Text>
              <SummaryLine
                icon={MapPin}
                iconColor="#2dd28d"
                label="Alınacak"
                value={caseItem.request.location_label || "—"}
              />
              {caseItem.request.dropoff_label ? (
                <SummaryLine
                  icon={MapPin}
                  iconColor="#ff6b6b"
                  label="Varış"
                  value={caseItem.request.dropoff_label}
                />
              ) : null}
              {caseItem.request.notes ? (
                <Text variant="caption" tone="muted" className="text-app-text-muted mt-1">
                  {caseItem.request.notes}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
        <Button
          label="Operatörü Ara"
          size="lg"
          fullWidth
          leftIcon={<Icon icon={Phone} size={18} color="#ffffff" />}
          onPress={() => dialNumber(MOCK_OPERATOR.phone)}
        />
        <Pressable
          accessibilityRole="button"
          onPress={handleCancel}
          className="flex-row items-center justify-center gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
        >
          <Icon icon={X} size={14} color="#ff6b6b" />
          <Text variant="label" tone="critical">
            Talebi iptal et
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function MapHero() {
  return (
    <View className="relative h-52 overflow-hidden rounded-[24px] border border-app-outline bg-app-surface-2">
      <View className="absolute inset-0 opacity-30">
        <View className="absolute left-0 right-0 top-[20%] h-px bg-app-outline" />
        <View className="absolute left-0 right-0 top-[40%] h-px bg-app-outline" />
        <View className="absolute left-0 right-0 top-[60%] h-px bg-app-outline" />
        <View className="absolute left-0 right-0 top-[80%] h-px bg-app-outline" />
        <View className="absolute bottom-0 top-0 left-[25%] w-px bg-app-outline" />
        <View className="absolute bottom-0 top-0 left-[50%] w-px bg-app-outline" />
        <View className="absolute bottom-0 top-0 left-[75%] w-px bg-app-outline" />
      </View>

      {/* Çekicinin yolu — kesikli çizgi */}
      <View className="absolute left-[18%] right-[28%] top-[50%] h-0.5 flex-row gap-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} className="h-0.5 flex-1 bg-brand-500/50" />
        ))}
      </View>

      {/* Çekici konumu */}
      <View className="absolute left-[15%] top-[45%] h-11 w-11 -translate-x-5 -translate-y-5 items-center justify-center rounded-full border-2 border-brand-500/40 bg-brand-500/20">
        <Icon icon={Truck} size={18} color="#0ea5e9" />
      </View>

      {/* Kullanıcı konumu */}
      <View className="absolute right-[20%] top-[45%] h-10 w-10 -translate-x-5 -translate-y-5 items-center justify-center rounded-full border-2 border-app-success/40 bg-app-success/20">
        <Icon icon={MapPin} size={16} color="#2dd28d" />
      </View>

      <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between gap-2 rounded-full border border-app-outline bg-app-surface/80 px-3 py-1.5">
        <View className="flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-app-success" />
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Canlı konum yakında
          </Text>
        </View>
        <Text variant="caption" tone="accent">
          ~2.4 km uzakta
        </Text>
      </View>
    </View>
  );
}

type OperatorCardProps = {
  name: string;
  vehicle: string;
  plate: string;
  rating: number;
  reviews: number;
  onCall: () => void;
};

function OperatorCard({
  name,
  vehicle,
  plate,
  rating,
  reviews,
  onCall,
}: OperatorCardProps) {
  return (
    <View className="flex-row items-center gap-4 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <Avatar name={name} size="lg" />
      <View className="flex-1 gap-1">
        <Text variant="h3" tone="inverse">
          {name}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {vehicle} · {plate}
        </Text>
        <View className="flex-row items-center gap-1">
          <Icon icon={Star} size={12} color="#f5b33f" strokeWidth={2.5} />
          <Text variant="caption" tone="warning">
            {rating.toFixed(1)}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-subtle">
            · {reviews} yolcu
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Operatörü ara"
        onPress={onCall}
        className="h-12 w-12 items-center justify-center rounded-full bg-brand-500 active:bg-brand-600"
      >
        <Icon icon={Phone} size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}

function TrustStrip() {
  const items: { icon: LucideIcon; label: string }[] = [
    { icon: ShieldCheck, label: "Sigortalı operatör" },
    { icon: CheckCircle2, label: "Uygulama üstünden ödeme" },
  ];
  return (
    <View className="flex-row gap-2">
      {items.map((item) => (
        <View
          key={item.label}
          className="flex-1 flex-row items-center gap-2 rounded-[16px] border border-app-success/30 bg-app-success-soft px-3 py-2.5"
        >
          <Icon icon={item.icon} size={14} color="#2dd28d" />
          <Text variant="caption" tone="success" className="flex-1 text-[12px]">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type StageRowProps = {
  stage: DispatchStage;
  isLast: boolean;
};

function StageRow({ stage, isLast }: StageRowProps) {
  const iconColor =
    stage.status === "done"
      ? "#2dd28d"
      : stage.status === "active"
        ? "#0ea5e9"
        : "#6f7b97";
  const titleTone: "inverse" | "accent" | "subtle" =
    stage.status === "pending" ? "subtle" : stage.status === "active" ? "accent" : "inverse";

  return (
    <View className="flex-row items-start gap-3">
      <View className="items-center">
        <View
          className={[
            "h-7 w-7 items-center justify-center rounded-full",
            stage.status === "done"
              ? "bg-app-success/20"
              : stage.status === "active"
                ? "bg-brand-500/20"
                : "bg-app-surface-2",
          ].join(" ")}
        >
          {stage.status === "done" ? (
            <Icon icon={Check} size={12} color={iconColor} />
          ) : stage.status === "active" ? (
            <Icon icon={Truck} size={12} color={iconColor} />
          ) : (
            <Icon icon={Circle} size={10} color={iconColor} />
          )}
        </View>
        {isLast ? null : (
          <View className="mt-1 h-6 w-px bg-app-outline" />
        )}
      </View>
      <View className="flex-1 gap-0.5 pb-1">
        <Text variant="label" tone={titleTone}>
          {stage.title}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {stage.meta}
        </Text>
      </View>
    </View>
  );
}

type SummaryLineProps = {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: string;
};

function SummaryLine({ icon, iconColor, label, value }: SummaryLineProps) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon icon={icon} size={14} color={iconColor} />
      <Text variant="caption" tone="muted" className="text-app-text-subtle">
        {label}:
      </Text>
      <Text variant="caption" tone="inverse" className="flex-1">
        {value}
      </Text>
    </View>
  );
}
