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

export type EditCaseNotesSheetProps = {
  visible: boolean;
  initialSummary: string;
  initialNotes: string;
  onClose: () => void;
  onSubmit: (patch: { summary: string; notes: string }) => void;
};

export function EditCaseNotesSheet({
  visible,
  initialSummary,
  initialNotes,
  onClose,
  onSubmit,
}: EditCaseNotesSheetProps) {
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState(initialSummary);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (visible) {
      setSummary(initialSummary);
      setNotes(initialNotes);
    }
  }, [visible, initialSummary, initialNotes]);

  const canSave =
    summary.trim().length > 0 &&
    (summary.trim() !== initialSummary.trim() || notes.trim() !== initialNotes.trim());

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
            <ActionSheetSurface
              title="Vaka notlarını düzenle"
              description="Özet ve ek notlar — istediğin zaman güncelleyebilirsin."
            >
              <View className="gap-4">
                <View className="gap-2">
                  <Text variant="eyebrow" tone="subtle">
                    Özet
                  </Text>
                  <View className="rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
                    <TextInput
                      value={summary}
                      onChangeText={setSummary}
                      placeholder="Vaka özeti"
                      placeholderTextColor="#6f7b97"
                      multiline
                      textAlignVertical="top"
                      className="min-h-[60px] text-base text-app-text"
                    />
                  </View>
                </View>

                <View className="gap-2">
                  <Text variant="eyebrow" tone="subtle">
                    Ek notlar
                  </Text>
                  <View className="rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Konum, tercih, ek bilgi..."
                      placeholderTextColor="#6f7b97"
                      multiline
                      textAlignVertical="top"
                      className="min-h-[80px] text-base text-app-text"
                    />
                  </View>
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
                        onSubmit({
                          summary: summary.trim(),
                          notes: notes.trim(),
                        });
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
