import type { CaseOffer } from "@naro/domain";
import { Avatar, Button, MetricPill, Text, TrustBadge } from "@naro/ui";
import { View } from "react-native";

import { mockTechnicianProfiles } from "@/features/ustalar/data/fixtures";

type CaseOfferCardProps = {
  offer: CaseOffer;
  hasAcceptedOffer: boolean;
  actionsLocked?: boolean;
  onSelect: () => void;
  onShortlist: () => void;
  onReject: () => void;
};

export function CaseOfferCard({
  offer,
  hasAcceptedOffer,
  actionsLocked = false,
  onSelect,
  onShortlist,
  onReject,
}: CaseOfferCardProps) {
  const technician = mockTechnicianProfiles.find(
    (profile) => profile.id === offer.technician_id,
  );

  const isAccepted = offer.status === "accepted";
  const isRejected = offer.status === "rejected";
  const isShortlisted = offer.status === "shortlisted";
  const canMutate =
    !isAccepted && !isRejected && !hasAcceptedOffer && !actionsLocked;

  return (
    <View
      className={[
        "gap-4 rounded-[28px] border px-4 py-4",
        isAccepted
          ? "border-app-success/40 bg-app-success-soft"
          : isRejected
            ? "border-app-outline bg-app-surface"
            : isShortlisted
              ? "border-brand-500/50 bg-brand-500/10"
              : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View className="flex-row items-start gap-3">
        <Avatar name={technician?.name} size="lg" />
        <View className="flex-1 gap-2">
          <View className="gap-1">
            <Text variant="h3" tone="inverse">
              {technician?.name ?? "Servis"}
            </Text>
            <Text tone="muted" className="text-app-text-muted">
              {offer.headline}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {(offer.badges.length ? offer.badges : ["Teklif hazir"]).map(
              (badge) => (
                <TrustBadge
                  key={badge}
                  label={badge}
                  tone={
                    isAccepted ? "success" : isShortlisted ? "accent" : "info"
                  }
                />
              ),
            )}
          </View>
        </View>
      </View>

      <Text tone="muted" className="text-app-text-muted">
        {offer.description}
      </Text>

      <View className="flex-row gap-3">
        <MetricPill value={offer.price_label} label="Toplam" />
        <MetricPill value={offer.eta_label} label="Tahmini süre" />
        <MetricPill value={offer.delivery_mode} label="Teslim modu" />
      </View>

      <View className="gap-1">
        <Text variant="caption" tone="subtle">
          Garanti
        </Text>
        <Text variant="label" tone="inverse">
          {offer.warranty_label}
        </Text>
      </View>

      {actionsLocked ? (
        <View className="rounded-[22px] border border-app-outline bg-app-surface-2 px-4 py-4">
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Karar penceresi kapali. Bu teklif su an sadece referans olarak gorunur.
          </Text>
        </View>
      ) : (
        <>
          <View className="flex-row gap-3">
            <Button
              label={
                isAccepted
                  ? "Seçildi"
                  : isRejected
                    ? "Elendi"
                    : "Bu teklifle Randevu Al"
              }
              variant={isAccepted ? "surface" : "primary"}
              fullWidth
              className="flex-1"
              disabled={isAccepted || isRejected || hasAcceptedOffer}
              onPress={onSelect}
            />
            <Button
              label={isShortlisted ? "Shortlist'te" : "Shortlist'e al"}
              variant={isShortlisted ? "surface" : "outline"}
              fullWidth
              className="flex-1"
              disabled={isAccepted || isRejected || hasAcceptedOffer}
              onPress={onShortlist}
            />
          </View>

          <Button
            label="Ele"
            variant="outline"
            fullWidth
            className="self-stretch"
            disabled={!canMutate}
            onPress={onReject}
          />
        </>
      )}

      {isRejected ? (
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          Bu teklif elendi; karsilastirma disinda tutuluyor.
        </Text>
      ) : null}

      {isShortlisted ? (
        <Text variant="caption" tone="accent">
          Bu servis karar listesinde one cikiyor.
        </Text>
      ) : null}

      {isAccepted ? (
        <Text variant="caption" tone="success">
          Bu teklif secildi; randevu baglami olustu.
        </Text>
      ) : null}
    </View>
  );
}
