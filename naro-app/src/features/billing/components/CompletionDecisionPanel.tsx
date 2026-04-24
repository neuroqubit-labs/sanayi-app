import {
  ActionRow,
  Button,
  FieldInput,
  Icon,
  Text,
  useNaroTheme,
} from "@naro/ui";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

export type CompletionDecisionApproval = {
  case_id?: string;
  description?: string | null;
  service_comment?: string | null;
  line_items: {
    label: string;
    value: string;
    note?: string | null;
  }[];
};

export type CompletionDecisionPayload = {
  rating: number;
  review_body?: string;
  public_showcase_consent: boolean;
};

type CompletionDecisionPanelProps = {
  approval: CompletionDecisionApproval;
  isSubmitting: boolean;
  isError?: boolean;
  onApprove: (payload: CompletionDecisionPayload) => void;
  onReject: (note: string) => void;
  onTalkToTechnician?: (caseId: string) => void;
};

export function CompletionDecisionPanel({
  approval,
  isSubmitting,
  isError = false,
  onApprove,
  onReject,
  onTalkToTechnician,
}: CompletionDecisionPanelProps) {
  const { colors } = useNaroTheme();
  const [rating, setRating] = useState<number | null>(null);
  const [reviewBody, setReviewBody] = useState("");
  const [publicConsent, setPublicConsent] = useState(false);
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [showRatingError, setShowRatingError] = useState(false);

  const approve = () => {
    if (rating === null) {
      setShowRatingError(true);
      return;
    }
    onApprove({
      rating,
      review_body: reviewBody.trim() || undefined,
      public_showcase_consent: publicConsent,
    });
  };

  const reject = () => {
    const trimmed = note.trim();
    if (trimmed.length < 5) return;
    onReject(trimmed);
  };

  return (
    <View className="gap-3">
      {approval.description ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[13px] leading-[18px]"
        >
          {approval.description}
        </Text>
      ) : null}

      {approval.line_items.length > 0 ? (
        <View className="gap-2 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3.5">
          <View className="flex-row items-center gap-2">
            <Icon icon={ClipboardCheck} size={14} color={colors.info} />
            <Text variant="eyebrow" tone="subtle">
              Servis teslim raporu
            </Text>
          </View>
          <View className="gap-1.5">
            {approval.line_items.map((item, index) => (
              <View
                key={`${item.label}-${index}`}
                className="flex-row items-start justify-between gap-3 rounded-[12px] bg-app-surface-2 px-3 py-2"
              >
                <Text
                  variant="caption"
                  tone="muted"
                  className="flex-1 text-app-text-muted text-[12px]"
                >
                  {item.label}
                </Text>
                <Text
                  variant="caption"
                  tone="inverse"
                  className="flex-1 text-right text-[12px] font-semibold"
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {approval.service_comment ? (
        <View className="gap-2 rounded-[16px] border border-app-info/25 bg-app-info-soft px-4 py-3.5">
          <View className="flex-row items-center gap-2">
            <Icon icon={Wrench} size={14} color={colors.info} />
            <Text variant="eyebrow" tone="subtle">
              Ustanın notu
            </Text>
          </View>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[18px]"
          >
            {approval.service_comment}
          </Text>
        </View>
      ) : null}

      <View className="gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3.5">
        <View className="flex-row items-center gap-2">
          <Icon icon={Star} size={14} color={colors.warning} />
          <Text variant="eyebrow" tone="subtle">
            Puanın
          </Text>
        </View>
        <View className="flex-row gap-2">
          {[1, 2, 3, 4, 5].map((value) => {
            const selected = rating === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} puan`}
                accessibilityState={{ selected }}
                hitSlop={8}
                onPress={() => {
                  setRating(value);
                  setShowRatingError(false);
                }}
                className={[
                  "h-11 flex-1 items-center justify-center rounded-[14px] border",
                  selected
                    ? "border-app-warning bg-app-warning-soft"
                    : "border-app-outline bg-app-surface-2",
                ].join(" ")}
              >
                <Icon
                  icon={Star}
                  size={17}
                  color={selected ? colors.warning : colors.textMuted}
                  fill={selected ? colors.warning : "transparent"}
                />
              </Pressable>
            );
          })}
        </View>
        {showRatingError ? (
          <Text variant="caption" tone="critical" className="text-[11px]">
            İşi kapatmak için 1-5 arası puan vermelisin.
          </Text>
        ) : null}
        <FieldInput
          value={reviewBody}
          onChangeText={setReviewBody}
          placeholder="Kısa yorumun (opsiyonel)"
          textarea
          rows={2}
          inputClassName="bg-app-surface-2"
        />
      </View>

      <ConsentRow
        checked={publicConsent}
        onToggle={() => setPublicConsent((current) => !current)}
        label="Bu sürecin plaka, ad, açık adres ve tutar olmadan servis profilinde örnek iş olarak görünmesine izin veriyorum."
      />

      <View className="gap-2 rounded-[16px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
        <View className="flex-row items-center gap-2">
          <Icon icon={CheckCircle2} size={14} color={colors.success} />
          <Text variant="eyebrow" tone="success">
            Son kontrol
          </Text>
        </View>
        <Text
          variant="body"
          tone="muted"
          className="text-app-text text-[13px] leading-[19px]"
        >
          Onaylarsan vaka kapanır. Sorun varsa "Sorun bildir"e basıp kısa bir
          açıklama yaz; usta veya admin takip eder.
        </Text>
      </View>

      <View className="flex-row items-center gap-2 rounded-[12px] border border-dashed border-app-outline bg-app-surface-2/50 px-3 py-2">
        <Icon icon={Clock3} size={11} color={colors.info} />
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          48 saat içinde yanıt vermezsen otomatik onaylanır.
        </Text>
      </View>

      {rejecting ? (
        <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
          <Text variant="eyebrow" tone="subtle" className="text-[10px]">
            Sorun ne? (en az 5 karakter)
          </Text>
          <FieldInput
            value={note}
            onChangeText={setNote}
            placeholder="Kısa açıklama — usta ve admin görecek"
            textarea
            rows={3}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Vazgeç"
                variant="outline"
                size="md"
                fullWidth
                onPress={() => {
                  setRejecting(false);
                  setNote("");
                }}
                disabled={isSubmitting}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Sorunu gönder"
                size="md"
                fullWidth
                variant="danger"
                loading={isSubmitting}
                disabled={note.trim().length < 5 || isSubmitting}
                onPress={reject}
              />
            </View>
          </View>
        </View>
      ) : (
        <View className="gap-2">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Sorun bildir"
                variant="outline"
                size="md"
                fullWidth
                onPress={() => setRejecting(true)}
                disabled={isSubmitting}
              />
            </View>
            <View className="flex-[1.4]">
              <Button
                label={isSubmitting ? "Onaylanıyor…" : "İş tamam, kapat"}
                size="md"
                fullWidth
                loading={isSubmitting}
                onPress={approve}
              />
            </View>
          </View>
          {onTalkToTechnician && approval.case_id ? (
            <ActionRow
              label="Usta ile konuş"
              leading={<Icon icon={MessageCircle} size={13} color={colors.info} />}
              onPress={() => onTalkToTechnician(approval.case_id ?? "")}
              disabled={isSubmitting}
              className="justify-center"
            />
          ) : null}
          {isError ? (
            <View className="rounded-[10px] border border-app-critical/30 bg-app-critical-soft px-3 py-2">
              <Text variant="caption" tone="critical" className="text-[11px]">
                İşlem başarısız oldu. Tekrar dene.
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function ConsentRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  const { colors } = useNaroTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Servis profilinde yayın izni"
      accessibilityState={{ checked }}
      hitSlop={8}
      onPress={onToggle}
      className={[
        "min-h-[56px] flex-row items-start gap-3 rounded-[16px] border px-3.5 py-3 active:opacity-80",
        checked
          ? "border-app-success/40 bg-app-success-soft"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "mt-0.5 h-5 w-5 items-center justify-center rounded-[6px] border",
          checked
            ? "border-app-success bg-app-success"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        {checked ? (
          <Icon icon={Check} size={12} color={colors.bg} strokeWidth={3} />
        ) : null}
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          <Icon icon={ShieldCheck} size={12} color={colors.info} />
          <Text variant="eyebrow" tone="subtle" className="text-[10px]">
            Public örnek iş izni
          </Text>
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[17px]"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
