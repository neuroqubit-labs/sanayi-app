import { Icon, Text } from "@naro/ui";
import { ChevronRight, FileText, Sparkles, CheckCircle2, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

interface ApprovalSummary {
    id: string;
    kind: "parts_request" | "invoice" | "completion";
    description?: string | null;
}

const APPROVAL_META: Record<
    ApprovalSummary["kind"],
    {
        label: string;
        icon: LucideIcon;
        iconColor: string;
        containerClass: string;
        iconBgClass: string;
        textTone: "warning" | "accent" | "success";
    }
> = {
    parts_request: {
        label: "Parça/kapsam onayı bekliyor",
        icon: Sparkles,
        iconColor: "#f5b33f",
        containerClass: "border-app-warning/40 bg-app-warning-soft",
        iconBgClass: "bg-app-warning/20",
        textTone: "warning",
    },
    invoice: {
        label: "Fatura onayı bekliyor",
        icon: FileText,
        iconColor: "#0ea5e9",
        containerClass: "border-brand-500/40 bg-brand-500/10",
        iconBgClass: "bg-brand-500/20",
        textTone: "accent",
    },
    completion: {
        label: "İş tamamlandı — son onay",
        icon: CheckCircle2,
        iconColor: "#2dd28d",
        containerClass: "border-app-success/40 bg-app-success-soft",
        iconBgClass: "bg-app-success/20",
        textTone: "success",
    },
};

interface ManagementApprovalsSectionProps {
    approvals: ApprovalSummary[];
    onApprovalPress: (id: string, kind: ApprovalSummary["kind"]) => void;
}

export function ManagementApprovalsSection({
    approvals,
    onApprovalPress,
}: ManagementApprovalsSectionProps) {
    if (approvals.length === 0) return null;

    return (
        <View className="gap-2">
            {approvals.map((approval) => {
                const meta = APPROVAL_META[approval.kind] || APPROVAL_META.parts_request;
                return (
                    <Pressable
                        key={approval.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${meta.label} onayını aç`}
                        onPress={() => onApprovalPress(approval.id, approval.kind)}
                        className={[
                            "flex-row items-center gap-3 rounded-[16px] border px-4 py-3.5 active:opacity-90",
                            meta.containerClass,
                        ].join(" ")}
                    >
                        <View
                            className={[
                                "h-9 w-9 items-center justify-center rounded-full",
                                meta.iconBgClass,
                            ].join(" ")}
                        >
                            <Icon icon={meta.icon} size={15} color={meta.iconColor} />
                        </View>
                        <View className="flex-1 gap-0.5">
                            <Text
                                variant="label"
                                tone={meta.textTone}
                                className="text-[13px]"
                            >
                                {meta.label}
                            </Text>
                            {approval.description ? (
                                <Text
                                    variant="caption"
                                    tone="muted"
                                    className="text-app-text-muted text-[11px]"
                                    numberOfLines={1}
                                >
                                    {approval.description}
                                </Text>
                            ) : null}
                        </View>
                        <Icon icon={ChevronRight} size={14} color="#83a7ff" />
                    </Pressable>
                );
            })}
        </View>
    );
}
