import type { CaseDossierResponse, KindDetailSection } from "@naro/domain";
import { useCaseDossier } from "@naro/mobile-core";
import {
  BackButton,
  Button,
  CASE_KIND_META,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useCancelAppointment } from "@/features/appointments";
import { apiClient } from "@/runtime";

type StickyVariant =
  | { kind: "offers" }
  | { kind: "appointment" }
  | { kind: "process" }
  | { kind: "none" };

function statusBadge(status: CaseDossierResponse["shell"]["status"]): {
  label: string;
  tone: "success" | "warning" | "info" | "neutral" | "accent";
} | null {
  switch (status) {
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

function deriveSticky(dossier: CaseDossierResponse): StickyVariant {
  const status = dossier.shell.status;
  if (status === "matching" || status === "offers_ready") {
    return { kind: "offers" };
  }
  if (status === "appointment_pending" && dossier.appointment) {
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

function formatMoney(amount: string | number | null | undefined): string | null {
  if (amount == null) return null;
  const parsed =
    typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return null;
  return `₺${parsed.toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
  })}`;
}

function formatVehicle(dossier: CaseDossierResponse): string {
  const parts = [
    dossier.vehicle.make,
    dossier.vehicle.model,
    dossier.vehicle.year?.toString(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Araç detayı bekleniyor";
}

function kindDetailRows(detail: KindDetailSection): { label: string; value: string }[] {
  switch (detail.kind) {
    case "accident":
      return [
        { label: "Hasar bölgesi", value: detail.damage_area ?? "Belirtilmedi" },
        {
          label: "Hasar şiddeti",
          value: detail.damage_severity ?? "Belirtilmedi",
        },
        {
          label: "Kasko / trafik",
          value:
            detail.kasko_selected || detail.sigorta_selected
              ? [
                  detail.kasko_selected ? "Kasko" : null,
                  detail.sigorta_selected ? "Trafik" : null,
                ]
                  .filter(Boolean)
                  .join(" + ")
              : "Seçilmedi",
        },
      ];
    case "breakdown":
      return [
        { label: "Arıza konusu", value: detail.breakdown_category },
        { label: "Belirtiler", value: detail.symptoms ?? "Belirtilmedi" },
        {
          label: "Araç yürür durumda mı",
          value:
            detail.vehicle_drivable == null
              ? "Belirtilmedi"
              : detail.vehicle_drivable
                ? "Evet"
                : "Hayır",
        },
      ];
    case "maintenance":
      return [
        { label: "Bakım türü", value: detail.maintenance_category },
        {
          label: "Bakım seviyesi",
          value: detail.maintenance_tier ?? "Belirtilmedi",
        },
        {
          label: "Kilometre",
          value: detail.mileage_km
            ? `${detail.mileage_km.toLocaleString("tr-TR")} km`
            : "Belirtilmedi",
        },
      ];
    case "towing":
      return [
        { label: "Çekici modu", value: detail.tow_mode },
        { label: "Aşama", value: detail.tow_stage },
        { label: "Alış", value: detail.pickup_label ?? "Belirtilmedi" },
        { label: "Bırakış", value: detail.dropoff_label ?? "Belirtilmedi" },
      ];
    default:
      return [];
  }
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View className="gap-3 rounded-[18px] border border-app-outline bg-app-surface px-4 py-4">
      <Text variant="label" tone="inverse" className="text-[14px]">
        {title}
      </Text>
      {children}
    </View>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="caption" tone="muted" className="text-app-text-muted">
      {children}
    </Text>
  );
}

export function CustomerCaseProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dossierQuery = useCaseDossier(id ?? "", { apiClient });
  const dossier = dossierQuery.data;
  const cancelAppointment = useCancelAppointment(
    dossier?.appointment?.id ?? "",
    id ?? "",
  );

  if (!dossier) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            {dossierQuery.isPending ? "Vaka yükleniyor" : "Vaka bulunamadı"}
          </Text>
          <Button label="Geri" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const kindMeta = CASE_KIND_META[dossier.shell.kind];
  const badge = statusBadge(dossier.shell.status);
  const sticky = deriveSticky(dossier);
  const detailRows = kindDetailRows(dossier.kind_detail);
  const offeredItems = dossier.offers.filter(
    (offer) => offer.status === "pending" || offer.status === "shortlisted",
  );

  const handleCancelAppointment = () => {
    Alert.alert(
      "Randevuyu iptal et",
      "Randevu talebin iptal edilecek; teklif tekrar bekleme durumuna döner.",
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
            {dossier.shell.title}
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
        <Section title="Araç">
          <View className="gap-1">
            <Text variant="h2" tone="inverse" className="text-[20px]">
              {dossier.vehicle.plate}
            </Text>
            <Text variant="body" tone="muted">
              {formatVehicle(dossier)}
            </Text>
            {dossier.vehicle.current_km ? (
              <Text variant="caption" tone="muted">
                {dossier.vehicle.current_km.toLocaleString("tr-TR")} km
              </Text>
            ) : null}
          </View>
        </Section>

        <Section title="Vaka detayları">
          {dossier.shell.summary ? (
            <Text variant="body" tone="muted">
              {dossier.shell.summary}
            </Text>
          ) : null}
          {detailRows.map((row) => (
            <View
              key={row.label}
              className="flex-row justify-between gap-3 border-t border-app-outline/60 pt-2"
            >
              <Text variant="caption" tone="muted" className="flex-1">
                {row.label}
              </Text>
              <Text
                variant="caption"
                tone="inverse"
                className="flex-1 text-right"
              >
                {row.value}
              </Text>
            </View>
          ))}
        </Section>

        {dossier.attachments.length > 0 ||
        dossier.evidence.length > 0 ||
        dossier.documents.length > 0 ? (
          <Section title="Dosyalar ve kanıtlar">
            {[...dossier.attachments, ...dossier.evidence, ...dossier.documents]
              .slice(0, 6)
              .map((item) => (
                <View
                  key={`${item.id}-${item.title}`}
                  className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2"
                >
                  <Text variant="label" tone="inverse" className="text-[13px]">
                    {item.title}
                  </Text>
                  {"status_label" in item && item.status_label ? (
                    <Text variant="caption" tone="muted">
                      {item.status_label}
                    </Text>
                  ) : null}
                </View>
              ))}
          </Section>
        ) : null}

        <Section title="Uygun ustalar">
          {dossier.matches.length > 0 ? (
            dossier.matches.map((match) => (
              <View
                key={match.id}
                className="rounded-[14px] border border-app-success/30 bg-app-success-soft px-3 py-3"
              >
                <TrustBadge
                  label={match.match_badge ?? "Bu vakaya uygun"}
                  tone="success"
                />
                <Text variant="caption" tone="inverse" className="mt-2">
                  {match.reason_label}
                </Text>
                <Text variant="caption" tone="muted">
                  Uyum skoru: {match.score}
                </Text>
              </View>
            ))
          ) : (
            <EmptyLine>Uygun usta listesi hazırlanıyor.</EmptyLine>
          )}
        </Section>

        <Section title="Gelen teklifler">
          {offeredItems.length > 0 ? (
            offeredItems.map((offer) => (
              <View
                key={offer.id}
                className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-3"
              >
                <Text variant="label" tone="inverse" className="text-[13px]">
                  {offer.technician_display_label ?? "Servis teklifi"}
                </Text>
                <Text variant="h2" tone="inverse" className="mt-1 text-[19px]">
                  {formatMoney(offer.amount) ?? "Tutar bekleniyor"}
                </Text>
                <Text variant="caption" tone="muted">
                  Durum: {offer.status}
                </Text>
              </View>
            ))
          ) : (
            <EmptyLine>Henüz teklif yok.</EmptyLine>
          )}
        </Section>

        <Section title="Süreç">
          {dossier.milestones.length > 0 ? (
            dossier.milestones.map((milestone) => (
              <View
                key={milestone.id}
                className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-3"
              >
                <Text variant="label" tone="inverse" className="text-[13px]">
                  {milestone.title}
                </Text>
                {milestone.description ? (
                  <Text variant="caption" tone="muted">
                    {milestone.description}
                  </Text>
                ) : null}
                <Text variant="caption" tone="accent">
                  {milestone.status}
                </Text>
              </View>
            ))
          ) : (
            <EmptyLine>Süreç adımları eşleşme sonrası açılır.</EmptyLine>
          )}
          {dossier.tasks.length > 0 ? (
            <View className="gap-2">
              {dossier.tasks.map((task) => (
                <View
                  key={task.id}
                  className="rounded-[14px] border border-app-accent/30 bg-app-accent-soft px-3 py-3"
                >
                  <Text variant="label" tone="inverse" className="text-[13px]">
                    {task.title}
                  </Text>
                  {task.helper_label ? (
                    <Text variant="caption" tone="muted">
                      {task.helper_label}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Vaka geçmişi">
          {dossier.timeline_summary.length > 0 ? (
            dossier.timeline_summary.slice(0, 8).map((event) => (
              <View
                key={event.id}
                className="border-t border-app-outline/60 pt-2"
              >
                <Text variant="caption" tone="inverse">
                  {event.title}
                </Text>
                {event.context_summary ? (
                  <Text variant="caption" tone="muted">
                    {event.context_summary}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <EmptyLine>Vaka geçmişi henüz oluşmadı.</EmptyLine>
          )}
        </Section>
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
              onPress={() => router.push(`/vaka/${dossier.shell.id}/teklifler` as Href)}
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
              onPress={() => router.push(`/vaka/${dossier.shell.id}` as Href)}
              fullWidth
            />
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
