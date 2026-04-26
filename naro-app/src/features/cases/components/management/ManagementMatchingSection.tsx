import { Button, Icon, Surface, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { Sparkles, Clock } from "lucide-react-native";
import { View } from "react-native";

interface ManagementMatchingSectionProps {
    caseId: string;
    status: string;
    offerCount: number;
}

export function ManagementMatchingSection({
    caseId,
    status,
    offerCount,
}: ManagementMatchingSectionProps) {
    const router = useRouter();
    const isMatching = status === "matching";

    return (
        <Surface variant="flat" radius="lg" className="gap-3 px-4 py-3.5">
            <View className="flex-row items-center gap-2">
                <Icon
                    icon={isMatching ? Clock : Sparkles}
                    size={14}
                    color={isMatching ? "#83a7ff" : "#2dd28d"}
                />
                <Text variant="label" tone="inverse" className="text-[14px]">
                    {isMatching
                        ? "Usta henüz seçilmedi"
                        : `${offerCount} teklif hazır`}
                </Text>
            </View>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
                {isMatching
                    ? "Uygun ustalar senin için taranıyor. Çarşı'dan manuel de seçebilirsin."
                    : "Teklifleri karşılaştır ve uygun olanıyla randevu al."}
            </Text>
            {!isMatching ? (
                <Button
                    label="Teklifleri aç"
                    onPress={() =>
                        router.push(`/vaka/${caseId}/teklifler` as Href)
                    }
                />
            ) : (
                <Button
                    label="Usta ara"
                    variant="outline"
                    onPress={() => router.push("/(tabs)/carsi" as Href)}
                />
            )}
        </Surface>
    );
}
