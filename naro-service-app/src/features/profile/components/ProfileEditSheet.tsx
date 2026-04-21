import { ActionSheetSurface, Button, Icon, Text } from "@naro/ui";
import { Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
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
    return (
      <Modal visible={false} transparent onRequestClose={onClose}>
        <View />
      </Modal>
    );
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
    <Modal
      visible={target !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        onPress={onClose}
        className="flex-1 justify-end bg-black/60"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <ActionSheetSurface
              title={target.title}
              description={target.description}
            >
              <View className="gap-4">
                {target.kind === "text" ? (
                  <TextInput
                    value={textValue}
                    onChangeText={setTextValue}
                    placeholder={target.placeholder}
                    placeholderTextColor="#66718d"
                    className="rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 text-app-text"
                    autoFocus
                  />
                ) : null}

                {target.kind === "textarea" ? (
                  <TextInput
                    value={textValue}
                    onChangeText={setTextValue}
                    placeholder={target.placeholder}
                    placeholderTextColor="#66718d"
                    multiline
                    className="rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 text-app-text"
                    style={{ minHeight: 120, textAlignVertical: "top" }}
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
                            <Icon icon={X} size={11} color="#f45f25" />
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
                      <TextInput
                        value={tagDraft}
                        onChangeText={setTagDraft}
                        placeholder="Yeni etiket"
                        placeholderTextColor="#66718d"
                        className="flex-1 rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 text-app-text"
                        onSubmitEditing={handleAddTag}
                        returnKeyType="done"
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Etiket ekle"
                        onPress={handleAddTag}
                        disabled={!tagDraft.trim()}
                        className={`items-center justify-center rounded-[14px] border px-4 ${
                          tagDraft.trim()
                            ? "border-brand-500/40 bg-brand-500/15"
                            : "border-app-outline bg-app-surface"
                        }`}
                      >
                        <Icon icon={Plus} size={16} color="#f45f25" />
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {target.kind === "business" ? (
                  <View className="gap-3">
                    <BusinessField
                      label="Ticari ünvan"
                      value={business.legal_name}
                      onChange={(v) =>
                        setBusiness({ ...business, legal_name: v })
                      }
                      placeholder="Örn. AutoPro Servis Ltd. Şti."
                    />
                    <BusinessField
                      label="Vergi numarası"
                      value={business.tax_number}
                      onChange={(v) =>
                        setBusiness({ ...business, tax_number: v })
                      }
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
                      onChange={(v) =>
                        setBusiness({ ...business, city_district: v })
                      }
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
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
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
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#66718d"
        multiline={multiline}
        keyboardType={keyboardType}
        className="rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 text-app-text"
        style={multiline ? { minHeight: 72, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}
