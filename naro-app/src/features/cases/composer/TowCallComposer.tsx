import type {
  LatLng,
  ServiceRequestDraft,
  TowIncidentReason,
  TowVehicleEquipment,
} from "@naro/domain";
import {
  Button,
  FieldInput,
  Icon,
  IconButton,
  Text,
  ToggleChip,
  useNaroTheme,
  withAlphaHex,
} from "@naro/ui";
import * as Location from "expo-location";
import {
  AlertCircle,
  CalendarClock,
  CarFront,
  ChevronDown,
  ChevronUp,
  CircleDot,
  CreditCard,
  MapPin,
  Navigation,
  ShieldCheck,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTowFareQuotePreview } from "@/features/tow/api";
import type { TowFareQuoteRequest } from "@/features/tow/schemas";
import type { Vehicle } from "@/features/vehicles/types";

import { TowCallMap } from "./TowCallMap";

type TowCallComposerProps = {
  draft: ServiceRequestDraft;
  activeVehicle: Vehicle;
  updateDraft: (patch: Partial<ServiceRequestDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
  onResetSubmitError?: () => void;
  onOpenVehicleSwitcher: () => void;
  loading?: boolean;
  error?: Error | null;
};

type RoutePoint = "pickup" | "dropoff";
type TowCallStep = "select_pickup" | "select_dropoff" | "confirm";

const TIME_WINDOWS = [
  "Bugün öğleden sonra",
  "Bugün akşam",
  "Yarın sabah",
  "Yarın öğleden sonra",
];

const INCIDENT_OPTIONS: {
  id: TowIncidentReason;
  label: string;
  drivable: boolean;
}[] = [
  { id: "not_running", label: "Çalışmıyor", drivable: false },
  { id: "accident", label: "Kaza/hasar", drivable: false },
  { id: "flat_tire", label: "Lastik", drivable: false },
  { id: "battery", label: "Akü", drivable: false },
  { id: "other", label: "Diğer", drivable: true },
];

const EQUIPMENT_OPTIONS: { id: TowVehicleEquipment; label: string }[] = [
  { id: "flatbed", label: "Platform" },
  { id: "hook", label: "Kanca" },
  { id: "wheel_lift", label: "Tekerlek" },
];

function routeValue(label: string | undefined | null, fallback: string) {
  const trimmed = (label ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function hasRouteLabel(label: string | undefined | null) {
  return (label ?? "").trim().length >= 3;
}

function formatCurrency(amount: string | null | undefined) {
  const value = Number(amount ?? "");
  if (!Number.isFinite(value) || value <= 0) return "Rota seçilince";
  return new Intl.NumberFormat("tr-TR", {
    currency: "TRY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDistance(distance: string | null | undefined) {
  const value = Number(distance ?? "");
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${Math.max(1, Math.round(value))} km`;
}

function mapSelectedLabel(point: RoutePoint) {
  return point === "pickup"
    ? "Araç konumu seçildi"
    : "Teslim noktası seçildi";
}

function resolveTowCallStep(
  pickupReady: boolean,
  dropoffReady: boolean,
): TowCallStep {
  if (!pickupReady) return "select_pickup";
  if (!dropoffReady) return "select_dropoff";
  return "confirm";
}

async function readGps() {
  const current = await Location.getForegroundPermissionsAsync();
  const permission =
    current.status === "granted"
      ? current
      : await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Konum izni verilmedi.");
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

export function TowCallComposer({
  draft,
  activeVehicle,
  updateDraft,
  onClose,
  onSubmit,
  onResetSubmitError,
  onOpenVehicleSwitcher,
  loading = false,
  error = null,
}: TowCallComposerProps) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useNaroTheme();
  const [activePoint, setActivePoint] = useState<RoutePoint>("pickup");
  const [mapPicking, setMapPicking] = useState(false);
  const [mapCandidate, setMapCandidate] = useState<LatLng | null>(null);
  const [mapInitialCenter, setMapInitialCenter] = useState<LatLng | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const pickupCoord = draft.location_lat_lng ?? null;
  const dropoffCoord = draft.dropoff_lat_lng ?? null;
  const urgent = draft.urgency === "urgent";
  const selectedEquipment = draft.tow_required_equipment[0] ?? "flatbed";
  const selectedIncidentReason = draft.tow_incident_reason ?? "not_running";
  const pickupLabel = routeValue(
    draft.location_label,
    "Aracın bulunduğu noktayı seç",
  );
  const dropoffLabel = routeValue(
    draft.dropoff_label,
    "Gideceği noktayı seç",
  );
  const pickupReady = Boolean(pickupCoord) && hasRouteLabel(draft.location_label);
  const dropoffReady =
    Boolean(dropoffCoord) && hasRouteLabel(draft.dropoff_label);
  const callStep = resolveTowCallStep(pickupReady, dropoffReady);
  const isConfirmStep = callStep === "confirm";
  const actionPoint: RoutePoint = !pickupReady
    ? "pickup"
    : !dropoffReady
      ? "dropoff"
      : activePoint;

  useEffect(() => {
    if (mapPicking) return;
    if (!pickupReady && activePoint !== "pickup") {
      setActivePoint("pickup");
      return;
    }
    if (pickupReady && !dropoffReady && activePoint !== "dropoff") {
      setActivePoint("dropoff");
    }
  }, [activePoint, dropoffReady, mapPicking, pickupReady]);

  useEffect(() => {
    if (
      draft.tow_incident_reason === "not_running" &&
      (draft.vehicle_drivable === null ||
        typeof draft.vehicle_drivable === "undefined")
    ) {
      updateDraft({ vehicle_drivable: false });
    }
  }, [draft.tow_incident_reason, draft.vehicle_drivable, updateDraft]);

  const quotePayload = useMemo<TowFareQuoteRequest | null>(() => {
    if (!pickupCoord || !dropoffCoord || !pickupReady || !dropoffReady) {
      return null;
    }
    return {
      mode: urgent ? "immediate" : "scheduled",
      pickup_lat_lng: pickupCoord,
      dropoff_lat_lng: dropoffCoord,
      required_equipment: [selectedEquipment],
      urgency_bump: urgent,
    };
  }, [
    dropoffCoord,
    dropoffReady,
    pickupCoord,
    pickupReady,
    selectedEquipment,
    urgent,
  ]);
  const quoteQuery = useTowFareQuotePreview(quotePayload);
  const quote = quoteQuery.data;
  const fareLabel = formatCurrency(quote?.quote.cap_amount);
  const distanceLabel = formatDistance(
    quote?.distance_km ?? quote?.quote.distance_km,
  );

  useEffect(() => {
    setSubmitAttempted(false);
  }, [draft.tow_incident_reason, dropoffCoord, pickupCoord]);

  const validationMessage =
    !pickupReady
      ? "Alım konumunu seç."
      : !dropoffReady
        ? "Teslim noktasını seç."
        : null;
  const shownError =
    localError ??
    (submitAttempted ? error?.message : null) ??
    (quoteQuery.isError ? "Ücret alınamadı. Tekrar deneyebilirsin." : null);
  const canRetryQuote = Boolean(!validationMessage && quoteQuery.isError);
  const primaryDisabled =
    Boolean(validationMessage) ||
    quoteQuery.isFetching ||
    (!quote && !canRetryQuote);
  const primaryLoading =
    loading || Boolean(!quote && !quoteQuery.isError && quoteQuery.isFetching);

  const updateRoutePoint = (
    point: RoutePoint,
    coord: LatLng,
    label?: string,
  ) => {
    updateDraft(
      point === "pickup"
        ? {
            location_lat_lng: coord,
            location_label: label ?? mapSelectedLabel(point),
          }
        : {
            dropoff_lat_lng: coord,
            dropoff_label: label ?? mapSelectedLabel(point),
          },
    );
    setLocalError(null);
    onResetSubmitError?.();
    setMapPicking(false);
    setMapInitialCenter(null);
    setActivePoint(
      point === "pickup" && !dropoffReady
        ? "dropoff"
        : point === "dropoff" && !pickupReady
          ? "pickup"
          : point,
    );
  };

  const startMapPick = (point: RoutePoint) => {
    setSubmitAttempted(false);
    onResetSubmitError?.();
    setActivePoint(point);
    setMapPicking(true);
    setMapCandidate(point === "pickup" ? pickupCoord : dropoffCoord);
    setMapInitialCenter(
      point === "pickup"
        ? (pickupCoord ?? dropoffCoord)
        : (dropoffCoord ?? pickupCoord),
    );
    if (!pickupCoord && !dropoffCoord) {
      void Location.getLastKnownPositionAsync().then((position) => {
        if (!position) return;
        setMapInitialCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
    setLocalError(null);
    setDetailsOpen(false);
  };

  const confirmMapPick = () => {
    if (!mapCandidate) {
      setLocalError("Haritada bir nokta seç.");
      return;
    }
    updateRoutePoint(activePoint, mapCandidate);
  };

  const useCurrentLocation = async () => {
    try {
      setGpsLoading(true);
      const coord = await readGps();
      updateRoutePoint("pickup", coord, "Mevcut konumum");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Konum alınamadı.");
    } finally {
      setGpsLoading(false);
    }
  };

  const chooseIncident = (reason: TowIncidentReason, drivable: boolean) => {
    onResetSubmitError?.();
    updateDraft({
      tow_incident_reason: reason,
      vehicle_drivable: drivable,
    });
  };

  const setUrgentMode = (nextUrgent: boolean) => {
    onResetSubmitError?.();
    updateDraft({
      urgency: nextUrgent ? "urgent" : "today",
      tow_mode: nextUrgent ? "immediate" : "scheduled",
      ...(nextUrgent
        ? { preferred_window: undefined, tow_scheduled_at: undefined }
        : {}),
    });
  };

  const handlePrimaryPress = () => {
    if (canRetryQuote) {
      void quoteQuery.refetch();
      return;
    }
    setSubmitAttempted(true);
    onSubmit();
  };

  return (
    <View className="flex-1 bg-app-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TowCallMap
          pickup={pickupCoord}
          dropoff={dropoffCoord}
          routeCoords={quote?.route_coords ?? null}
          activePoint={mapPicking ? activePoint : actionPoint}
          picking={mapPicking}
          selectionCenter={mapInitialCenter}
          gpsLoading={gpsLoading}
          onUseGps={useCurrentLocation}
          onMapPress={setMapCandidate}
          onCenterChange={setMapCandidate}
        />

        <View
          className="absolute left-0 right-0 top-0 flex-row items-center gap-3 px-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <IconButton
            label="Kapat"
            variant="surface"
            icon={<Icon icon={X} size={18} color={colors.text} />}
            onPress={onClose}
          />
          <View className="flex-1">
            <Text variant="caption" tone="muted" className="text-[11px]">
              Hızlı çekici
            </Text>
            <Text variant="h3" tone="inverse" className="text-[20px]">
              Çekici çağır
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Aracı değiştir — ${activeVehicle.plate}`}
            hitSlop={8}
            onPress={onOpenVehicleSwitcher}
            className="min-h-11 flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-3 active:bg-app-surface-2"
          >
            <Icon icon={CarFront} size={13} color={colors.info} />
            <Text variant="label" tone="inverse" className="text-[12px]">
              {activeVehicle.plate}
            </Text>
            <Icon icon={ChevronDown} size={12} color={colors.textSubtle} />
          </Pressable>
        </View>

        <View
          className="absolute bottom-0 left-0 right-0 px-3"
          style={{ paddingBottom: insets.bottom + 10 }}
        >
          <View
            className="gap-2.5 rounded-[28px] border border-app-outline px-4 py-3.5"
            style={{
              backgroundColor: withAlphaHex(
                colors.surface,
                scheme === "dark" ? 0.94 : 0.96,
              ),
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: scheme === "dark" ? 0.34 : 0.18,
              shadowRadius: 24,
              elevation: 18,
            }}
          >
            {mapPicking ? (
              <MapPickingPanel
                activePoint={activePoint}
                candidateReady={Boolean(mapCandidate)}
                onCancel={() => {
                  setMapPicking(false);
                  setMapInitialCenter(null);
                  setLocalError(null);
                }}
                onConfirm={confirmMapPick}
              />
            ) : (
              <>
                <StepHeader step={callStep} />
                <RouteSelector
                  activePoint={actionPoint}
                  pickupLabel={pickupLabel}
                  dropoffLabel={dropoffLabel}
                  pickupReady={pickupReady}
                  dropoffReady={dropoffReady}
                  compact={!isConfirmStep}
                  onPressPickup={() => startMapPick("pickup")}
                  onPressDropoff={() => {
                    if (!pickupReady) {
                      setActivePoint("pickup");
                      setLocalError("Önce aracın konumunu seç.");
                      setDetailsOpen(false);
                      return;
                    }
                    startMapPick("dropoff");
                  }}
                />

                {callStep === "select_pickup" ? (
                  <PickupStepActions
                    gpsLoading={gpsLoading}
                    shownError={shownError}
                    onUseCurrentLocation={useCurrentLocation}
                    onPickOnMap={() => startMapPick("pickup")}
                  />
                ) : null}

                {callStep === "select_dropoff" ? (
                  <DropoffStepActions
                    shownError={shownError}
                    onPickOnMap={() => startMapPick("dropoff")}
                  />
                ) : null}

                {isConfirmStep ? (
                  <>
                    <View className="gap-2">
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-[11px]"
                      >
                        Araç durumu
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {INCIDENT_OPTIONS.map((option) => (
                          <ToggleChip
                            key={option.id}
                            label={option.label}
                            selected={selectedIncidentReason === option.id}
                            onPress={() =>
                              chooseIncident(option.id, option.drivable)
                            }
                          />
                        ))}
                      </View>
                    </View>

                    <View className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface-2 px-3.5 py-3">
                      <View
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: withAlphaHex(colors.info, 0.14),
                        }}
                      >
                        <Icon icon={CreditCard} size={18} color={colors.info} />
                      </View>
                      <View className="flex-1">
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-[11px]"
                        >
                          En fazla
                        </Text>
                        <Text
                          variant="h3"
                          tone="inverse"
                          className="text-[22px]"
                        >
                          {quoteQuery.isFetching ? "Hesaplanıyor" : fareLabel}
                        </Text>
                      </View>
                      <View className="items-end gap-1">
                        <Icon
                          icon={ShieldCheck}
                          size={18}
                          color={colors.success}
                        />
                        {distanceLabel ? (
                          <Text
                            variant="caption"
                            tone="muted"
                            className="text-[11px]"
                          >
                            {distanceLabel}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        detailsOpen ? "Ayrıntıları gizle" : "Ayrıntı ekle"
                      }
                      hitSlop={6}
                      onPress={() => setDetailsOpen((current) => !current)}
                      className="min-h-11 flex-row items-center justify-between rounded-[16px] px-1 active:opacity-80"
                    >
                      <View className="flex-row items-center gap-2">
                        <Icon
                          icon={Wrench}
                          size={15}
                          color={colors.textSubtle}
                        />
                        <Text
                          variant="label"
                          tone="muted"
                          className="text-[13px]"
                        >
                          Ayrıntı ekle
                        </Text>
                      </View>
                      <Icon
                        icon={detailsOpen ? ChevronUp : ChevronDown}
                        size={16}
                        color={colors.textSubtle}
                      />
                    </Pressable>

                    {detailsOpen ? (
                      <DetailsPanel
                        urgent={urgent}
                        selectedEquipment={selectedEquipment}
                        draft={draft}
                        updateDraft={updateDraft}
                        onSetUrgentMode={setUrgentMode}
                      />
                    ) : null}

                    {shownError || validationMessage ? (
                      <View className="flex-row items-center gap-2">
                        <Icon
                          icon={AlertCircle}
                          size={15}
                          color={
                            shownError ? colors.critical : colors.warning
                          }
                        />
                        <Text
                          variant="caption"
                          tone={shownError ? "critical" : "warning"}
                          className="flex-1 text-[12px]"
                        >
                          {shownError ?? validationMessage}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-[12px]"
                      >
                        Yakındaki çekiciler çember genişletilerek aranır. Tavan
                        ücret teslim sonrası aşılmaz.
                      </Text>
                    )}

                    <Button
                      label={
                        canRetryQuote
                          ? "Ücreti tekrar dene"
                          : urgent
                            ? "Çekiciyi çağır"
                            : "Çekiciyi planla"
                      }
                      size="xl"
                      fullWidth
                      loading={primaryLoading}
                      disabled={primaryDisabled}
                      onPress={handlePrimaryPress}
                    />
                  </>
                ) : null}
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

type MapPickingPanelProps = {
  activePoint: RoutePoint;
  candidateReady: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function MapPickingPanel({
  activePoint,
  candidateReady,
  onCancel,
  onConfirm,
}: MapPickingPanelProps) {
  const { colors } = useNaroTheme();
  const isPickup = activePoint === "pickup";
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: withAlphaHex(
              isPickup ? colors.success : colors.info,
              0.14,
            ),
          }}
        >
          <Icon
            icon={isPickup ? CircleDot : MapPin}
            size={18}
            color={isPickup ? colors.success : colors.info}
          />
        </View>
        <View className="flex-1">
          <Text variant="h3" tone="inverse" className="text-[18px]">
            {isPickup ? "Alım noktası seçiliyor" : "Teslim noktası seçiliyor"}
          </Text>
          <Text variant="caption" tone="muted" className="text-[12px]">
            Haritayı hareket ettir, pini doğru konuma getir.
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button
          label="Vazgeç"
          variant="surface"
          size="md"
          fullWidth
          onPress={onCancel}
          className="flex-1"
        />
        <Button
          label="Bu noktayı kullan"
          size="md"
          fullWidth
          disabled={!candidateReady}
          onPress={onConfirm}
          className="flex-[1.35]"
        />
      </View>
    </View>
  );
}

type StepHeaderProps = {
  step: TowCallStep;
};

function StepHeader({ step }: StepHeaderProps) {
  const copy =
    step === "select_pickup"
      ? {
          eyebrow: "1 / 3",
          title: "Araç nerede?",
          body: "Konumunu kullan ya da haritada aracın durduğu noktayı seç.",
        }
      : step === "select_dropoff"
        ? {
            eyebrow: "2 / 3",
            title: "Nereye götürülsün?",
            body: "Teslim noktasını haritada seç. Ücret bu rota üzerinden hesaplanır.",
          }
        : {
            eyebrow: "3 / 3",
            title: "Çağırmaya hazır",
            body: "Araç durumunu kontrol et, tavan ücreti gör ve çekiciyi çağır.",
          };
  return (
    <View className="gap-0.5">
      <Text variant="caption" tone="muted" className="text-[11px]">
        {copy.eyebrow}
      </Text>
      <Text variant="h3" tone="inverse" className="text-[18px]">
        {copy.title}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        numberOfLines={2}
        className="text-[12px]"
      >
        {copy.body}
      </Text>
    </View>
  );
}

type PickupStepActionsProps = {
  gpsLoading: boolean;
  shownError: string | null | undefined;
  onUseCurrentLocation: () => void;
  onPickOnMap: () => void;
};

function PickupStepActions({
  gpsLoading,
  shownError,
  onUseCurrentLocation,
  onPickOnMap,
}: PickupStepActionsProps) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Button
          label={gpsLoading ? "Bulunuyor" : "Konumum"}
          variant="surface"
          size="md"
          loading={gpsLoading}
          fullWidth
          leftIcon={<Icon icon={Zap} size={14} color={colors.info} />}
          onPress={onUseCurrentLocation}
          className="flex-1"
        />
        <Button
          label="Haritada seç"
          size="md"
          fullWidth
          leftIcon={<Icon icon={MapPin} size={14} color={colors.surface} />}
          onPress={onPickOnMap}
          className="flex-1"
        />
      </View>
      <StepMessage error={shownError} message="Sonra teslim noktasını seçeceğiz." />
    </View>
  );
}

type DropoffStepActionsProps = {
  shownError: string | null | undefined;
  onPickOnMap: () => void;
};

function DropoffStepActions({
  shownError,
  onPickOnMap,
}: DropoffStepActionsProps) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-2">
      <Button
        label="Teslim noktasını seç"
        size="md"
        fullWidth
        leftIcon={<Icon icon={Navigation} size={14} color={colors.surface} />}
        onPress={onPickOnMap}
      />
      <StepMessage
        error={shownError}
        message="Teslim adresini haritada işaretle; fiyat rota üzerinden hesaplanır."
      />
    </View>
  );
}

type StepMessageProps = {
  error?: string | null;
  message: string;
};

function StepMessage({ error, message }: StepMessageProps) {
  const { colors } = useNaroTheme();
  if (error) {
    return (
      <View className="flex-row items-center gap-2">
        <Icon icon={AlertCircle} size={15} color={colors.critical} />
        <Text variant="caption" tone="critical" className="flex-1 text-[12px]">
          {error}
        </Text>
      </View>
    );
  }
  return (
    <Text variant="caption" tone="muted" className="text-[12px]">
      {message}
    </Text>
  );
}

type RouteSelectorProps = {
  activePoint: RoutePoint;
  pickupLabel: string;
  dropoffLabel: string;
  pickupReady: boolean;
  dropoffReady: boolean;
  compact?: boolean;
  onPressPickup: () => void;
  onPressDropoff: () => void;
};

function RouteSelector({
  activePoint,
  pickupLabel,
  dropoffLabel,
  pickupReady,
  dropoffReady,
  compact = false,
  onPressPickup,
  onPressDropoff,
}: RouteSelectorProps) {
  return (
    <View
      className={[
        "gap-1 rounded-[24px] border border-app-outline bg-app-surface-2",
        compact ? "p-1.5" : "p-2",
      ].join(" ")}
    >
      <RouteRow
        eyebrow="ALIM"
        title="Aracın bulunduğu yer"
        value={pickupLabel}
        ready={pickupReady}
        active={activePoint === "pickup"}
        icon={CircleDot}
        tone="pickup"
        compact={compact}
        onPress={onPressPickup}
      />
      <View className="mx-3 h-px bg-app-outline" />
      <RouteRow
        eyebrow="TESLİM"
        title="Gideceği yer"
        value={dropoffLabel}
        ready={dropoffReady}
        active={activePoint === "dropoff"}
        icon={MapPin}
        tone="dropoff"
        compact={compact}
        onPress={onPressDropoff}
      />
    </View>
  );
}

type RouteRowProps = {
  eyebrow: string;
  title: string;
  value: string;
  ready: boolean;
  active: boolean;
  icon: LucideIcon;
  tone: RoutePoint;
  compact: boolean;
  onPress: () => void;
};

function RouteRow({
  eyebrow,
  title,
  value,
  ready,
  active,
  icon,
  tone,
  compact,
  onPress,
}: RouteRowProps) {
  const { colors } = useNaroTheme();
  const accent = tone === "pickup" ? colors.success : colors.info;
  const color = ready || active ? accent : colors.textSubtle;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow} seç`}
      hitSlop={8}
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] px-3 active:opacity-80",
        compact ? "min-h-[56px] py-1" : "min-h-[76px] py-2",
      ].join(" ")}
      style={{
        backgroundColor: active ? withAlphaHex(accent, 0.08) : "transparent",
        borderColor: active ? withAlphaHex(accent, 0.28) : "transparent",
        borderWidth: 1,
      }}
    >
      <View
        className={[
          "items-center justify-center rounded-full",
          compact ? "h-9 w-9" : "h-10 w-10",
        ].join(" ")}
        style={{ backgroundColor: withAlphaHex(color, 0.14) }}
      >
        <Icon icon={icon} size={compact ? 15 : 17} color={color} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          variant="caption"
          tone="muted"
          className="text-[10px]"
          style={{ color }}
        >
          {eyebrow}
        </Text>
        <Text
          variant="label"
          tone="inverse"
          numberOfLines={1}
          className="text-[13px]"
        >
          {title}
        </Text>
        <Text
          variant="caption"
          tone={ready ? "inverse" : "muted"}
          numberOfLines={1}
          className="text-[11px]"
        >
          {value}
        </Text>
      </View>
      <View
        className={[
          "rounded-full border px-3",
          compact ? "py-1.5" : "py-2",
        ].join(" ")}
        style={{
          backgroundColor: withAlphaHex(ready ? accent : colors.surface, 0.82),
          borderColor: withAlphaHex(ready ? accent : colors.outlineStrong, 0.36),
        }}
      >
        <Text
          variant="caption"
          tone="muted"
          className="text-[10px]"
          style={{ color: ready ? accent : colors.textMuted }}
        >
          {ready ? "Düzenle" : "Seç"}
        </Text>
      </View>
    </Pressable>
  );
}

type DetailsPanelProps = {
  urgent: boolean;
  selectedEquipment: TowVehicleEquipment;
  draft: ServiceRequestDraft;
  updateDraft: (patch: Partial<ServiceRequestDraft>) => void;
  onSetUrgentMode: (urgent: boolean) => void;
};

function DetailsPanel({
  urgent,
  selectedEquipment,
  draft,
  updateDraft,
  onSetUrgentMode,
}: DetailsPanelProps) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface-2 px-3 py-3">
      <View className="flex-row rounded-full border border-app-outline bg-app-surface p-1">
        <ModePill
          icon={Zap}
          label="Şimdi"
          selected={urgent}
          onPress={() => onSetUrgentMode(true)}
        />
        <ModePill
          icon={CalendarClock}
          label="Planlı"
          selected={!urgent}
          onPress={() => onSetUrgentMode(false)}
        />
      </View>

      {!urgent ? (
        <View className="flex-row flex-wrap gap-2">
          {TIME_WINDOWS.map((window) => (
            <ToggleChip
              key={window}
              label={window}
              selected={draft.preferred_window === window}
              onPress={() =>
                updateDraft({
                  preferred_window:
                    draft.preferred_window === window ? undefined : window,
                })
              }
            />
          ))}
        </View>
      ) : null}

      <View className="gap-2">
        <Text variant="caption" tone="muted" className="text-[11px]">
          Ekipman
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((option) => (
            <ToggleChip
              key={option.id}
              label={option.label}
              selected={selectedEquipment === option.id}
              onPress={() =>
                updateDraft({ tow_required_equipment: [option.id] })
              }
            />
          ))}
        </View>
      </View>

      <FieldInput
        value={draft.notes ?? ""}
        onChangeText={(value) => updateDraft({ notes: value })}
        placeholder="Not ekle: otopark, anahtar, güvenlik..."
        textarea
        rows={2}
      />
      <View className="flex-row items-center gap-2">
        <Icon icon={ShieldCheck} size={14} color={colors.success} />
        <Text variant="caption" tone="muted" className="flex-1 text-[11px]">
          Ödeme tavanı backend quote ile kilitlenir.
        </Text>
      </View>
    </View>
  );
}

type ModePillProps = {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
};

function ModePill({ icon, label, selected, onPress }: ModePillProps) {
  const { colors } = useNaroTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      className={[
        "min-h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-3 active:opacity-85",
        selected ? "bg-brand-500" : "bg-transparent",
      ].join(" ")}
    >
      <Icon
        icon={icon}
        size={13}
        color={selected ? colors.surface : colors.textSubtle}
      />
      <Text
        variant="caption"
        tone={selected ? "inverse" : "muted"}
        className={["text-[11px]", selected ? "text-white" : ""].join(" ")}
      >
        {label}
      </Text>
    </Pressable>
  );
}
