import { Button, Surface, Text } from "@naro/ui";

interface ManagementHazardZoneProps {
    onCancelPress: () => void;
}

export function ManagementHazardZone({
    onCancelPress,
}: ManagementHazardZoneProps) {
    return (
        <Surface
            variant="flat"
            radius="lg"
            className="mt-4 gap-3 border-app-critical/30 px-4 py-4"
        >
            <Text variant="eyebrow" tone="critical">
                Tehlikeli bölge
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted leading-5">
                Vakayı iptal edersen aktif teklif ve randevu düşer. Geri alma yok.
            </Text>
            <Button
                label="Vakayı iptal et"
                variant="outline"
                onPress={onCancelPress}
            />
        </Surface>
    );
}
