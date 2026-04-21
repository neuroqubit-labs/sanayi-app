"""Tow Pydantic schemas — Zod parity (packages/domain/src/tow.ts).

Backend bazı alanlarda Zod'dan daha geniş (preauth_failed, preauth_stale stages;
preauth_stale + kasko_rejected settlement statuses; required_equipment array).
Schema parity CI testi bu farkları known-drift olarak işaretler.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ─── Enums (StrEnum — JSON serde ile uyumlu) ────────────────────────────────


class TowModeSchema(StrEnum):
    IMMEDIATE = "immediate"
    SCHEDULED = "scheduled"


class TowEquipmentSchema(StrEnum):
    FLATBED = "flatbed"
    HOOK = "hook"
    WHEEL_LIFT = "wheel_lift"
    HEAVY_DUTY = "heavy_duty"
    MOTORCYCLE = "motorcycle"


class TowIncidentReasonSchema(StrEnum):
    NOT_RUNNING = "not_running"
    ACCIDENT = "accident"
    FLAT_TIRE = "flat_tire"
    BATTERY = "battery"
    FUEL = "fuel"
    LOCKED_KEYS = "locked_keys"
    STUCK = "stuck"
    OTHER = "other"


class TowDispatchStageSchema(StrEnum):
    SEARCHING = "searching"
    ACCEPTED = "accepted"
    EN_ROUTE = "en_route"
    NEARBY = "nearby"
    ARRIVED = "arrived"
    LOADING = "loading"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    TIMEOUT_CONVERTED_TO_POOL = "timeout_converted_to_pool"
    SCHEDULED_WAITING = "scheduled_waiting"
    BIDDING_OPEN = "bidding_open"
    OFFER_ACCEPTED = "offer_accepted"
    PREAUTH_FAILED = "preauth_failed"
    PREAUTH_STALE = "preauth_stale"


class TowSettlementStatusSchema(StrEnum):
    NONE = "none"
    PRE_AUTH_HOLDING = "pre_auth_holding"
    PREAUTH_STALE = "preauth_stale"
    FINAL_CHARGED = "final_charged"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"
    KASKO_REJECTED = "kasko_rejected"


class TowEvidenceKindSchema(StrEnum):
    CUSTOMER_PRE_STATE = "customer_pre_state"
    TECH_ARRIVAL = "tech_arrival"
    TECH_LOADING = "tech_loading"
    TECH_DELIVERY = "tech_delivery"


class TowDispatchResponseSchema(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    TIMEOUT = "timeout"


# ─── Primitives ─────────────────────────────────────────────────────────────


class LatLng(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]


# ─── Value objects ──────────────────────────────────────────────────────────


class TowFareQuote(BaseModel):
    """Hemen/randevulu fare hesap snapshot — cap/locked price dahil."""

    model_config = ConfigDict(extra="forbid")

    mode: TowModeSchema
    base_amount: Decimal
    distance_km: Decimal
    per_km_rate: Decimal
    urgency_surcharge: Decimal
    buffer_pct: Decimal
    cap_amount: Decimal
    locked_price: Decimal | None = None
    currency: str = "TRY"


class TowLiveLocationSchema(BaseModel):
    case_id: UUID
    technician_id: UUID
    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]
    heading: Annotated[float, Field(ge=0, le=360)] | None = None
    speed_kmh: Annotated[float, Field(ge=0)] | None = None
    captured_at: datetime


class TowKaskoDeclaration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    has_kasko: bool = False
    insurer_name: str | None = None
    policy_number: str | None = None
    pre_auth_on_customer_card: bool = True


class TowDispatchAttemptSchema(BaseModel):
    id: UUID
    technician_id: UUID
    technician_name: str | None = None
    attempt_order: int
    sent_at: datetime
    response_at: datetime | None = None
    response: TowDispatchResponseSchema = TowDispatchResponseSchema.PENDING
    distance_km: Decimal | None = None
    eta_minutes: int | None = None


class TowTechnicianProfileSchema(BaseModel):
    id: UUID
    name: str
    rating: float
    completed_jobs: int
    plate: str | None = None
    truck_model: str | None = None
    equipment: TowEquipmentSchema
    phone: str | None = None
    photo_url: str | None = None


class TowBid(BaseModel):
    id: UUID
    technician: TowTechnicianProfileSchema
    price_amount: Decimal
    price_label: str
    eta_window_label: str
    equipment: TowEquipmentSchema
    guarantee_label: str | None = None
    submitted_at: datetime


class TowEvidenceSchema(BaseModel):
    id: UUID
    case_id: UUID
    kind: TowEvidenceKindSchema
    uploader: Literal["customer", "technician", "system"]
    photo_url: str
    caption: str | None = None
    created_at: datetime


class TowOtpChallenge(BaseModel):
    code: str
    purpose: Literal["arrival", "delivery"]
    recipient: Literal["customer", "delivery_recipient"]
    issued_at: datetime
    expires_at: datetime
    verified_at: datetime | None = None


# ─── Request / response ─────────────────────────────────────────────────────


class TowFareQuoteRequest(BaseModel):
    """POST /tow/fare/quote input."""

    model_config = ConfigDict(extra="forbid")

    mode: TowModeSchema
    pickup_lat_lng: LatLng
    dropoff_lat_lng: LatLng | None = None
    required_equipment: list[TowEquipmentSchema] = Field(default_factory=list)
    urgency_bump: bool = False


class TowCreateCaseRequest(BaseModel):
    """POST /tow/cases input (Zod TowRequest + fare quote)."""

    model_config = ConfigDict(extra="forbid")

    mode: TowModeSchema
    pickup_lat_lng: LatLng
    pickup_label: str
    dropoff_lat_lng: LatLng | None = None
    dropoff_label: str | None = None
    vehicle_id: UUID
    incident_reason: TowIncidentReasonSchema
    required_equipment: list[TowEquipmentSchema] = Field(default_factory=list)
    scheduled_at: datetime | None = None
    fare_quote: TowFareQuote
    kasko: TowKaskoDeclaration = Field(default_factory=TowKaskoDeclaration)
    attachments: list[UUID] = Field(default_factory=list)


class TowDispatchResponseInput(BaseModel):
    """POST /tow/cases/{id}/dispatch/response — teknisyen accept/decline."""

    model_config = ConfigDict(extra="forbid")

    attempt_id: UUID
    response: Literal["accepted", "declined"]
    rejection_reason: str | None = None


class TowLocationInput(BaseModel):
    """POST /tow/cases/{id}/location — GPS ping."""

    model_config = ConfigDict(extra="forbid")

    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]
    heading_deg: Annotated[int, Field(ge=0, le=360)] | None = None
    speed_kmh: Annotated[int, Field(ge=0, le=300)] | None = None
    accuracy_m: Annotated[int, Field(ge=0, le=5000)] | None = None
    captured_at: datetime


class TowOtpIssueInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purpose: Literal["arrival", "delivery"]
    recipient: Literal["customer", "delivery_person"]


class TowOtpVerifyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purpose: Literal["arrival", "delivery"]
    code: Annotated[str, Field(min_length=4, max_length=8)]


class TowCancelInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason_code: str
    reason_note: str | None = None


class TowKaskoDeclareInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    declaration: TowKaskoDeclaration


class TowRatingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rating: Annotated[int, Field(ge=1, le=5)]
    review_note: str | None = None


class TowBidSubmitInput(BaseModel):
    """POST /tow/bids — scheduled mode usta teklifi."""

    model_config = ConfigDict(extra="forbid")

    case_id: UUID
    price_amount: Decimal
    eta_minutes: int
    equipment: TowEquipmentSchema
    guarantee_label: str | None = None


# ─── Responses ──────────────────────────────────────────────────────────────


class TowFareQuoteResponse(BaseModel):
    quote: TowFareQuote
    pickup_address: str | None = None
    dropoff_address: str | None = None
    distance_km: Decimal
    expires_at: datetime


class TowCaseSnapshot(BaseModel):
    """GET /tow/cases/{id} response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
    mode: TowModeSchema
    stage: TowDispatchStageSchema
    status: str
    pickup_lat_lng: LatLng | None
    pickup_label: str | None
    dropoff_lat_lng: LatLng | None
    dropoff_label: str | None
    incident_reason: TowIncidentReasonSchema | None
    required_equipment: list[TowEquipmentSchema]
    scheduled_at: datetime | None
    fare_quote: TowFareQuote | None
    assigned_technician_id: UUID | None
    settlement_status: TowSettlementStatusSchema
    final_amount: Decimal | None
    cancellation_fee: Decimal | None


class TowTrackingSnapshot(BaseModel):
    """GET /tow/cases/{id}/tracking — WS fallback polling."""

    case_id: UUID
    stage: TowDispatchStageSchema
    technician_id: UUID | None
    last_location: LatLng | None
    last_location_at: datetime | None
    eta_minutes: int | None
    updated_at: datetime


class TowDispatchResponseOutput(BaseModel):
    attempt_id: UUID
    response: TowDispatchResponseSchema
    next_stage: TowDispatchStageSchema | None
