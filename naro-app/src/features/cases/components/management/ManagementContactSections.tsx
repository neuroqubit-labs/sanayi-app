import { Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { ChevronRight, FileText, MessageSquare } from "lucide-react-native";
import { Pressable, View } from "react-native";

interface MessagesPreviewSectionProps {
    caseId: string;
    unreadCount: number;
    lastMessageAuthor?: string | null;
    lastMessageBody?: string | null;
}

export function MessagesPreviewSection({
    caseId,
    unreadCount,
    lastMessageAuthor,
    lastMessageBody,
}: MessagesPreviewSectionProps) {
    const router = useRouter();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mesajları aç"
            onPress={() => router.push(`/vaka/${caseId}/mesajlar` as Href)}
            className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
                <Icon icon={MessageSquare} size={16} color="#83a7ff" />
            </View>
            <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                    <Text variant="label" tone="inverse" className="text-[14px]">
                        Mesajlar
                    </Text>
                    {unreadCount > 0 ? (
                        <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-app-critical px-1.5">
                            <Text
                                variant="caption"
                                tone="inverse"
                                className="text-[10px] font-semibold"
                            >
                                {unreadCount}
                            </Text>
                        </View>
                    ) : null}
                </View>
                {lastMessageBody ? (
                    <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-muted text-[12px]"
                        numberOfLines={1}
                    >
                        {`${lastMessageAuthor ? `${lastMessageAuthor}: ` : ""}${lastMessageBody}`}
                    </Text>
                ) : (
                    <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
                        Henüz mesaj yok
                    </Text>
                )}
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
        </Pressable>
    );
}

interface OffersPreviewSectionProps {
    caseId: string;
    offerCount: number;
    firstOfferAmount?: string;
    firstOfferCurrency?: string;
}

export function OffersPreviewSection({
    caseId,
    offerCount,
    firstOfferAmount,
    firstOfferCurrency,
}: OffersPreviewSectionProps) {
    const router = useRouter();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Teklifleri aç"
            onPress={() => router.push(`/vaka/${caseId}/teklifler` as Href)}
            className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-app-success/15">
                <Icon icon={FileText} size={16} color="#2dd28d" />
            </View>
            <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse" className="text-[14px]">
                    Teklifler
                </Text>
                <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
                    {`${offerCount} teklif${firstOfferAmount ? ` · ${formatOfferPrice(firstOfferAmount, firstOfferCurrency || "TRY")}` : ""}`}
                </Text>
            </View>
            <Icon icon={ChevronRight} size={16} color="#83a7ff" />
        </Pressable>
    );
}

function formatOfferPrice(amountRaw: string, currency: string): string {
    const parsed = Number.parseFloat(amountRaw);
    if (Number.isNaN(parsed)) return `${amountRaw} ${currency}`;
    const formatted = parsed.toLocaleString("tr-TR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    const symbol = currency === "TRY" ? "₺" : currency;
    return `${formatted} ${symbol}`;
}
