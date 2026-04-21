import type { TowBid } from "@naro/domain";
import { Avatar, Button, Icon, StatusChip, Text } from "@naro/ui";
import { Clock, ShieldCheck, Star } from "lucide-react-native";
import { View } from "react-native";

import { labelForEquipment } from "../presentation";

type Props = {
  bids: TowBid[];
  onAccept: (bidId: string) => void;
  acceptedBidId?: string | null;
};

export function TowBidsList({ bids, onAccept, acceptedBidId }: Props) {
  if (bids.length === 0) {
    return (
      <View className="items-center gap-2 rounded-[22px] border border-dashed border-app-outline bg-app-surface/60 px-4 py-6">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={Clock} size={18} color="#0ea5e9" />
        </View>
        <Text variant="label" tone="inverse">
          Teklifler gelmeye başlıyor…
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-center text-[12px]">
          Bölgendeki çekici operatörleri teklif gönderiyor. İlk birkaçı birkaç saniye içinde düşecek.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {bids.map((bid) => {
        const isAccepted = acceptedBidId === bid.id;
        return (
          <View
            key={bid.id}
            className={[
              "overflow-hidden rounded-[22px] border",
              isAccepted
                ? "border-app-success/50 bg-app-success-soft"
                : "border-app-outline bg-app-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Avatar name={bid.technician.name} size="md" />
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse">
                  {bid.technician.name}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Icon icon={Star} size={11} color="#f5b33f" strokeWidth={2.5} />
                  <Text variant="caption" tone="warning" className="text-[12px]">
                    {bid.technician.rating.toFixed(1)}
                  </Text>
                  <Text variant="caption" tone="muted" className="text-[11px]">
                    · {bid.technician.completed_jobs} iş
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text variant="label" tone="accent" className="text-[15px]">
                  {bid.price_label}
                </Text>
                <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
                  {bid.eta_window_label}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap items-center gap-1.5 border-t border-app-outline px-4 py-2.5">
              <StatusChip label={labelForEquipment(bid.equipment)} tone="neutral" />
              {bid.guarantee_label ? (
                <StatusChip
                  icon={ShieldCheck}
                  label={bid.guarantee_label}
                  tone="success"
                />
              ) : null}
            </View>
            {isAccepted ? (
              <View className="flex-row items-center gap-2 border-t border-app-success/30 bg-app-surface/40 px-4 py-2.5">
                <Icon icon={ShieldCheck} size={13} color="#2dd28d" />
                <Text variant="caption" tone="success" className="text-[12px]">
                  Bu teklif seçildi — fiyat kilitlendi, randevu saatini bekliyoruz.
                </Text>
              </View>
            ) : (
              <View className="px-4 pb-3 pt-1">
                <Button
                  label="Bu teklifi seç"
                  size="md"
                  variant="primary"
                  fullWidth
                  onPress={() => onAccept(bid.id)}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
