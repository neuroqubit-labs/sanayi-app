"""PR 4 Gün 2 — shell config builder + schema + cache key pure tests."""

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.v1.routes.technicians import (
    AvailabilityPatchPayload,
    BusinessPatchPayload,
    CapabilitiesPatchPayload,
    ProfilePatchPayload,
)
from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianAvailability,
    TechnicianCapability,
    TechnicianProfile,
    TechnicianVerifiedLevel,
)
from app.models.user import UserStatus
from app.schemas.shell_config import V1_FIXED_TAB_SET, HomeLayout, ShellConfig
from app.services.technician_admission import AdmissionResult
from app.services.technician_shell import (
    _HOME_LAYOUT_MAP,
    build_shell_config,
    shell_cache_key,
)

# ─── Home layout map ───────────────────────────────────────────────────────


def test_home_layout_map_all_combinations() -> None:
    """12 kombinasyon için home layout eşleşmesi belirlenmiş olmalı."""
    expected = {(pt, pm) for pt in ProviderType for pm in ProviderMode}
    assert set(_HOME_LAYOUT_MAP.keys()) == expected


def test_cekici_business_is_tow_focused() -> None:
    assert _HOME_LAYOUT_MAP[(ProviderType.CEKICI, ProviderMode.BUSINESS)] == HomeLayout.TOW_FOCUSED


def test_cekici_individual_is_tow_focused() -> None:
    assert _HOME_LAYOUT_MAP[(ProviderType.CEKICI, ProviderMode.INDIVIDUAL)] == HomeLayout.TOW_FOCUSED


def test_usta_business_is_full() -> None:
    assert _HOME_LAYOUT_MAP[(ProviderType.USTA, ProviderMode.BUSINESS)] == HomeLayout.FULL


def test_kaporta_boya_damage_shop() -> None:
    assert _HOME_LAYOUT_MAP[(ProviderType.KAPORTA_BOYA, ProviderMode.BUSINESS)] == HomeLayout.DAMAGE_SHOP


def test_oto_elektrik_individual_is_minimal() -> None:
    assert _HOME_LAYOUT_MAP[(ProviderType.OTO_ELEKTRIK, ProviderMode.INDIVIDUAL)] == HomeLayout.MINIMAL


# ─── Cache key ─────────────────────────────────────────────────────────────


def test_cache_key_format() -> None:
    user_id = uuid4()
    key = shell_cache_key(user_id, 5)
    assert key == f"shell_config:{user_id}:5"


def test_cache_key_different_version_different_key() -> None:
    user_id = uuid4()
    assert shell_cache_key(user_id, 1) != shell_cache_key(user_id, 2)


# ─── build_shell_config (pure) ─────────────────────────────────────────────


def _make_profile(
    *,
    provider_type: ProviderType = ProviderType.USTA,
    provider_mode: ProviderMode = ProviderMode.BUSINESS,
    active: ProviderType | None = None,
    secondary: list[ProviderType] | None = None,
    version: int = 1,
) -> TechnicianProfile:
    profile = TechnicianProfile(
        id=uuid4(),
        user_id=uuid4(),
        display_name="Test Usta",
        provider_type=provider_type,
        secondary_provider_types=secondary or [],
        availability=TechnicianAvailability.AVAILABLE,
        verified_level=TechnicianVerifiedLevel.BASIC,
        provider_mode=provider_mode,
        active_provider_type=active,
        role_config_version=version,
    )
    return profile


def _make_admission(
    *,
    passed: bool = True,
    missing: frozenset[object] = frozenset(),
    reasons: tuple[str, ...] = (),
) -> AdmissionResult:
    return AdmissionResult(
        passed=passed,
        provider_type=ProviderType.USTA,
        provider_mode=ProviderMode.BUSINESS,
        required=frozenset(),
        approved_valid=frozenset(),
        missing=missing,  # type: ignore[arg-type]
        reasons=reasons,
    )


def test_shell_config_falls_back_to_primary_when_no_active() -> None:
    profile = _make_profile(provider_type=ProviderType.USTA, active=None)
    admission = _make_admission()
    config = build_shell_config(
        profile,
        capability=None,
        certs=[],
        admission=admission,
        admission_status=UserStatus.ACTIVE,
    )
    assert config.active_provider_type == ProviderType.USTA
    assert config.home_layout == HomeLayout.FULL
    assert config.tab_set == V1_FIXED_TAB_SET


def test_shell_config_active_overrides_primary() -> None:
    profile = _make_profile(
        provider_type=ProviderType.USTA,
        secondary=[ProviderType.CEKICI],
        active=ProviderType.CEKICI,
    )
    config = build_shell_config(
        profile,
        capability=None,
        certs=[],
        admission=_make_admission(),
        admission_status=UserStatus.ACTIVE,
    )
    assert config.active_provider_type == ProviderType.CEKICI
    assert config.home_layout == HomeLayout.TOW_FOCUSED


def test_shell_config_enabled_capabilities_from_flags() -> None:
    profile = _make_profile()
    capability = TechnicianCapability(
        profile_id=profile.id,
        insurance_case_handler=True,
        on_site_repair=True,
        valet_service=False,
        towing_coordination=True,
    )
    config = build_shell_config(
        profile,
        capability=capability,
        certs=[],
        admission=_make_admission(),
        admission_status=UserStatus.ACTIVE,
    )
    assert "insurance_case_handler" in config.enabled_capabilities
    assert "on_site_repair" in config.enabled_capabilities
    assert "towing_coordination" in config.enabled_capabilities
    assert "valet_service" not in config.enabled_capabilities


def test_shell_config_admission_failed_lists_onboarding_steps() -> None:
    profile = _make_profile()
    admission = _make_admission(
        passed=False,
        reasons=("cert_missing", "business_phone_missing"),
    )
    config = build_shell_config(
        profile,
        capability=None,
        certs=[],
        admission=admission,
        admission_status=UserStatus.PENDING,
    )
    assert config.admission_gate_passed is False
    assert "upload_missing_certificates" in config.required_onboarding_steps
    assert "complete_business_phone" in config.required_onboarding_steps


def test_shell_config_version_propagated() -> None:
    profile = _make_profile(version=42)
    config = build_shell_config(
        profile,
        capability=None,
        certs=[],
        admission=_make_admission(),
        admission_status=UserStatus.ACTIVE,
    )
    assert config.role_config_version == 42


def test_shell_config_tab_set_v1_fixed() -> None:
    profile = _make_profile()
    config = build_shell_config(
        profile,
        capability=None,
        certs=[],
        admission=_make_admission(),
        admission_status=UserStatus.ACTIVE,
    )
    assert config.tab_set == ["home", "havuz", "kayitlar", "profil"]


def test_shell_config_serializable() -> None:
    """Pydantic serde — Redis cache edilebilir mi?"""
    profile = _make_profile()
    config = build_shell_config(
        profile,
        capability=None,
        certs=[],
        admission=_make_admission(),
        admission_status=UserStatus.ACTIVE,
    )
    json_str = config.model_dump_json()
    assert isinstance(json_str, str)
    rebuilt = ShellConfig.model_validate_json(json_str)
    assert rebuilt.role_config_version == config.role_config_version


# ─── Payload schemas ──────────────────────────────────────────────────────


def test_profile_patch_all_fields_optional() -> None:
    p = ProfilePatchPayload()
    assert p.model_dump(exclude_unset=True) == {}


def test_profile_patch_extra_forbid() -> None:
    with pytest.raises(ValidationError):
        ProfilePatchPayload(unknown_field=True)  # type: ignore[call-arg]


def test_profile_patch_display_name_min_length() -> None:
    with pytest.raises(ValidationError):
        ProfilePatchPayload(display_name="")


def test_business_patch_partial_update() -> None:
    p = BusinessPatchPayload(legal_name="Naro AŞ", phone="+905550001122")
    dumped = p.model_dump(exclude_unset=True)
    assert dumped == {"legal_name": "Naro AŞ", "phone": "+905550001122"}


def test_business_patch_tax_number_min_length() -> None:
    with pytest.raises(ValidationError):
        BusinessPatchPayload(tax_number="123")


def test_availability_patch_enum_validation() -> None:
    with pytest.raises(ValidationError):
        AvailabilityPatchPayload(availability="ghost")  # type: ignore[arg-type]


def test_availability_patch_accepts_all_three_states() -> None:
    for state in ("available", "busy", "offline"):
        p = AvailabilityPatchPayload(availability=state)  # type: ignore[arg-type]
        assert p.availability.value == state


def test_capabilities_patch_all_optional() -> None:
    p = CapabilitiesPatchPayload()
    assert p.model_dump(exclude_unset=True) == {}


def test_capabilities_patch_partial() -> None:
    p = CapabilitiesPatchPayload(on_site_repair=True, valet_service=False)
    dumped = p.model_dump(exclude_unset=True)
    assert dumped == {"on_site_repair": True, "valet_service": False}
