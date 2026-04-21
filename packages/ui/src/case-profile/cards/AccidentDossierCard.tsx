import { AlertTriangle, PhoneCall, Users } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { StatusChip } from "../../StatusChip";
import { Text } from "../../Text";
import { TrustBadge } from "../../TrustBadge";
import { CollapsibleSection } from "../CollapsibleSection";
import { DAMAGE_AREA_LABEL } from "../kind-meta";

import type { CaseCard, CaseProfileContext } from "./types";

export const accidentDossierCard: CaseCard = {
  id: "accident-dossier",
  appliesTo: ["accident"],
  priority: 40,
  shouldShow: ({ caseItem }) => {
    const d = caseItem.request;
    return Boolean(
      d.damage_area ||
        d.counterparty_note ||
        d.counterparty_vehicle_count ||
        d.ambulance_contacted ||
        d.emergency_acknowledged,
    );
  },
  render: ({ caseItem }: CaseProfileContext) => {
    const d = caseItem.request;
    const damageLabel = d.damage_area
      ? DAMAGE_AREA_LABEL[d.damage_area] ?? d.damage_area
      : null;
    const chips: { label: string; tone: "critical" | "warning" | "info" }[] = [];
    if (damageLabel) chips.push({ label: damageLabel, tone: "critical" });
    if (d.counterparty_vehicle_count) {
      chips.push({
        label: `${d.counterparty_vehicle_count} araç karıştı`,
        tone: "warning",
      });
    }
    if (d.ambulance_contacted)
      chips.push({ label: "Ambulans arandı", tone: "critical" });

    return (
      <CollapsibleSection
        title="Kaza dosyası"
        accent="#ff7e7e"
        titleIcon={AlertTriangle}
        description="Hasar bölgesi, karşı taraf, acil durum notu"
        preview={
          chips.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {chips.slice(0, 3).map((c) => (
                <StatusChip key={c.label} label={c.label} tone={c.tone} />
              ))}
            </View>
          ) : null
        }
      >
        <View className="gap-3">
          {damageLabel ? (
            <DetailRow
              icon={AlertTriangle}
              iconColor="#ff7e7e"
              label="Hasar bölgesi"
              value={damageLabel}
            />
          ) : null}
          {d.counterparty_vehicle_count || d.counterparty_note ? (
            <DetailRow
              icon={Users}
              iconColor="#83a7ff"
              label="Karşı taraf"
              value={
                [
                  d.counterparty_vehicle_count
                    ? `${d.counterparty_vehicle_count} araç karıştı`
                    : null,
                  d.counterparty_note,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
            />
          ) : null}
          {d.ambulance_contacted ? (
            <DetailRow
              icon={PhoneCall}
              iconColor="#ff7e7e"
              label="Ambulans"
              value="112 arandı"
            />
          ) : null}
          {d.emergency_acknowledged && !d.ambulance_contacted ? (
            <View className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2">
              <TrustBadge label="Acil durum onayı" tone="accent" />
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    );
  },
};

function DetailRow({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: typeof AlertTriangle;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-start gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={icon} size={13} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[10px]"
        >
          {label}
        </Text>
        <Text variant="label" tone="inverse" className="text-[13px]">
          {value}
        </Text>
      </View>
    </View>
  );
}
