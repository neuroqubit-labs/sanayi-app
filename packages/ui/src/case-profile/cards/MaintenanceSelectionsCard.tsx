import type { ServiceCase } from "@naro/domain";
import { CheckCircle2, Sparkles } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { StatusChip } from "../../StatusChip";
import { Text } from "../../Text";
import { CollapsibleSection } from "../CollapsibleSection";

import type { CaseCard } from "./types";

const MAINTENANCE_CATEGORY_LABEL: Record<string, string> = {
  periodic: "Periyodik bakım",
  tire: "Lastik",
  glass_film: "Cam filmi",
  coating: "Kaplama",
  battery: "Akü",
  climate: "Klima bakımı",
  brake: "Fren bakımı",
  detail_wash: "Detaylı yıkama",
  headlight_polish: "Far polisaj",
  engine_wash: "Motor yıkama",
  package_summer: "Yaz paketi",
  package_winter: "Kış paketi",
  package_new_car: "Yeni araç paketi",
  package_sale_prep: "Satış öncesi paket",
};

export const maintenanceSelectionsCard: CaseCard = {
  id: "maintenance-selections",
  appliesTo: ["maintenance"],
  priority: 40,
  shouldShow: ({ caseItem }) => Boolean(caseItem.request.maintenance_category),
  render: ({ caseItem }) => {
    const d = caseItem.request;
    const categoryLabel = d.maintenance_category
      ? MAINTENANCE_CATEGORY_LABEL[d.maintenance_category] ?? d.maintenance_category
      : null;
    const grouped = groupMaintenanceItems(d.maintenance_items);
    const totalItems = d.maintenance_items.length;

    return (
      <CollapsibleSection
        title="Bakım seçimleri"
        accent="#2dd28d"
        titleIcon={Sparkles}
        description="Kategori, kapsam ve tercihler"
        preview={
          <View className="flex-row flex-wrap gap-1.5">
            {categoryLabel ? (
              <StatusChip label={categoryLabel} tone="success" />
            ) : null}
            {d.maintenance_tier ? (
              <StatusChip label={d.maintenance_tier} tone="accent" />
            ) : null}
            {totalItems > 0 ? (
              <StatusChip label={`${totalItems} seçim`} tone="neutral" />
            ) : null}
          </View>
        }
      >
        <View className="gap-3">
          <View className="flex-row items-center gap-3 rounded-[14px] border border-app-success/30 bg-app-success-soft px-3 py-2.5">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-app-success/20">
              <Icon icon={Sparkles} size={14} color="#2dd28d" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse" className="text-[13px]">
                {categoryLabel ?? "Bakım"}
              </Text>
              {d.maintenance_tier ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[11px]"
                >
                  Paket: {d.maintenance_tier}
                </Text>
              ) : null}
            </View>
          </View>

          {grouped.length > 0 ? (
            <View className="gap-2.5">
              {grouped.map((group) => (
                <View key={group.prefix} className="gap-1.5">
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-subtle text-[10px] uppercase"
                  >
                    {group.prefix}
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {group.options.map((option) => (
                      <View
                        key={option}
                        className="flex-row items-center gap-1 rounded-full border border-app-outline bg-app-surface px-2.5 py-1"
                      >
                        <Icon icon={CheckCircle2} size={10} color="#2dd28d" />
                        <Text
                          variant="caption"
                          tone="inverse"
                          className="text-[11px]"
                        >
                          {option}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    );
  },
};

type Group = { prefix: string; options: string[] };

function groupMaintenanceItems(items: ServiceCase["request"]["maintenance_items"]): Group[] {
  const map = new Map<string, string[]>();
  for (const entry of items) {
    const idx = entry.indexOf(":");
    const prefix = idx >= 0 ? entry.slice(0, idx) : "diğer";
    const value = idx >= 0 ? entry.slice(idx + 1) : entry;
    const existing = map.get(prefix) ?? [];
    existing.push(value);
    map.set(prefix, existing);
  }
  return Array.from(map.entries()).map(([prefix, options]) => ({ prefix, options }));
}
