"""Prometheus metrics — Faz 10 tow dispatch counters/histograms/gauges."""

from __future__ import annotations

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

registry = CollectorRegistry()

tow_dispatch_duration_seconds = Histogram(
    "naro_tow_dispatch_duration_seconds",
    "Time from case create to match",
    labelnames=("mode", "result"),
    buckets=(5, 10, 20, 30, 45, 60, 90, 120, 180, 300),
    registry=registry,
)
tow_match_success_ratio = Gauge(
    "naro_tow_match_success_ratio",
    "Match success ratio (5min rolling window)",
    labelnames=("window",),
    registry=registry,
)
tow_dispatch_radius_expansion_total = Counter(
    "naro_tow_dispatch_radius_expansion_total",
    "Radius ladder expansion events",
    labelnames=("from_km", "to_km"),
    registry=registry,
)
tow_candidate_pool_size = Histogram(
    "naro_tow_candidate_pool_size",
    "Candidates found per dispatch attempt",
    labelnames=("radius_km",),
    registry=registry,
)
tow_ws_message_lag_ms = Histogram(
    "naro_tow_ws_message_lag_ms",
    "Redis Streams XADD → WS delivery lag",
    buckets=(10, 25, 50, 100, 200, 500, 1000, 2000, 5000),
    registry=registry,
)
tow_active_ws_connections = Gauge(
    "naro_tow_active_ws_connections",
    "Live WebSocket subscribers",
    registry=registry,
)
tow_fare_capture_total = Counter(
    "naro_tow_fare_capture_total",
    "Fare captures by status",
    labelnames=("status",),
    registry=registry,
)
tow_cap_absorbed_amount_try_total = Counter(
    "naro_tow_cap_absorbed_amount_try_total",
    "TRY absorbed when cap < actual (platform loss)",
    registry=registry,
)
tow_preauth_stale_total = Counter(
    "naro_tow_preauth_stale_total",
    "Pre-auth holds that expired / went stale",
    registry=registry,
)
tow_otp_replay_blocked_total = Counter(
    "naro_tow_otp_replay_blocked_total",
    "OTP replays blocked by hash verification",
    registry=registry,
)
tow_fraud_suspected_total = Counter(
    "naro_tow_fraud_suspected_total",
    "Fraud suspicion events",
    labelnames=("reason",),
    registry=registry,
)

# ─── Faz 11 — Media upload metrics ──────────────────────────────────────────

media_upload_intent_total = Counter(
    "naro_media_upload_intent_total",
    "Media upload intent requests",
    labelnames=("purpose",),
    registry=registry,
)
media_upload_complete_total = Counter(
    "naro_media_upload_complete_total",
    "Media upload completion results",
    labelnames=("purpose", "status"),
    registry=registry,
)
media_orphan_purged_total = Counter(
    "naro_media_orphan_purged_total",
    "Pending intents purged after retention window",
    registry=registry,
)
media_antivirus_quarantined_total = Counter(
    "naro_media_antivirus_quarantined_total",
    "Assets quarantined by antivirus scan",
    registry=registry,
)
media_retention_deleted_total = Counter(
    "naro_media_retention_deleted_total",
    "Assets hard-deleted via retention policy",
    labelnames=("purpose",),
    registry=registry,
)

# ─── Faz 12 — Case create metrics ──────────────────────────────────────────

case_create_total = Counter(
    "naro_case_create_total",
    "Case create submissions",
    labelnames=("kind", "status"),
    registry=registry,
)
case_create_validation_fail_total = Counter(
    "naro_case_create_validation_fail_total",
    "Case create validation failures",
    labelnames=("kind", "reason"),
    registry=registry,
)


def render_metrics() -> tuple[bytes, str]:
    return generate_latest(registry), "text/plain; version=0.0.4"
