import { Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { ChevronRight, Hourglass, Sparkles } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { getCaseStatusLabel } from "../../presentation";
import type { ServiceCaseStatus } from "@naro/domain";

interface ManagementProcessBridgeProps {
    caseId: string;
    status: ServiceCaseStatus;
    nextActionTitle?: string | null;
    nextActionDescription?: string | null;
    countdownLabel?: string | null;
}

export function ManagementProcessBridge({
    caseId,
    status,
    nextActionTitle,
    nextActionDescription,
    countdownLabel,
}: ManagementProcessBridgeProps) {
    const router = useRouter();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ustayla süreci aç"
            onPress={() => router.push(`/vaka/${caseId}/surec` as Href)}
            className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/40 bg-brand-500/10 px-4 py-3.5 active:opacity-90"
        >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
                <Icon
                    icon={status === "appointment_pending" ? Hourglass : Sparkles}
                    size={18}
                    color="#0ea5e9"
                />
            </View>
            <View className="flex-1 gap-0.5">
                <Text variant="eyebrow" tone="subtle">
                    Ustayla süreç
                </Text>
                <Text variant="label" tone="inverse" className="text-[14px]">
                    {nextActionTitle || getCaseStatusLabel(status)}
                </Text>
                {countdownLabel ? (
                    <Text variant="caption" tone="warning" className="text-[11px]">
                        {countdownLabel}
                    </Text>
                ) : nextActionDescription ? (
                    <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-muted text-[12px]"
                        numberOfLines={2}
                    >
                        {nextActionDescription}
                    </Text>
                ) : null}
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
        </Pressable>
    );
}
