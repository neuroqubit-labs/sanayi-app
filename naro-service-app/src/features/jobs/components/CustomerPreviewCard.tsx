import type { ServiceCase } from "@naro/domain";
import { Avatar, Icon, Text, TrustBadge } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { Car, MessageSquare, User } from "lucide-react-native";
import { Pressable, View } from "react-native";

type CustomerPreviewCardProps = {
  caseItem: ServiceCase;
  customerName: string;
  previousCaseCount?: number;
};

/**
 * Ustanın vaka sahibini tanımasını sağlayan compact müşteri kartı.
 * Anti-disintermediation: telefon/email gizli; iletişim sadece thread üzerinden.
 */
export function CustomerPreviewCard({
  caseItem,
  customerName,
  previousCaseCount = 0,
}: CustomerPreviewCardProps) {
  const router = useRouter();

  const maskedName = maskName(customerName);

  return (
    <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center gap-3">
        <Avatar name={customerName} size="md" />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Icon icon={User} size={12} color="#83a7ff" />
            <Text variant="label" tone="inverse" className="text-[14px]">
              {maskedName}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Icon icon={Car} size={11} color="#6b7280" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px]"
              numberOfLines={1}
            >
              {caseItem.subtitle}
            </Text>
          </View>
        </View>
        {previousCaseCount > 0 ? (
          <TrustBadge
            label={`${previousCaseCount}. vaka`}
            tone="accent"
          />
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Müşteriyle mesajlaş"
        onPress={() =>
          router.push(`/is/${caseItem.id}/mesajlar` as Href)
        }
        className="flex-row items-center gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2 active:bg-app-surface"
      >
        <Icon icon={MessageSquare} size={14} color="#83a7ff" />
        <Text variant="label" tone="inverse" className="flex-1 text-[12px]">
          Müşteriyle mesajlaş
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[10px]"
        >
          Platform thread
        </Text>
      </Pressable>
    </View>
  );
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Müşteri";
  if (parts.length === 1) {
    const [first] = parts;
    if (!first) return "Müşteri";
    return `${first.charAt(0).toUpperCase()}${first.slice(1, 3).toLowerCase()}***`;
  }
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}
