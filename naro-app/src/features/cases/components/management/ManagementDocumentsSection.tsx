import type { CaseDocument } from "@naro/domain";
import { Button, Icon, Surface, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
    AudioWaveform,
    Camera,
    FileText,
    Film,
    Plus,
    type LucideIcon,
} from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { openMediaAsset } from "@/shared/media/openAsset";

const ATTACHMENT_ICON: Record<string, LucideIcon> = {
    photo: Camera,
    video: Film,
    audio: AudioWaveform,
    document: FileText,
    invoice: FileText,
    report: FileText,
    location: FileText,
};

const ATTACHMENT_COLOR: Record<string, string> = {
    photo: "#83a7ff",
    video: "#0ea5e9",
    audio: "#2dd28d",
    document: "#f5b33f",
    invoice: "#f5b33f",
    report: "#f5b33f",
    location: "#83a7ff",
};

interface ManagementDocumentsSectionProps {
    caseId: string;
    documents: CaseDocument[];
    isActive: boolean;
    onAddPress: () => void;
}

export function ManagementDocumentsSection({
    caseId,
    documents,
    isActive,
    onAddPress,
}: ManagementDocumentsSectionProps) {
    const router = useRouter();

    return (
        <Surface variant="flat" radius="lg" className="gap-3 px-4 py-4">
            <View className="flex-row items-center justify-between">
                <Text variant="label" tone="inverse" className="text-[14px]">
                    Dosyalar
                </Text>
                <Text variant="caption" tone="muted" className="text-app-text-subtle text-[11px]">
                    {documents.length} dosya
                </Text>
            </View>
            {documents.length > 0 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                >
                    {documents.slice(0, 4).map((doc) => {
                        const IconCmp = ATTACHMENT_ICON[doc.kind] ?? FileText;
                        const color = ATTACHMENT_COLOR[doc.kind] ?? "#83a7ff";
                        return (
                            <Pressable
                                key={doc.id}
                                accessibilityRole="button"
                                accessibilityLabel={`${doc.title} dosyasını aç`}
                                onPress={() => void openMediaAsset(doc.asset, "preview")}
                                className="w-24 items-center gap-1.5 rounded-[14px] border border-app-outline bg-app-surface-2 px-2 py-2.5 active:opacity-85"
                            >
                                <View className="h-9 w-9 items-center justify-center rounded-full bg-app-bg">
                                    <Icon icon={IconCmp} size={16} color={color} />
                                </View>
                                <Text
                                    variant="caption"
                                    tone="muted"
                                    className="text-app-text text-[11px] text-center"
                                    numberOfLines={2}
                                >
                                    {doc.title}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            ) : (
                <Text variant="caption" tone="muted" className="text-app-text-muted">
                    Henüz dosya eklenmemiş.
                </Text>
            )}
            <View className="flex-row gap-2">
                {isActive ? (
                    <Button
                        label="Dosya ekle"
                        variant="outline"
                        leftIcon={<Icon icon={Plus} size={14} color="#83a7ff" />}
                        className="flex-1"
                        onPress={onAddPress}
                    />
                ) : null}
                {documents.length > 4 ? (
                    <Button
                        label="Tümünü gör"
                        variant="outline"
                        className="flex-1"
                        onPress={() =>
                            router.push(`/vaka/${caseId}/belgeler` as Href)
                        }
                    />
                ) : null}
            </View>
        </Surface>
    );
}
