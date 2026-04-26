import type { ServiceCaseStatus, ServiceRequestKind } from "@naro/domain";
import { StatusChip, Surface, Text, TrustBadge } from "@naro/ui";
import { View } from "react-native";

import { getCaseKindLabel, getCaseStatusLabel, getCaseStatusTone } from "../../presentation";

interface ManagementHeaderProps {
    kind: ServiceRequestKind;
    status: ServiceCaseStatus;
    title: string;
    createdAtLabel: string;
    id: string;
}

export function ManagementHeader({
    kind,
    status,
    title,
    createdAtLabel,
    id,
}: ManagementHeaderProps) {
    return (
        <Surface
            variant="raised"
            radius="lg"
            className="gap-3 border-app-outline-strong bg-app-surface-2 px-4 py-4"
        >
            <View className="flex-row flex-wrap items-center gap-2">
                <TrustBadge label={getCaseKindLabel(kind as any)} tone="accent" />
                <StatusChip
                    label={getCaseStatusLabel(status)}
                    tone={getCaseStatusTone(status)}
                />
            </View>
            <Text variant="display" tone="inverse" className="text-[20px] leading-[24px]">
                {title}
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-subtle text-[11px]">
                {`Oluşturuldu · ${createdAtLabel} · #${id.slice(0, 8)}`}
            </Text>
        </Surface>
    );
}
