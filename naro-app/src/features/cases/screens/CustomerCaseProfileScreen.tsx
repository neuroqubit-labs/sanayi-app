import type { ServiceCase } from "@naro/domain";
import {
  BackButton,
  Button,
  CASE_KIND_META,
  CaseInspectionView,
  type CaseContextState,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useCancelAppointment, useCaseDetail } from "../api";

type StickyVariant =
  | { kind: "offers" }
  | { kind: "appointment" }
  | { kind: "process" }
  | { kind: "none" };

function deriveContext(caseItem: ServiceCase): CaseContextState {
  switch (caseItem.status) {
    case "matching":
    case "offers_ready":
    case "appointment_pending":
      return "pool";
    case "completed":
    case "archived":
    case "cancelled":
      return "archive";
    default:
      return "process";
  }
}

function deriveSticky(caseItem: ServiceCase): StickyVariant {
  const status = caseItem.status;
  if (status === "matching" || status === "offers_ready") {
    return { kind: "offers" };
  }
  if (status === "appointment_pending") {
    return { kind: "appointment" };
  }
  if (
    status === "scheduled" ||
    status === "service_in_progress" ||
    status === "parts_approval" ||
    status === "invoice_approval"
  ) {
    return { kind: "process" };
  }
  return { kind: "none" };
}

function statusBadge(caseItem: ServiceCase): {
  label: string;
  tone: "success" | "warning" | "info" | "neutral" | "accent";
} | null {
  switch (caseItem.status) {
    case "completed":
      return { label: "Tamamlandı", tone: "success" };
    case "archived":
      return { label: "Arşiv", tone: "neutral" };
    case "cancelled":
      return { label: "İptal edildi", tone: "neutral" };
    case "matching":
      return { label: "Teklif bekleniyor", tone: "info" };
    case "offers_ready":
      return { label: "Teklifler geldi", tone: "accent" };
    case "appointment_pending":
      return { label: "Randevu yanıtı", tone: "warning" };
    case "scheduled":
      return { label: "Planlandı", tone: "info" };
    case "service_in_progress":
      return { label: "Servis sürüyor", tone: "success" };
    case "parts_approval":
      return { label: "Parça onayın bekliyor", tone: "warning" };
    case "invoice_approval":
      return { label: "Fatura onayın bekliyor", tone: "warning" };
    default:
      return null;
  }
}

export function CustomerCaseProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useCaseDetail(id ?? "");
  const cancelAppointment = useCancelAppointment(id ?? "");

  if (!caseItem) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Vaka bulunamadı
          </Text>
          <Button label="Geri" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const context = deriveContext(caseItem);
  const sticky = deriveSticky(caseItem);
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const badge = statusBadge(caseItem);

  const handleCancelAppointment = () => {
    Alert.alert(
      "Randevuyu iptal et",
      "Randevu talebin iptal edilecek; teklif tekrar havuza dönecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal et",
          style: "destructive",
          onPress: async () => {
            await cancelAppointment.mutateAsync();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-2">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Vaka profili
          </Text>
          <Text
            variant="label"
            tone="inverse"
            className="text-[14px]"
            numberOfLines={1}
          >
            {caseItem.title}
          </Text>
        </View>
        <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
        {badge ? <TrustBadge label={badge.label} tone={badge.tone} /> : null}
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-6 pb-40 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CaseInspectionView
          caseItem={caseItem}
          contextState={context}
          actor="customer"
          showCompetingOffers={false}
        />
      </ScrollView>

      {sticky.kind !== "none" ? (
        <View
          className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-6 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {sticky.kind === "offers" ? (
            <Button
              label="Teklifleri gör"
              size="lg"
              onPress={() => router.push(`/vaka/${caseItem.id}/teklifler` as Href)}
              fullWidth
            />
          ) : null}
          {sticky.kind === "appointment" ? (
            <Button
              label="Randevuyu iptal et"
              variant="outline"
              loading={cancelAppointment.isPending}
              onPress={handleCancelAppointment}
              fullWidth
            />
          ) : null}
          {sticky.kind === "process" ? (
            <Button
              label="Süreç takibine git"
              size="lg"
              onPress={() => router.push(`/vaka/${caseItem.id}` as Href)}
              fullWidth
            />
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
