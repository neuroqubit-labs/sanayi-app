import {
  BackButton,
  Button,
  Icon,
  Screen,
  StaticMapPreview,
  StatusChip,
  Text,
} from "@naro/ui";
import { useRouter } from "expo-router";
import { MapPin, MapPinned, Truck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { telemetry } from "@/runtime";

import { usePendingTowDispatch, useRespondDispatch } from "../api";

export function TowDispatchSheet() {
  const router = useRouter();
  const pendingDispatch = usePendingTowDispatch(true);
  const incoming = pendingDispatch.data;
  const respond = useRespondDispatch(incoming?.case_id ?? "");

  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!incoming) return;
    const tick = () => {
      const next = Math.max(
        0,
        Math.ceil(
          (new Date(incoming.expires_at).getTime() - Date.now()) / 1000,
        ),
      );
      setSecondsLeft(next);
      if (next <= 0) {
        router.back();
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [incoming, router]);

  if (!incoming) {
    return (
      <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <Text variant="h3" tone="inverse">
            Dispatch yok
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Text variant="caption" tone="muted" className="text-center">
            Şu an aktif dispatch çağrısı yok.
          </Text>
        </View>
      </Screen>
    );
  }

  const handleAccept = async () => {
    if (!incoming) return;
    try {
      await respond.mutateAsync({
        attempt_id: incoming.attempt_id,
        response: "accepted",
      });
      router.replace(`/cekici/${incoming.case_id}`);
    } catch (error) {
      // 409/404 dispatch attempt expire ya da race; kullanıcıyı bilgilendir,
      // sheet açık kalır (timeout cleanup devam eder).
      telemetry.captureError(error, { context: "tow dispatch accept failed" });
      Alert.alert(
        "Görev alınamadı",
        "Görev başka bir operatöre düşmüş ya da süresi dolmuş olabilir. Yeni bir çağrı geldiğinde bildireceğiz.",
      );
    }
  };

  const handleDecline = async () => {
    if (incoming) {
      try {
        await respond.mutateAsync({
          attempt_id: incoming.attempt_id,
          response: "declined",
        });
      } catch (error) {
        // Backend decline kayıt edemese bile local cleanup devam eder; yine
        // de Sentry'e düşür ki dispatch reliability metrikleri tutarlı olsun.
        telemetry.captureError(error, { context: "tow dispatch decline failed" });
      }
    }
    router.back();
  };

  const techLocation = incoming.technician_lat_lng;

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <View className="flex-row items-center gap-3 px-5 pt-3">
        <BackButton onPress={handleDecline} variant="close" />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="accent">
            Yeni dispatch
          </Text>
          <Text variant="h2" tone="inverse">
            Çekici çağrısı geldi
          </Text>
        </View>
        <StatusChip label={`${secondsLeft} sn`} tone="warning" />
      </View>

      <View className="mt-4 gap-4 px-5">
        <StaticMapPreview
          height={160}
          pins={[
            { coord: incoming.pickup_lat_lng, kind: "pickup", label: "Alım" },
            ...(techLocation
              ? [{ coord: techLocation, kind: "self" as const, label: "Sen" }]
              : []),
          ]}
          routeCoords={
            techLocation ? [techLocation, incoming.pickup_lat_lng] : undefined
          }
          bottomCaption={
            <Text
              variant="caption"
              tone="muted"
              className="text-[11px] text-app-text-muted"
            >
              {incoming.distance_km.toFixed(1)} km · ETA {incoming.eta_minutes} dk
            </Text>
          }
        />

        <View className="gap-2 rounded-[22px] border border-brand-500/40 bg-brand-500/10 px-4 py-4">
          <View className="flex-row items-center gap-2">
            <Icon icon={Truck} size={14} color="#0ea5e9" />
            <Text variant="eyebrow" tone="accent">
              Müşteri
            </Text>
          </View>
          <Text variant="h3" tone="inverse">
            {incoming.customer_name}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {incoming.equipment_label} · {incoming.distance_km.toFixed(1)} km
          </Text>
        </View>

        <View className="gap-2.5 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
          <View className="flex-row items-center gap-2.5">
            <Icon icon={MapPin} size={14} color="#2dd28d" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle"
            >
              Alınacak:
            </Text>
            <Text variant="caption" tone="inverse" className="flex-1">
              {incoming.pickup_label}
            </Text>
          </View>
          {incoming.dropoff_label ? (
            <View className="flex-row items-center gap-2.5">
              <Icon icon={MapPinned} size={14} color="#ff7e7e" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-subtle"
              >
                Varış:
              </Text>
              <Text variant="caption" tone="inverse" className="flex-1">
                {incoming.dropoff_label}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-2 rounded-[22px] border border-app-success/30 bg-app-success-soft px-4 py-4">
          <Text variant="eyebrow" tone="success">
            Kazanç
          </Text>
          <Text variant="h2" tone="success">
            ₺{incoming.price_amount.toLocaleString("tr-TR")}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Tahmini varış {incoming.eta_minutes} dk · mesafeye göre final
            hesaplanır.
          </Text>
        </View>
      </View>

      <View className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
        <Button
          label={`Kabul Et · ${secondsLeft} sn`}
          size="lg"
          fullWidth
          onPress={handleAccept}
        />
        <Pressable
          accessibilityRole="button"
          onPress={handleDecline}
          className="flex-row items-center justify-center gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
        >
          <Text variant="label" tone="critical">
            Reddet
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
