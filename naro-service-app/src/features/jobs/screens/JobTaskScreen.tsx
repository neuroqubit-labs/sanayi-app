import {
  BackButton,
  Button,
  Icon,
  PremiumListRow,
  Screen,
  SectionHeader,
  Text,
  TrustBadge,
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
import { Alert, Pressable, TextInput, View } from "react-native";

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
  const { isUploading: isEvidenceUploading, uploadEvidence } = useJobEvidenceUploader(
    caseId,
    taskId ?? undefined,
  );

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
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Görev bulunamadı
        </Text>
        <Button label="Geri dön" variant="outline" onPress={() => router.back()} />
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

  const submitUploadQuick = async (kind: "photo" | "video" | "audio" | "document") => {
    try {
      await uploadEvidence(
        kind,
        `${kind === "photo" ? "Fotoğraf" : kind === "video" ? "Video" : kind === "audio" ? "Ses notu" : "Belge"} yüklendi.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Dosya yüklenirken bir sorun oluştu.";
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
              leftIcon={<Icon icon={Plus} size={14} color="#ffffff" />}
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
                color="#83a7ff"
                label="Hızlı fotoğraf yükle"
                onPress={() => submitUploadQuick("photo")}
              />
              <QuickUploadRow
                icon={Film}
                color="#0ea5e9"
                label="Hızlı video yükle"
                onPress={() => submitUploadQuick("video")}
              />
              <QuickUploadRow
                icon={AudioWaveform}
                color="#2dd28d"
                label="Hızlı ses notu"
                onPress={() => submitUploadQuick("audio")}
              />
              <QuickUploadRow
                icon={FileText}
                color="#f5b33f"
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
          <View className="flex-row flex-wrap gap-2">
            {STATUS_TEMPLATES.map((template) => (
              <Pressable
                key={template.id}
                onPress={() => applyTemplate(template)}
                className={`rounded-full border px-3 py-1.5 ${
                  selectedTemplate === template.id
                    ? "border-brand-500 bg-brand-500"
                    : "border-app-outline bg-app-surface"
                }`}
              >
                <Text
                  variant="caption"
                  tone={selectedTemplate === template.id ? "inverse" : "muted"}
                  className="text-[12px]"
                >
                  {template.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
            <TextInput
              value={statusNote}
              onChangeText={(value) => {
                setStatusNote(value);
                setSelectedTemplate(null);
              }}
              placeholder="Müşteri için kısa, net bir güncelleme yaz..."
              placeholderTextColor="#6f7b97"
              multiline
              textAlignVertical="top"
              className="min-h-[100px] text-base text-app-text"
            />
          </View>
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
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => removeLineItem(item.id)}
                    >
                      <Icon icon={Trash2} size={14} color="#ff6b6b" />
                    </Pressable>
                  ) : null}
                </View>
                <View className="rounded-[12px] border border-app-outline bg-app-surface-2 px-3 py-2">
                  <TextInput
                    value={item.label}
                    onChangeText={(v) => updateLineItem(item.id, { label: v })}
                    placeholder="Parça / işçilik açıklaması"
                    placeholderTextColor="#6f7b97"
                    className="text-base text-app-text"
                  />
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-[12px] border border-app-outline bg-app-surface-2 px-3 py-2">
                    <Text variant="caption" tone="subtle" className="text-[10px]">
                      Adet
                    </Text>
                    <TextInput
                      value={item.qty}
                      onChangeText={(v) =>
                        updateLineItem(item.id, {
                          qty: v.replace(/[^\d]/g, ""),
                        })
                      }
                      placeholder="1"
                      placeholderTextColor="#6f7b97"
                      keyboardType="numeric"
                      className="text-base text-app-text"
                    />
                  </View>
                  <View className="flex-[2] rounded-[12px] border border-app-outline bg-app-surface-2 px-3 py-2">
                    <Text variant="caption" tone="subtle" className="text-[10px]">
                      Birim fiyat (₺)
                    </Text>
                    <TextInput
                      value={item.unit}
                      onChangeText={(v) =>
                        updateLineItem(item.id, {
                          unit: v.replace(/[^\d.]/g, ""),
                        })
                      }
                      placeholder="0"
                      placeholderTextColor="#6f7b97"
                      keyboardType="numeric"
                      className="text-base text-app-text"
                    />
                  </View>
                </View>
              </View>
            ))}
            <Pressable
              onPress={addLineItemRow}
              className="flex-row items-center gap-2 rounded-[14px] border border-dashed border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
            >
              <Icon icon={Plus} size={14} color="#83a7ff" />
              <Text variant="label" tone="inverse" className="text-[13px]">
                Kalem ekle
              </Text>
            </Pressable>
          </View>
          <View className="rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
            <TextInput
              value={partsNote}
              onChangeText={setPartsNote}
              placeholder="Ek not (opsiyonel — neden, alternatif vs.)"
              placeholderTextColor="#6f7b97"
              multiline
              textAlignVertical="top"
              className="min-h-[60px] text-base text-app-text"
            />
          </View>
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
          <FormField label="Fatura başlığı">
            <TextInput
              value={invoiceTitle}
              onChangeText={setInvoiceTitle}
              placeholder="örn: Periyodik bakım + yağ değişimi"
              placeholderTextColor="#6f7b97"
              className="text-base text-app-text"
            />
          </FormField>
          <FormField label="Toplam tutar (₺)">
            <TextInput
              value={invoiceAmount}
              onChangeText={(v) => setInvoiceAmount(v.replace(/[^\d.]/g, ""))}
              placeholder="örn: 2.850"
              placeholderTextColor="#6f7b97"
              keyboardType="numeric"
              className="text-base text-app-text"
            />
          </FormField>
          <FormField label="Ek not (opsiyonel)">
            <TextInput
              value={invoiceNote}
              onChangeText={setInvoiceNote}
              placeholder="Garanti bilgisi, ek kalem detayı, teslim notu..."
              placeholderTextColor="#6f7b97"
              multiline
              textAlignVertical="top"
              className="min-h-[70px] text-base text-app-text"
            />
          </FormField>
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
              <Icon icon={CheckCircle2} size={16} color="#2dd28d" />
              <Text variant="label" tone="success" className="text-[14px]">
                Araç teslime hazır
              </Text>
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted leading-[18px]"
            >
              Müşteriye bildirim gidecek. Teslim sonrası upload_delivery_proof ile kapanış fotoğrafını da eklemeyi unutma.
            </Text>
          </View>
          <FormField label="Müşteriye hatırlatma (opsiyonel)">
            <TextInput
              value={deliveryNote}
              onChangeText={setDeliveryNote}
              placeholder="Teslim saati, not, özel uyarı..."
              placeholderTextColor="#6f7b97"
              multiline
              textAlignVertical="top"
              className="min-h-[70px] text-base text-app-text"
            />
          </FormField>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={icon} size={16} color={color} />
      </View>
      <Text variant="label" tone="inverse" className="flex-1 text-[13px]">
        {label}
      </Text>
    </Pressable>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      <View className="rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
        {children}
      </View>
    </View>
  );
}
