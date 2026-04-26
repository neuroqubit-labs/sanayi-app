import { Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { ChevronRight, Truck } from "lucide-react-native";
import { Pressable, View } from "react-native";

interface ManagementTowingSectionProps {
    caseId: string;
    linkedTowCaseIds: string[];
    towEntryRoute: any;
    isActive: boolean;
}

export function ManagementTowingSection({
    linkedTowCaseIds,
    towEntryRoute,
    isActive,
}: ManagementTowingSectionProps) {
    const router = useRouter();

    return (
        <View className="gap-2">
            {linkedTowCaseIds.map((towId) => (
                <Pressable
                    key={towId}
                    accessibilityRole="button"
                    accessibilityLabel="Bu vakanın çekicisini aç"
                    onPress={() => router.push(`/cekici/${towId}` as Href)}
                    className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/40 bg-brand-500/10 px-4 py-3.5 active:opacity-90"
                >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
                        <Icon icon={Truck} size={18} color="#0ea5e9" />
                    </View>
                    <View className="flex-1 gap-0.5">
                        <Text variant="eyebrow" tone="subtle">
                            Bu vakanın çekicisi
                        </Text>
                        <Text variant="label" tone="inverse" className="text-[14px]">
                            {`Çekici #${towId.slice(0, 8)}`}
                        </Text>
                    </View>
                    <Icon icon={ChevronRight} size={16} color="#83a7ff" />
                </Pressable>
            ))}

            {linkedTowCaseIds.length === 0 && isActive && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Bu vakaya çekici çağır"
                    onPress={() => router.push(towEntryRoute as Href)}
                    className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
                >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
                        <Icon icon={Truck} size={18} color="#83a7ff" />
                    </View>
                    <View className="flex-1 gap-0.5">
                        <Text variant="eyebrow" tone="subtle">
                            Çekici gerekli mi?
                        </Text>
                        <Text variant="label" tone="inverse" className="text-[14px]">
                            Bu vakaya bağlı çekici çağır
                        </Text>
                    </View>
                    <Icon icon={ChevronRight} size={16} color="#83a7ff" />
                </Pressable>
            )}
        </View>
    );
}
