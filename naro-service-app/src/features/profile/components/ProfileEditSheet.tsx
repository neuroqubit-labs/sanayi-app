import {
  ActionSheetSurface,
  BottomSheetOverlay,
  Button,
  FieldInput,
  Icon,
  IconButton,
  Text,
  useNaroTheme,
} from "@naro/ui";
import { Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import type { BusinessInfo } from "@/features/technicians";

type BusinessValue = {
  legal_name: string;
  tax_number: string;
  address: string;
  city_district: string;
};

export type ProfileEditTarget =
  | {
      kind: "text";
      field: "working_hours" | "area_label";
      title: string;
      description?: string;
      placeholder?: string;
      initial: string;
    }
  | {
      kind: "textarea";
      field: "biography";
      title: string;
      description?: string;
      placeholder?: string;
      initial: string;
    }
  | {
      kind: "tags";
      field: "specialties" | "expertise";
      title: string;
      description?: string;
      initial: string[];
    }
  | {
      kind: "business";
      field: "business";
      title: string;
      description?: string;
      initial: BusinessValue;
    };

type SaveResult =
  | { kind: "text"; field: "working_hours" | "area_label"; value: string }
  | { kind: "textarea"; field: "biography"; value: string }
  | { kind: "tags"; field: "specialties" | "expertise"; value: string[] }
  | { kind: "business"; field: "business"; value: Partial<BusinessInfo> };

type Props = {
  target: ProfileEditTarget | null;
  onClose: () => void;
  onSave: (result: SaveResult) => void;
};

export function ProfileEditSheet({ target, onClose, onSave }: Props) {
  const { colors } = useNaroTheme();
  const [textValue, setTextValue] = useState("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [business, setBusiness] = useState<BusinessValue>({
    legal_name: "",
    tax_number: "",
    address: "",
    city_district: "",
  });

  useEffect(() => {
    if (!target) return;
    if (target.kind === "text" || target.kind === "textarea") {
      setTextValue(target.initial);
    } else if (target.kind === "tags") {
      setTagList([...target.initial]);
      setTagDraft("");
    } else if (target.kind === "business") {
      setBusiness({
        legal_name: target.initial.legal_name,
        tax_number: target.initial.tax_number,
        address: target.initial.address,
        city_district: target.initial.city_district,
      });
    }
  }, [target]);

  if (!target) {
    return null;
  }

  const handleAddTag = () => {
    const v = tagDraft.trim();
    if (!v || tagList.includes(v)) return;
    setTagList([...tagList, v]);
    setTagDraft("");
  };

  const handleRemoveTag = (label: string) => {
    setTagList(tagList.filter((t) => t !== label));
  };

  const handleSave = () => {
    if (target.kind === "text") {
      onSave({ kind: "text", field: target.field, value: textValue.trim() });
    } else if (target.kind === "textarea") {
      onSave({
        kind: "textarea",
        field: target.field,
        value: textValue.trim(),
      });
    } else if (target.kind === "tags") {
      onSave({ kind: "tags", field: target.field, value: tagList });
    } else if (target.kind === "business") {
      onSave({
        kind: "business",
        field: "business",
        value: {
          legal_name: business.legal_name.trim(),
          tax_number: business.tax_number.trim() || undefined,
          address: business.address.trim(),
          city_district: business.city_district.trim() || undefined,
        },
      });
    }
    onClose();
  };

  const canSave =
    target.kind === "tags"
      ? true
      : target.kind === "business"
        ? business.legal_name.trim().length > 2 &&
          business.address.trim().length > 3
        : textValue.trim().length > 0;

  return (
    <BottomSheetOverlay
      visible={target !== null}
      onClose={onClose}
      accessibilityLabel="Kapat"
      keyboardAvoiding
    >
      <ActionSheetSurface title={target.title} description={target.description}>
        <View className="gap-4">
          {target.kind === "text" ? (
            <FieldInput
              value={textValue}
              onChangeText={setTextValue}
              placeholder={target.placeholder}
              autoFocus
            />
          ) : null}

          {target.kind === "textarea" ? (
            <FieldInput
              value={textValue}
              onChangeText={setTextValue}
              placeholder={target.placeholder}
              textarea
              rows={4}
              autoFocus
            />
          ) : null}

          {target.kind === "tags" ? (
            <View className="gap-3">
              <View className="flex-row flex-wrap gap-2">
                {tagList.length > 0 ? (
                  tagList.map((tag) => (
                    <Pressable
                      key={tag}
                      accessibilityRole="button"
                      accessibilityLabel={`${tag} kaldır`}
                      hitSlop={8}
                      onPress={() => handleRemoveTag(tag)}
                      className="flex-row items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/15 px-3 py-1.5 active:opacity-80"
                    >
                      <Text
                        variant="caption"
                        tone="inverse"
                        className="text-[12px]"
                      >
                        {tag}
                      </Text>
                      <Icon icon={X} size={11} color={colors.info} />
                    </Pressable>
                  ))
                ) : (
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-subtle text-[11px]"
                  >
                    Henüz etiket yok
                  </Text>
                )}
              </View>
              <View className="flex-row gap-2">
                <FieldInput
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  placeholder="Yeni etiket"
                  containerClassName="flex-1"
                  onSubmitEditing={handleAddTag}
                  returnKeyType="done"
                />
                <IconButton
                  label="Etiket ekle"
                  icon={<Icon icon={Plus} size={16} color={colors.info} />}
                  onPress={handleAddTag}
                  disabled={!tagDraft.trim()}
                  className={
                    tagDraft.trim()
                      ? "border-brand-500/40 bg-brand-500/15"
                      : undefined
                  }
                />
              </View>
            </View>
          ) : null}

          {target.kind === "business" ? (
            <View className="gap-3">
              <BusinessField
                label="Ticari ünvan"
                value={business.legal_name}
                onChange={(v) => setBusiness({ ...business, legal_name: v })}
                placeholder="Örn. AutoPro Servis Ltd. Şti."
              />
              <BusinessField
                label="Vergi numarası"
                value={business.tax_number}
                onChange={(v) => setBusiness({ ...business, tax_number: v })}
                placeholder="Opsiyonel"
                keyboardType="number-pad"
              />
              <BusinessField
                label="Adres"
                value={business.address}
                onChange={(v) => setBusiness({ ...business, address: v })}
                placeholder="Cadde, mahalle, no"
                multiline
              />
              <BusinessField
                label="İl / İlçe"
                value={business.city_district}
                onChange={(v) => setBusiness({ ...business, city_district: v })}
                placeholder="Örn. Sarıyer / İstanbul"
              />
            </View>
          ) : null}

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Vazgeç"
                variant="outline"
                onPress={onClose}
                fullWidth
              />
            </View>
            <View className="flex-1">
              <Button
                label="Kaydet"
                variant={canSave ? "primary" : "outline"}
                disabled={!canSave}
                onPress={handleSave}
                fullWidth
              />
            </View>
          </View>
        </View>
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}

function BusinessField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View className="gap-1.5">
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      <FieldInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        textarea={multiline}
        rows={multiline ? 2 : undefined}
        keyboardType={keyboardType}
      />
    </View>
  );
}
