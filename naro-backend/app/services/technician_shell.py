"""Shell config builder — PR 4 brief §5. Zod canonical ile parity.

build_shell_config(profile, certs, admission) → ShellConfig
Cache: `shell_config:{user_id}:{role_config_version}` — Redis SETEX 300s.

HOME_LAYOUT_MAP — (provider_type, provider_mode) → HomeLayout enum.
QUICK_ACTION_SET — home widget quick actions; capability gate.
TAB_SET sabit V1'de — 4 fixed (home/havuz/kayitlar/profil).

Cache invalidation natural: `role_config_version` bump → eski key natural
stale → TTL sonunda evict. Direct delete yapmıyoruz (versioning pattern).
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import TYPE_CHECKING
from uuid import UUID

from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianCapability,
    TechnicianCertificate,
    TechnicianProfile,
)
from app.models.user import UserStatus
from app.schemas.shell_config import (
    V1_FIXED_TAB_SET,
    HomeLayout,
    QuickAction,
    ShellConfig,
)
from app.services.technician_admission import (
    AdmissionResult,
    recompute_admission,
)

if TYPE_CHECKING:
    from redis.asyncio import Redis
    from sqlalchemy.ext.asyncio import AsyncSession


# ─── Maps ──────────────────────────────────────────────────────────────────


_HOME_LAYOUT_MAP: dict[tuple[ProviderType, ProviderMode], HomeLayout] = {
    (ProviderType.CEKICI, ProviderMode.BUSINESS): HomeLayout.TOW_FOCUSED,
    (ProviderType.CEKICI, ProviderMode.INDIVIDUAL): HomeLayout.TOW_FOCUSED,
    (ProviderType.USTA, ProviderMode.BUSINESS): HomeLayout.FULL,
    (ProviderType.USTA, ProviderMode.INDIVIDUAL): HomeLayout.BUSINESS_LITE,
    (ProviderType.KAPORTA_BOYA, ProviderMode.BUSINESS): HomeLayout.DAMAGE_SHOP,
    (ProviderType.KAPORTA_BOYA, ProviderMode.INDIVIDUAL): HomeLayout.DAMAGE_SHOP,
    (ProviderType.LASTIK, ProviderMode.BUSINESS): HomeLayout.BUSINESS_LITE,
    (ProviderType.LASTIK, ProviderMode.INDIVIDUAL): HomeLayout.MINIMAL,
    (ProviderType.OTO_ELEKTRIK, ProviderMode.BUSINESS): HomeLayout.BUSINESS_LITE,
    (ProviderType.OTO_ELEKTRIK, ProviderMode.INDIVIDUAL): HomeLayout.MINIMAL,
    (ProviderType.OTO_AKSESUAR, ProviderMode.BUSINESS): HomeLayout.BUSINESS_LITE,
    (ProviderType.OTO_AKSESUAR, ProviderMode.INDIVIDUAL): HomeLayout.MINIMAL,
}


def _quick_actions_for(
    home_layout: HomeLayout,
    capability: TechnicianCapability | None,
) -> list[QuickAction]:
    """Home widget quick actions — capability-gate uygulanır."""
    actions: list[QuickAction] = []
    # Ortak
    actions.append(
        QuickAction(
            id="open_pool",
            label="Havuza git",
            icon="stream",
            route="/havuz",
            requires_capability=None,
        )
    )
    if home_layout == HomeLayout.TOW_FOCUSED:
        actions.append(
            QuickAction(
                id="tow_live",
                label="Aktif çekici işi",
                icon="route",
                route="/cekici/live",
                requires_capability="towing_coordination",
            )
        )
    elif home_layout == HomeLayout.DAMAGE_SHOP:
        if capability and capability.insurance_case_handler:
            actions.append(
                QuickAction(
                    id="create_claim",
                    label="Hasar dosyası aç",
                    icon="shield",
                    route="/insurance/new",
                    requires_capability="insurance_case_handler",
                )
            )
    elif home_layout in (HomeLayout.FULL, HomeLayout.BUSINESS_LITE):
        if capability and capability.on_site_repair:
            actions.append(
                QuickAction(
                    id="on_site_job",
                    label="Yerinde onarım",
                    icon="tools",
                    route="/jobs/on-site",
                    requires_capability="on_site_repair",
                )
            )
        if capability and capability.valet_service:
            actions.append(
                QuickAction(
                    id="valet_pickup",
                    label="Vale al",
                    icon="car",
                    route="/jobs/valet",
                    requires_capability="valet_service",
                )
            )
    return actions


def _enabled_capabilities(
    capability: TechnicianCapability | None,
) -> list[str]:
    if capability is None:
        return []
    keys: list[str] = []
    if capability.insurance_case_handler:
        keys.append("insurance_case_handler")
    if capability.on_site_repair:
        keys.append("on_site_repair")
    if capability.valet_service:
        keys.append("valet_service")
    if capability.towing_coordination:
        keys.append("towing_coordination")
    return keys


def _onboarding_steps_for_missing(admission: AdmissionResult) -> list[str]:
    if admission.passed:
        return []
    steps: list[str] = []
    if "cert_missing" in admission.reasons:
        steps.append("upload_missing_certificates")
    if "business_legal_name_missing" in admission.reasons:
        steps.append("complete_business_legal_name")
    if "business_phone_missing" in admission.reasons:
        steps.append("complete_business_phone")
    return steps


# ─── Public API ────────────────────────────────────────────────────────────


def build_shell_config(
    profile: TechnicianProfile,
    *,
    capability: TechnicianCapability | None,
    certs: Iterable[TechnicianCertificate],
    admission: AdmissionResult,
    admission_status: UserStatus,
) -> ShellConfig:
    """ShellConfig inşa et — Zod canonical paralel. Cache öncesi pure builder."""
    active = profile.active_provider_type or profile.provider_type
    home_layout = _HOME_LAYOUT_MAP.get(
        (active, profile.provider_mode), HomeLayout.MINIMAL
    )
    return ShellConfig(
        primary_provider_type=profile.provider_type,
        active_provider_type=active,
        provider_mode=profile.provider_mode,
        secondary_provider_types=list(profile.secondary_provider_types or []),
        verified_level=profile.verified_level,
        admission_status=admission_status,
        admission_gate_passed=admission.passed,
        enabled_capabilities=_enabled_capabilities(capability),
        home_layout=home_layout,
        tab_set=V1_FIXED_TAB_SET.copy(),
        quick_action_set=_quick_actions_for(home_layout, capability),
        required_onboarding_steps=_onboarding_steps_for_missing(admission),
        required_cert_kinds=sorted(admission.required, key=lambda k: k.value),
        role_config_version=int(profile.role_config_version),
    )


# ─── Redis cache layer ────────────────────────────────────────────────────


SHELL_CONFIG_TTL_SECONDS = 300


def shell_cache_key(user_id: UUID, role_config_version: int) -> str:
    return f"shell_config:{user_id}:{role_config_version}"


async def get_cached_shell_config(
    redis: Redis, *, user_id: UUID, version: int
) -> ShellConfig | None:
    key = shell_cache_key(user_id, version)
    raw = await redis.get(key)
    if raw is None:
        return None
    try:
        payload = json.loads(raw if isinstance(raw, str) else raw.decode())
    except json.JSONDecodeError:
        return None
    return ShellConfig.model_validate(payload)


async def set_cached_shell_config(
    redis: Redis,
    *,
    user_id: UUID,
    version: int,
    config: ShellConfig,
) -> None:
    key = shell_cache_key(user_id, version)
    await redis.set(
        key, config.model_dump_json(), ex=SHELL_CONFIG_TTL_SECONDS
    )


async def load_shell_config(
    session: AsyncSession,
    redis: Redis,
    *,
    profile: TechnicianProfile,
    admission_status: UserStatus,
) -> ShellConfig:
    """Cache-aware shell config load. Miss → build + cache."""
    user_id = profile.user_id
    cached = await get_cached_shell_config(
        redis, user_id=user_id, version=int(profile.role_config_version)
    )
    if cached is not None:
        return cached

    # Cache miss — capability + cert load
    from sqlalchemy import select

    from app.models.technician import TechnicianCapability as _Cap
    from app.models.technician import TechnicianCertificate as _Cert

    cap_stmt = select(_Cap).where(_Cap.profile_id == profile.id)
    capability: TechnicianCapability | None = (
        await session.execute(cap_stmt)
    ).scalar_one_or_none()

    certs_stmt = select(_Cert).where(_Cert.profile_id == profile.id)
    certs = list((await session.execute(certs_stmt)).scalars().all())

    admission = await recompute_admission(session, profile.id)
    config = build_shell_config(
        profile,
        capability=capability,
        certs=certs,
        admission=admission,
        admission_status=admission_status,
    )
    await set_cached_shell_config(
        redis, user_id=user_id, version=config.role_config_version, config=config
    )
    return config
