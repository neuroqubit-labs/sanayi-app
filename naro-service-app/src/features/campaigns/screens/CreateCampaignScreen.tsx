import { BackButton, Button, Icon, Screen, SectionHeader, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

import { MAINTENANCE_TEMPLATES } from "../data/fixtures";

export function CreateCampaignScreen() {
  const router = useRouter();
  const [templateIndex, setTemplateIndex] = useState<number | null>(0);
  const [title, setTitle] = useState(MAINTENANCE_TEMPLATES[0]?.title ?? "");
  const [subtitle, setSubtitle] = useState(MAINTENANCE_TEMPLATES[0]?.subtitle ?? "");
  const [price, setPrice] = useState(
    String(MAINTENANCE_TEMPLATES[0]?.starter_price ?? ""),
  );

  const applyTemplate = (index: number) => {
    const template = MAINTENANCE_TEMPLATES[index];
    if (!template) return;
    setTemplateIndex(index);
    setTitle(template.title);
    setSubtitle(template.subtitle);
    setPrice(String(template.starter_price));
  };

  const canSubmit =
    title.trim().length > 2 && subtitle.trim().length > 2 && Number(price) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    Alert.alert(
      "Kampanya oluşturuldu",
      `"${title}" taslak olarak kaydedildi. Kampanyalarım altından yayınlayabilirsin.`,
      [{ text: "Tamam", onPress: () => router.replace("/(modal)/kampanyalarim") }],
    );
  };

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-16">
      <View className="flex-row items-center gap-3">
        <BackButton variant="close" onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Kampanya
          </Text>
          <Text variant="h2" tone="inverse">
            Yeni kampanya oluştur
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <SectionHeader
          title="Şablondan başla"
          description="Hazır paketler üstüne özelleştirme yap."
        />
        <View className="flex-row flex-wrap gap-2">
          {MAINTENANCE_TEMPLATES.map((template, index) => (
            <Pressable
              key={template.category}
              onPress={() => applyTemplate(index)}
              className={`w-[48%] gap-1 rounded-[16px] border px-3 py-3 ${
                templateIndex === index
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-app-outline bg-app-surface"
              }`}
            >
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Sparkles} size={12} color="#d94a1f" />
                <Text variant="label" tone="inverse" className="flex-1 text-[12px]" numberOfLines={1}>
                  {template.title}
                </Text>
              </View>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
                numberOfLines={2}
              >
                {template.subtitle}
              </Text>
              <Text variant="caption" tone="accent" className="text-[11px]">
                Başlangıç ₺{template.starter_price.toLocaleString("tr-TR")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-3">
        <SectionHeader title="Detay" />
        <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
          <Field label="Başlık" value={title} onChange={setTitle} />
          <Field label="Açıklama" value={subtitle} onChange={setSubtitle} multiline />
          <Field
            label="Fiyat (₺)"
            value={price}
            onChange={(v) => setPrice(v.replace(/[^\d]/g, ""))}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Button
        label="Taslak olarak kaydet"
        size="lg"
        fullWidth
        disabled={!canSubmit}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View className="gap-1.5">
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      <View className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholderTextColor="#6f7b97"
          keyboardType={keyboardType ?? "default"}
          multiline={multiline}
          className={`${multiline ? "min-h-[60px]" : ""} text-base text-app-text`}
          textAlignVertical={multiline ? "top" : "center"}
        />
      </View>
    </View>
  );
}
