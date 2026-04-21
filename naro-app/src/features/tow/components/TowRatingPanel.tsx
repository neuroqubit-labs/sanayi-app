import { Button, Icon, Text } from "@naro/ui";
import { Star } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

type Props = {
  submittedRating: number | null;
  onSubmit: (rating: number, note: string) => void;
};

export function TowRatingPanel({ submittedRating, onSubmit }: Props) {
  const [rating, setRating] = useState(submittedRating ?? 0);
  const [note, setNote] = useState("");
  const submitted = submittedRating !== null;

  if (submitted) {
    return (
      <View className="gap-2 rounded-[22px] border border-app-success/30 bg-app-success-soft px-4 py-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={Star} size={14} color="#f5b33f" strokeWidth={2.5} />
          <Text variant="eyebrow" tone="success">
            Puanın alındı
          </Text>
        </View>
        <View className="flex-row gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon
              key={i}
              icon={Star}
              size={18}
              color={i < (submittedRating ?? 0) ? "#f5b33f" : "#3a4365"}
              strokeWidth={2.5}
            />
          ))}
        </View>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          Puanın operatörün puan geçmişine işlendi. Daha fazla not girmek istersen Kayıtlar &gt; Vakalar üzerinden açabilirsin.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <Text variant="eyebrow" tone="subtle">
        Puan ver
      </Text>
      <Text variant="label" tone="inverse">
        Operatörün deneyimi nasıldı?
      </Text>
      <View className="flex-row gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1;
          const active = value <= rating;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`${value} yıldız`}
              onPress={() => setRating(value)}
              className="flex-1 items-center justify-center rounded-[14px] border border-app-outline bg-app-surface-2 py-2.5 active:bg-app-surface"
            >
              <Icon
                icon={Star}
                size={22}
                color={active ? "#f5b33f" : "#3a4365"}
                strokeWidth={2.5}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="rounded-[18px] border border-app-outline bg-app-surface-2 px-4 py-3">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="İsteğe bağlı not (kanıt dosyasına eklenir)"
          placeholderTextColor="#6f7b97"
          multiline
          textAlignVertical="top"
          className="min-h-[72px] text-base text-app-text"
        />
      </View>
      <Button
        label="Puanı kaydet"
        size="md"
        fullWidth
        disabled={rating === 0}
        onPress={() => onSubmit(rating, note)}
      />
    </View>
  );
}
