import type { CaseDocument } from "@naro/domain";
import {
  Avatar,
  BackButton,
  Button,
  Icon,
  StatusChip,
  Surface,
  Text,
  TrustBadge,
  VehicleContextBar,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  AudioWaveform,
  Camera,
  ChevronRight,
  FileText,
  Film,
  Hourglass,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUstaPreviewStore } from "@/features/ustalar";
import { mockTechnicianProfiles } from "@/features/ustalar/data/fixtures";
import { useVehicle } from "@/features/vehicles";
import { openMediaAsset } from "@/shared/media/openAsset";

import {
  useAddCaseAttachment,
  useAppointmentCountdown,
  useCancelCase,
  useCaseDetail,
  useUpdateCaseNotes,
} from "../api";
import { AddAttachmentSheet } from "../components/AddAttachmentSheet";
import { EditCaseNotesSheet } from "../components/EditCaseNotesSheet";
import { getCaseKindLabel, getCaseStatusLabel, getCaseStatusTone } from "../presentation";

const INACTIVE_STATUSES = new Set<string>(["completed", "archived", "cancelled"]);

const ATTACHMENT_ICON: Record<string, LucideIcon> = {
  photo: Camera,
  video: Film,
  audio: AudioWaveform,
  document: FileText,
  invoice: FileText,
  report: FileText,
  location: FileText,
};

const ATTACHMENT_COLOR: Record<string, string> = {
  photo: "#83a7ff",
  video: "#0ea5e9",
  audio: "#2dd28d",
  document: "#f5b33f",
  invoice: "#f5b33f",
  report: "#f5b33f",
  location: "#83a7ff",
};

export function CaseManagementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";
  const { data: caseItem } = useCaseDetail(caseId);
  const { data: vehicle } = useVehicle(caseItem?.vehicle_id ?? "");
  const countdown = useAppointmentCountdown(caseId);
  const openPreview = useUstaPreviewStore((state) => state.open);

  const cancelCase = useCancelCase();
  const addAttachment = useAddCaseAttachment();
  const updateNotes = useUpdateCaseNotes();

  const [editOpen, setEditOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const assignedTechnician = useMemo(() => {
    if (!caseItem) return null;
    const techId =
      caseItem.assigned_technician_id ?? caseItem.preferred_technician_id;
    if (!techId) return null;
    return mockTechnicianProfiles.find((t) => t.id === techId) ?? null;
  }, [caseItem]);

  if (!caseItem) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Vaka bulunamadı
          </Text>
          <Button
            label="Geri dön"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = !INACTIVE_STATUSES.has(caseItem.status);
  const isCancelled = caseItem.status === "cancelled";
  const offers = caseItem.offers ?? [];
  const documents = caseItem.documents ?? [];
  const lastMessage =
    caseItem.thread.messages[caseItem.thread.messages.length - 1] ?? null;
  const hasProcessBridge = [
    "appointment_pending",
    "scheduled",
    "service_in_progress",
    "parts_approval",
    "invoice_approval",
  ].includes(caseItem.status);
  const showFinderHint =
    caseItem.status === "matching" || caseItem.status === "offers_ready";

  const handleCancel = () => {
    Alert.alert(
      "Vakayı iptal et",
      "Bu vakayı iptal etmek istediğinden emin misin? Aktif randevu ve teklifler düşer.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Evet, iptal et",
          style: "destructive",
          onPress: async () => {
            await cancelCase.mutateAsync({ caseId });
            router.replace("/(tabs)/" as Href);
          },
        },
      ],
    );
  };

  const handleEditSubmit = (patch: { summary: string; notes: string }) => {
    void updateNotes.mutateAsync({
      caseId,
      summary: patch.summary,
      notes: patch.notes,
    });
  };

  const handleAddAttachment = (
    attachment: Parameters<typeof addAttachment.mutate>[0]["attachment"],
  ) => {
    void addAttachment.mutateAsync({ caseId, attachment });
  };

  return (
    <SafeAreaView className="flex-1 bg-app-bg" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton onPress={() => router.back()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vaka profilini aç"
          onPress={() =>
            router.push(`/(modal)/vaka-profili/${caseItem.id}` as Href)
          }
          className="flex-1 flex-row items-center justify-center gap-1.5 active:opacity-85"
        >
          <Text variant="h2" tone="inverse" className="text-[18px]">
            Vakam
          </Text>
          <Icon icon={ChevronRight} size={14} color="#83a7ff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Özet kartı */}
        <Surface
          variant="raised"
          radius="lg"
          className="gap-3 border-app-outline-strong bg-app-surface-2 px-4 py-4"
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <TrustBadge label={getCaseKindLabel(caseItem.kind)} tone="accent" />
            <StatusChip
              label={getCaseStatusLabel(caseItem.status)}
              tone={getCaseStatusTone(caseItem.status)}
            />
          </View>
          <Text variant="display" tone="inverse" className="text-[20px] leading-[24px]">
            {caseItem.title}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-subtle text-[11px]">
            {`Oluşturuldu · ${caseItem.created_at_label} · #${caseItem.id.slice(0, 8)}`}
          </Text>
        </Surface>

        {/* Süreç köprüsü */}
        {hasProcessBridge ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ustayla süreci aç"
            onPress={() => router.push(`/vaka/${caseId}/surec` as Href)}
            className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/40 bg-brand-500/10 px-4 py-3.5 active:opacity-90"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
              <Icon
                icon={caseItem.status === "appointment_pending" ? Hourglass : Sparkles}
                size={18}
                color="#0ea5e9"
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Ustayla süreç
              </Text>
              <Text variant="label" tone="inverse" className="text-[14px]">
                {caseItem.next_action_title || getCaseStatusLabel(caseItem.status)}
              </Text>
              {countdown.label ? (
                <Text variant="caption" tone="warning" className="text-[11px]">
                  {countdown.label}
                </Text>
              ) : caseItem.next_action_description ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px]"
                  numberOfLines={2}
                >
                  {caseItem.next_action_description}
                </Text>
              ) : null}
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
          </Pressable>
        ) : null}

        {/* Usta henüz yok */}
        {showFinderHint ? (
          <Surface variant="flat" radius="lg" className="gap-3 px-4 py-3.5">
            <View className="flex-row items-center gap-2">
              <Icon icon={Sparkles} size={14} color="#83a7ff" />
              <Text variant="label" tone="inverse" className="text-[14px]">
                {caseItem.status === "matching"
                  ? "Usta henüz seçilmedi"
                  : `${offers.length} teklif hazır`}
              </Text>
            </View>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              {caseItem.status === "matching"
                ? "Uygun ustalar senin için taranıyor. Çarşı'dan manuel de seçebilirsin."
                : "Teklifleri karşılaştır ve uygun olanıyla randevu al."}
            </Text>
            {caseItem.status === "offers_ready" ? (
              <Button
                label="Teklifleri aç"
                onPress={() =>
                  router.push(`/vaka/${caseId}/teklifler` as Href)
                }
              />
            ) : (
              <Button
                label="Usta ara"
                variant="outline"
                onPress={() => router.push("/(tabs)/carsi" as Href)}
              />
            )}
          </Surface>
        ) : null}

        {/* Araç kartı */}
        {vehicle ? (
          <VehicleContextBar
            plate={vehicle.plate}
            vehicle={`${vehicle.make} ${vehicle.model} · ${vehicle.year}`}
            subtitle={vehicle.note}
            onPress={() => router.push(`/arac/${vehicle.id}` as Href)}
          />
        ) : null}

        {/* Atanmış usta (scheduled ve sonrası için) */}
        {assignedTechnician && !showFinderHint ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${assignedTechnician.name} önizleme`}
            onPress={() => openPreview(assignedTechnician.id)}
            className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
          >
            <Avatar name={assignedTechnician.name} size="md" />
            <View className="flex-1 gap-0.5">
              <Text variant="eyebrow" tone="subtle">
                Atanan usta
              </Text>
              <Text variant="label" tone="inverse" className="text-[14px]">
                {assignedTechnician.name}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
                numberOfLines={1}
              >
                {assignedTechnician.tagline}
              </Text>
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
          </Pressable>
        ) : null}

        {/* Özet + notlar */}
        <Surface variant="flat" radius="lg" className="gap-3 px-4 py-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text variant="eyebrow" tone="subtle">
                Özet
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text leading-[20px]"
              >
                {caseItem.summary || "Özet girilmemiş."}
              </Text>
            </View>
            {isActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notları düzenle"
                onPress={() => setEditOpen(true)}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface-2"
              >
                <Icon icon={Pencil} size={14} color="#83a7ff" />
              </Pressable>
            ) : null}
          </View>
          {caseItem.request.notes ? (
            <>
              <View className="h-px bg-app-outline" />
              <View className="gap-1">
                <Text variant="eyebrow" tone="subtle">
                  Ek notlar
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted leading-[20px]"
                >
                  {caseItem.request.notes}
                </Text>
              </View>
            </>
          ) : null}
        </Surface>

        {/* Dosyalar */}
        <Surface variant="flat" radius="lg" className="gap-3 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="inverse" className="text-[14px]">
              Dosyalar
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-subtle text-[11px]">
              {documents.length} dosya
            </Text>
          </View>
          {documents.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {documents.slice(0, 4).map((doc: CaseDocument) => {
                const IconCmp = ATTACHMENT_ICON[doc.kind] ?? FileText;
                const color = ATTACHMENT_COLOR[doc.kind] ?? "#83a7ff";
                return (
                  <Pressable
                    key={doc.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${doc.title} dosyasını aç`}
                    onPress={() => void openMediaAsset(doc.asset, "preview")}
                    className="w-24 items-center gap-1.5 rounded-[14px] border border-app-outline bg-app-surface-2 px-2 py-2.5 active:opacity-85"
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-app-bg">
                      <Icon icon={IconCmp} size={16} color={color} />
                    </View>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text text-[11px] text-center"
                      numberOfLines={2}
                    >
                      {doc.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              Henüz dosya eklenmemiş.
            </Text>
          )}
          <View className="flex-row gap-2">
            {isActive ? (
              <Button
                label="Dosya ekle"
                variant="outline"
                leftIcon={<Icon icon={Plus} size={14} color="#83a7ff" />}
                className="flex-1"
                onPress={() => setAttachOpen(true)}
              />
            ) : null}
            {documents.length > 4 ? (
              <Button
                label="Tümünü gör"
                variant="outline"
                className="flex-1"
                onPress={() =>
                  router.push(`/vaka/${caseId}/belgeler` as Href)
                }
              />
            ) : null}
          </View>
        </Surface>

        {/* Mesajlar özeti */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mesajları aç"
          onPress={() => router.push(`/vaka/${caseId}/mesajlar` as Href)}
          className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
            <Icon icon={MessageSquare} size={16} color="#83a7ff" />
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text variant="label" tone="inverse" className="text-[14px]">
                Mesajlar
              </Text>
              {caseItem.thread.unread_count > 0 ? (
                <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-app-critical px-1.5">
                  <Text
                    variant="caption"
                    tone="inverse"
                    className="text-[10px] font-semibold"
                  >
                    {caseItem.thread.unread_count}
                  </Text>
                </View>
              ) : null}
            </View>
            {lastMessage ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
                numberOfLines={1}
              >
                {`${lastMessage.author_name}: ${lastMessage.body}`}
              </Text>
            ) : (
              <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
                Henüz mesaj yok
              </Text>
            )}
          </View>
          <Icon icon={ChevronRight} size={16} color="#83a7ff" />
        </Pressable>

        {/* Teklifler özeti */}
        {offers.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Teklifleri aç"
            onPress={() => router.push(`/vaka/${caseId}/teklifler` as Href)}
            className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-app-success/15">
              <Icon icon={FileText} size={16} color="#2dd28d" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse" className="text-[14px]">
                Teklifler
              </Text>
              <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
                {`${offers.length} teklif · ${offers[0]?.price_label ?? ""}`}
              </Text>
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
          </Pressable>
        ) : null}

        {/* Metadata */}
        <View className="items-center pt-2">
          <Text variant="caption" tone="muted" className="text-app-text-subtle text-[10px]">
            {`Son güncelleme · ${caseItem.updated_at_label}`}
          </Text>
        </View>

        {/* Kapandı durumunda benzer talep */}
        {!isActive && !isCancelled ? (
          <Button
            label="Benzer talep aç"
            variant="outline"
            onPress={() =>
              router.push(`/(modal)/talep/${caseItem.kind}` as Href)
            }
          />
        ) : null}

        {/* Tehlikeli bölge */}
        {isActive ? (
          <Surface
            variant="flat"
            radius="lg"
            className="mt-4 gap-3 border-app-critical/30 px-4 py-4"
          >
            <Text variant="eyebrow" tone="critical">
              Tehlikeli bölge
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
              Vakayı iptal edersen aktif teklif ve randevu düşer. Geri alma yok.
            </Text>
            <Button
              label="Vakayı iptal et"
              variant="outline"
              loading={cancelCase.isPending}
              onPress={handleCancel}
            />
          </Surface>
        ) : null}
      </ScrollView>

      <EditCaseNotesSheet
        visible={editOpen}
        initialSummary={caseItem.summary}
        initialNotes={caseItem.request.notes ?? ""}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      <AddAttachmentSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onSubmit={handleAddAttachment}
        target={{ purpose: "case_evidence_photo", ownerRef: `case:${caseId}` }}
      />
    </SafeAreaView>
  );
}
