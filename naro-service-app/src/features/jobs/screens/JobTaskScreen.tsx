import {
  ActionRow,
  BackButton,
  Button,
  FieldInput,
  Icon,
  IconButton,
  OptionPillGroup,
  PremiumListRow,
  Screen,
  SectionHeader,
  Text,
  TrustBadge,
  useNaroTheme,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  AudioWaveform,
  Camera,
  CheckCircle2,
  FileText,
  Film,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, View } from "react-native";

import {
  useJobDetail,
  useJobTask,
  useMarkReadyForDelivery,
  useRequestJobPartsApproval,
  useShareJobInvoice,
  useShareJobStatusUpdate,
} from "../api";
import { useEvidenceUploadStore } from "../evidence-upload-store";
import { useJobEvidenceUploader } from "../useJobEvidenceUploader";

type StatusTemplate = { id: string; label: string; text: string };

const STATUS_TEMPLATES: StatusTemplate[] = [
  {
    id: "diag",
    label: "Teşhis tamam",
    text: "Teşhis tamamlandı; plan çıkarıldı ve sonraki adıma geçiyoruz.",
  },
  {
    id: "parts",
    label: "Parça beklemede",
    text: "Parça siparişi geçildi, teslimini beklemedeyiz.",
  },
  {
    id: "drive",
    label: "Test sürüşü yapıldı",
    text: "Test sürüşü tamamlandı, sorunlar giderildi.",
  },
  {
    id: "check",
    label: "Kalite kontrol",
    text: "Kalite kontrol tamamlandı, teslime yakın.",
  },
];

type LineItem = { id: string; label: string; qty: string; unit: string };

function newLineItem(): LineItem {
  return {
    id: `li-${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    qty: "1",
    unit: "",
  };
}

export function JobTaskScreen() {
  const router = useRouter();
  const { colors } = useNaroTheme();
  const { id, taskId } = useLocalSearchParams<{
    id: string;
    taskId: string;
  }>();
  const caseId = id ?? "";
  const { data: caseItem } = useJobDetail(caseId);
  const { data: task } = useJobTask(caseId, taskId ?? "");
  const shareStatusUpdate = useShareJobStatusUpdate(caseId);
  const requestPartsApproval = useRequestJobPartsApproval(caseId);
  const shareInvoice = useShareJobInvoice(caseId);
  const markReady = useMarkReadyForDelivery(caseId);
  const openUploadSheet = useEvidenceUploadStore((state) => state.open);
  const { isUploading: isEvidenceUploading, uploadEvidence } =
    useJobEvidenceUploader(caseId, taskId ?? undefined);

  // Form state — kind'a göre kullanılır
  const [statusNote, setStatusNote] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [partsNote, setPartsNote] = useState("");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceNote, setInvoiceNote] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");

  if (!caseItem || !task) {
    return (
      <Screen
        backgroundClassName="bg-app-bg"
        className="flex-1 justify-center gap-4"
      >
        <Text variant="h2" tone="inverse">
          Görev bulunamadı
        </Text>
        <Button
          label="Geri dön"
          variant="outline"
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  const goBack = () => router.replace(`/is/${caseId}` as Href);

  const isUploadTask = task.kind.includes("upload");
  const isLoading =
    isEvidenceUploading ||
    shareStatusUpdate.isPending ||
    requestPartsApproval.isPending ||
    shareInvoice.isPending ||
    markReady.isPending;

  const applyTemplate = (template: StatusTemplate) => {
    setSelectedTemplate(template.id);
    setStatusNote(template.text);
  };

  const addLineItemRow = () => setLineItems((prev) => [...prev, newLineItem()]);
  const removeLineItem = (id: string) =>
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  const updateLineItem = (id: string, patch: Partial<LineItem>) =>
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const validLineItems = lineItems.filter(
    (item) => item.label.trim().length > 0 && Number(item.unit) > 0,
  );
  const partsTotal = validLineItems.reduce(
    (acc, item) => acc + Number(item.qty || "1") * Number(item.unit || "0"),
    0,
  );

  // ─── Submit handlers ─────────────────────────────────────────

  const submitStatus = async () => {
    const note = statusNote.trim();
    if (!note) return;
    await shareStatusUpdate.mutateAsync(note);
    goBack();
  };

  const submitParts = async () => {
    if (validLineItems.length === 0) return;
    await requestPartsApproval.mutateAsync();
    Alert.alert(
      "Parça onayı talep edildi",
      "Müşteri onayı beklemeye alındı. (Mock — v1'de line_items domain'de default ile kaydediliyor.)",
    );
    goBack();
  };

  const submitInvoice = async () => {
    if (!invoiceTitle.trim() || !invoiceAmount) return;
    await shareInvoice.mutateAsync();
    Alert.alert(
      "Fatura gönderildi",
      "Müşteri onayına düştü. (Mock — v1'de amount domain'de default ile kaydediliyor.)",
    );
    goBack();
  };

  const submitDelivery = async () => {
    await markReady.mutateAsync();
    if (deliveryNote.trim()) {
      await shareStatusUpdate.mutateAsync(deliveryNote.trim());
    }
    goBack();
  };

  const submitUploadQuick = async (
    kind: "photo" | "video" | "audio" | "document",
  ) => {
    try {
      await uploadEvidence(
        kind,
        `${kind === "photo" ? "Fotoğraf" : kind === "video" ? "Video" : kind === "audio" ? "Ses notu" : "Belge"} yüklendi.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Dosya yüklenirken bir sorun oluştu.";
      Alert.alert("Yükleme başarısız", message);
    }
  };

  const submitUploadDone = () => {
    goBack();
  };

  // ─── UI ──────────────────────────────────────────────────────

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      {/* Header */}
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Mikro görev
          </Text>
          <Text variant="h2" tone="inverse" numberOfLines={2}>
            {task.title}
          </Text>
        </View>
      </View>

      {/* Context card */}
      <View className="gap-3 rounded-[22px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
        <View className="flex-row items-center justify-between gap-3">
          <TrustBadge
            label={task.urgency === "now" ? "Şimdi" : "Sıradaki"}
            tone={task.urgency === "now" ? "accent" : "info"}
          />
          <Text variant="caption" tone="subtle">
            {caseItem.updated_at_label}
          </Text>
        </View>
        <Text tone="muted" className="text-app-text-muted leading-[20px]">
          {task.description}
        </Text>
        {task.helper_label ? (
          <View className="rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
            <Text variant="eyebrow" tone="subtle">
              Yardımcı not
            </Text>
            <Text tone="muted" className="mt-1 text-app-text-muted text-[13px]">
              {task.helper_label}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Evidence requirements (context — ayrıca liste) */}
      {task.evidence_requirements.length > 0 ? (
        <View className="gap-3">
          <SectionHeader
            title="Bu adım için gerekli görseller"
            description="Zorunlular yüklenmeden görev kapanmaz."
          />
          <View className="gap-2">
            {task.evidence_requirements.map((item) => (
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
      ) : null}

      {/* KIND-SPECIFIC FORMS */}

      {isUploadTask ? (
        <View className="gap-4">
          <SectionHeader
            title="Görsel yükle"
            description="Sheet üstünden kategori seç. Eklenen her görsel müşteriye ve dosya feed'ine yansır."
          />
          <View className="gap-2">
            <Button
              label="Hızlı görsel ekle"
              leftIcon={<Icon icon={Plus} size={14} color={colors.text} />}
              onPress={() => openUploadSheet({ caseId, taskId: task.id })}
            />
            <Text
              variant="caption"
              tone="muted"
              className="text-center text-app-text-subtle text-[11px]"
            >
              veya aşağıdaki hızlı seçeneklerden birini dene
            </Text>
            <View className="gap-2">
              <QuickUploadRow
                icon={Camera}
                color={colors.info}
                label="Hızlı fotoğraf yükle"
                onPress={() => submitUploadQuick("photo")}
              />
              <QuickUploadRow
                icon={Film}
                color={colors.info}
                label="Hızlı video yükle"
                onPress={() => submitUploadQuick("video")}
              />
              <QuickUploadRow
                icon={AudioWaveform}
                color={colors.success}
                label="Hızlı ses notu"
                onPress={() => submitUploadQuick("audio")}
              />
              <QuickUploadRow
                icon={FileText}
                color={colors.warning}
                label="Hızlı belge yükle"
                onPress={() => submitUploadQuick("document")}
              />
            </View>
          </View>
          <Button
            label="Görevi tamamla ve geri dön"
            variant="outline"
            fullWidth
            onPress={submitUploadDone}
          />
        </View>
      ) : null}

      {task.kind === "share_status_update" ? (
        <View className="gap-4">
          <SectionHeader
            title="Durum güncellemesi paylaş"
            description="Müşteri bu notu thread'de görecek ve timeline'a düşecek."
          />
          <OptionPillGroup
            options={STATUS_TEMPLATES.map((template) => ({
              key: template.id,
              label: template.label,
            }))}
            selectedKey={selectedTemplate}
            onSelect={(key) => {
              const template = STATUS_TEMPLATES.find((item) => item.id === key);
              if (template) applyTemplate(template);
            }}
          />
          <FieldInput
            value={statusNote}
            onChangeText={(value) => {
              setStatusNote(value);
              setSelectedTemplate(null);
            }}
            placeholder="Müşteri için kısa, net bir güncelleme yaz..."
            textarea
            rows={4}
          />
          <Button
            label="Paylaş"
            size="lg"
            fullWidth
            disabled={!statusNote.trim() || isLoading}
            loading={isLoading}
            onPress={submitStatus}
          />
        </View>
      ) : null}

      {task.kind === "request_parts_approval" ? (
        <View className="gap-4">
          <SectionHeader
            title="Parça onayı için kalem ekle"
            description="Müşteri bu kalemlerin toplamını onayladığında iş devam eder."
          />
          <View className="gap-3">
            {lineItems.map((item, index) => (
              <View
                key={item.id}
                className="gap-2 rounded-[16px] border border-app-outline bg-app-surface px-3 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text variant="eyebrow" tone="subtle">
                    Kalem {index + 1}
                  </Text>
                  {lineItems.length > 1 ? (
                    <IconButton
                      label={`Kalem ${index + 1} sil`}
                      variant="ghost"
                      icon={
                        <Icon icon={Trash2} size={14} color={colors.critical} />
                      }
                      onPress={() => removeLineItem(item.id)}
                    />
                  ) : null}
                </View>
                <FieldInput
                  value={item.label}
                  onChangeText={(v) => updateLineItem(item.id, { label: v })}
                  placeholder="Parça / işçilik açıklaması"
                  inputClassName="bg-app-surface-2"
                />
                <View className="flex-row gap-2">
                  <FieldInput
                    label="Adet"
                    value={item.qty}
                    onChangeText={(v) =>
                      updateLineItem(item.id, {
                        qty: v.replace(/[^\d]/g, ""),
                      })
                    }
                    placeholder="1"
                    numeric
                    containerClassName="flex-1"
                    inputClassName="bg-app-surface-2"
                  />
                  <FieldInput
                    label="Birim fiyat (₺)"
                    value={item.unit}
                    onChangeText={(v) =>
                      updateLineItem(item.id, {
                        unit: v.replace(/[^\d.]/g, ""),
                      })
                    }
                    placeholder="0"
                    numeric
                    containerClassName="flex-[2]"
                    inputClassName="bg-app-surface-2"
                  />
                </View>
              </View>
            ))}
            <ActionRow
              label="Kalem ekle"
              leading={<Icon icon={Plus} size={14} color={colors.info} />}
              onPress={addLineItemRow}
              className="border-dashed"
            />
          </View>
          <FieldInput
            value={partsNote}
            onChangeText={setPartsNote}
            placeholder="Ek not (opsiyonel — neden, alternatif vs.)"
            textarea
            rows={3}
          />
          <View className="flex-row items-center justify-between rounded-[14px] border border-app-outline bg-app-surface-2 px-4 py-3">
            <Text variant="eyebrow" tone="subtle">
              Toplam
            </Text>
            <Text variant="h3" tone="inverse" className="text-[18px]">
              ₺{partsTotal.toLocaleString("tr-TR")}
            </Text>
          </View>
          <Button
            label={`Onay için gönder (₺${partsTotal.toLocaleString("tr-TR")})`}
            size="lg"
            fullWidth
            disabled={validLineItems.length === 0 || isLoading}
            loading={isLoading}
            onPress={submitParts}
          />
        </View>
      ) : null}

      {task.kind === "share_invoice" ? (
        <View className="gap-4">
          <SectionHeader
            title="Fatura paylaş"
            description="Müşteri fatura onayıyla teslim aşamasına geçer."
          />
          <FieldInput
            label="Fatura başlığı"
            value={invoiceTitle}
            onChangeText={setInvoiceTitle}
            placeholder="örn: Periyodik bakım + yağ değişimi"
          />
          <FieldInput
            label="Toplam tutar (₺)"
            value={invoiceAmount}
            onChangeText={(v) => setInvoiceAmount(v.replace(/[^\d.]/g, ""))}
            placeholder="örn: 2.850"
            numeric
          />
          <FieldInput
            label="Ek not (opsiyonel)"
            value={invoiceNote}
            onChangeText={setInvoiceNote}
            placeholder="Garanti bilgisi, ek kalem detayı, teslim notu..."
            textarea
            rows={3}
          />
          <Button
            label="Faturayı gönder"
            size="lg"
            fullWidth
            disabled={!invoiceTitle.trim() || !invoiceAmount || isLoading}
            loading={isLoading}
            onPress={submitInvoice}
          />
        </View>
      ) : null}

      {task.kind === "mark_ready_for_delivery" ? (
        <View className="gap-4">
          <SectionHeader
            title="Teslim hazır"
            description="Müşteriyi teslim zamanı hakkında bilgilendir."
          />
          <View className="gap-3 rounded-[18px] border border-app-success/40 bg-app-success/10 px-4 py-4">
            <View className="flex-row items-center gap-2">
              <Icon icon={CheckCircle2} size={16} color={colors.success} />
              <Text variant="label" tone="success" className="text-[14px]">
                Araç teslime hazır
              </Text>
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted leading-[18px]"
            >
              Müşteriye bildirim gidecek. Teslim sonrası upload_delivery_proof
              ile kapanış fotoğrafını da eklemeyi unutma.
            </Text>
          </View>
          <FieldInput
            label="Müşteriye hatırlatma (opsiyonel)"
            value={deliveryNote}
            onChangeText={setDeliveryNote}
            placeholder="Teslim saati, not, özel uyarı..."
            textarea
            rows={3}
          />
          <Button
            label="Teslim hazır olarak işaretle"
            size="lg"
            fullWidth
            loading={isLoading}
            onPress={submitDelivery}
          />
        </View>
      ) : null}

      {/* Fallback primary (task kind'ı yukarıdaki listelerde yoksa) */}
      {!isUploadTask &&
      task.kind !== "share_status_update" &&
      task.kind !== "request_parts_approval" &&
      task.kind !== "share_invoice" &&
      task.kind !== "mark_ready_for_delivery" ? (
        <Button
          label={task.cta_label}
          size="lg"
          fullWidth
          loading={isLoading}
          onPress={() => goBack()}
        />
      ) : null}
    </Screen>
  );
}

function QuickUploadRow({
  icon,
  color,
  label,
  onPress,
}: {
  icon: typeof Camera;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <ActionRow
      label={label}
      leading={
        <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
          <Icon icon={icon} size={16} color={color} />
        </View>
      }
      onPress={onPress}
    />
  );
}
