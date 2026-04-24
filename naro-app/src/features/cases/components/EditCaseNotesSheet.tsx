import {
  ActionSheetSurface,
  BottomSheetOverlay,
  Button,
  FieldInput,
} from "@naro/ui";
import { useEffect, useState } from "react";
import { View } from "react-native";

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
    (summary.trim() !== initialSummary.trim() ||
      notes.trim() !== initialNotes.trim());

  return (
    <BottomSheetOverlay
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Düzenlemeyi kapat"
      keyboardAvoiding
    >
      <ActionSheetSurface
        title="Vaka notlarını düzenle"
        description="Özet ve ek notlar — istediğin zaman güncelleyebilirsin."
      >
        <View className="gap-4">
          <FieldInput
            label="Özet"
            value={summary}
            onChangeText={setSummary}
            placeholder="Vaka özeti"
            textarea
            rows={3}
          />

          <FieldInput
            label="Ek notlar"
            value={notes}
            onChangeText={setNotes}
            placeholder="Konum, tercih, ek bilgi..."
            textarea
            rows={4}
          />

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
    </BottomSheetOverlay>
  );
}
