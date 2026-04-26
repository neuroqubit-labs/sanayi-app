import { Icon, Surface, Text } from "@naro/ui";
import { Pencil } from "lucide-react-native";
import { Pressable, View } from "react-native";

interface ManagementNotesSectionProps {
    summary: string | null;
    notes: string | null;
    isActive: boolean;
    onEdit: () => void;
}

export function ManagementNotesSection({
    summary,
    notes,
    isActive,
    onEdit,
}: ManagementNotesSectionProps) {
    return (
        <Surface variant="flat" radius="lg" className="gap-3 px-4 py-4">
            <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                    <Text variant="eyebrow" tone="subtle">
                        Özet
                    </Text>
                    <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text leading-[20px]"
                    >
                        {summary || "Özet girilmemiş."}
                    </Text>
                </View>
                {isActive ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Notları düzenle"
                        onPress={onEdit}
                        hitSlop={8}
                        className="h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface-2"
                    >
                        <Icon icon={Pencil} size={14} color="#83a7ff" />
                    </Pressable>
                ) : null}
            </View>
            {notes ? (
                <>
                    <View className="h-px bg-app-outline" />
                    <View className="gap-1">
                        <Text variant="eyebrow" tone="subtle">
                            Ek notlar
                        </Text>
                        <Text
                            variant="caption"
                            tone="muted"
                            className="text-app-text-muted leading-[20px]"
                        >
                            {notes}
                        </Text>
                    </View>
                </>
            ) : null}
        </Surface>
    );
}
