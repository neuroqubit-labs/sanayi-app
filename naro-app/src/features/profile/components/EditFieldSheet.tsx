import { ActionSheetSurface, Button, Text } from "@naro/ui";
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

export type EditFieldSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  label: string;
  value: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onClose: () => void;
  onSubmit: (nextValue: string) => void;
};

export function EditFieldSheet({
  visible,
  title,
  description,
  label,
  value,
  keyboardType = "default",
  autoCapitalize = "sentences",
  onClose,
  onSubmit,
}: EditFieldSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [visible, value]);

  const canSave = draft.trim().length > 0 && draft.trim() !== value.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Düzenlemeyi kapat"
        onPress={onClose}
        className="flex-1 justify-end bg-black/60"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Pressable onPress={(event) => event.stopPropagation()}>
            <ActionSheetSurface title={title} description={description}>
              <View className="gap-3">
                <Text variant="eyebrow" tone="subtle">
                  {label}
                </Text>
                <View className="rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={value}
                    placeholderTextColor="#6f7b97"
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    autoFocus
                    className="min-h-[44px] text-base text-app-text"
                  />
                </View>
                <View className="flex-row gap-3 pt-1">
                  <View className="flex-1">
                    <Button
                      label="Vazgeç"
                      variant="outline"
                      fullWidth
                      onPress={onClose}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      label="Kaydet"
                      fullWidth
                      disabled={!canSave}
                      onPress={() => {
                        onSubmit(draft.trim());
                        onClose();
                      }}
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
