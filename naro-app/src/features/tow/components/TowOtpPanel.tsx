import { Button, Icon, Text } from "@naro/ui";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react-native";
import { useState } from "react";
import { TextInput, View } from "react-native";

type Props = {
  code: string;
  purpose: "arrival" | "delivery";
  verified: boolean;
  onSubmit: (entered: string) => { ok: boolean };
};

export function TowOtpPanel({ code, purpose, verified, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const purposeLabel =
    purpose === "arrival"
      ? "Tanışma kodu"
      : "Teslim kodu";
  const description =
    purpose === "arrival"
      ? "Operatör aracının yanına ulaşınca bu 4 haneli kodu söyle. Onaylandığında yükleme başlar."
      : "Servis yetkilisi (veya sen) teslim kodunu operatöre söyleyince araç resmi olarak teslim edilir.";

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed.length < 4) {
      setError("4 haneli kodu gir.");
      return;
    }
    const result = onSubmit(trimmed);
    if (!result.ok) {
      setError("Kod hatalı. Operatörle tekrar kontrol et.");
      return;
    }
    setError(null);
    setValue("");
  };

  if (verified) {
    return (
      <View className="flex-row items-center gap-3 rounded-[22px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
        <Icon icon={CheckCircle2} size={18} color="#2dd28d" />
        <View className="flex-1">
          <Text variant="label" tone="success">
            {purposeLabel} doğrulandı
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            {purpose === "arrival"
              ? "Operatör yükleme adımına geçebilir."
              : "Teslim kanıtı kayıt altına alındı."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-[22px] border border-app-warning/30 bg-app-warning-soft px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={KeyRound} size={16} color="#f5b33f" />
        <Text variant="eyebrow" tone="warning">
          {purposeLabel}
        </Text>
      </View>
      <Text variant="caption" tone="muted" className="text-app-text text-[13px] leading-[18px]">
        {description}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="4 haneli kod"
            placeholderTextColor="#6f7b97"
            keyboardType="number-pad"
            maxLength={4}
            className="text-base text-app-text"
          />
        </View>
        <Button label="Onayla" size="md" onPress={handleSubmit} />
      </View>
      <View className="flex-row items-center gap-2 rounded-[14px] border border-app-outline bg-app-surface/60 px-3 py-2">
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
          Demo kodu:
        </Text>
        <Text variant="label" tone="accent" className="text-[14px] tracking-[6px]">
          {code}
        </Text>
      </View>
      {error ? (
        <View className="flex-row items-center gap-2">
          <Icon icon={AlertCircle} size={12} color="#ff7e7e" />
          <Text variant="caption" tone="critical" className="text-[12px]">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
