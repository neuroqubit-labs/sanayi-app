"""ShellConfig Pydantic — packages/domain/src/shell-config.ts parity.

Mobil service-app home/hava/kayitlar/profil shell'ini backend'den alır. Cache
key: `shell_config:{user_id}:{role_config_version}`; TTL 300s. Her mutation
`bump_role_config_version` çağırır → yeni versiyon → eski cache natural stale.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianCertificateKind,
    TechnicianVerifiedLevel,
)
from app.models.user import UserStatus


class HomeLayout(StrEnum):
    TOW_FOCUSED = "tow_focused"
    FULL = "full"
    BUSINESS_LITE = "business_lite"
    MINIMAL = "minimal"
    DAMAGE_SHOP = "damage_shop"


class QuickAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    icon: str
    route: str
    requires_capability: str | None = None


class ShellConfig(BaseModel):
    """V1 shell config — Zod canonical parity."""

    model_config = ConfigDict(extra="forbid")

    primary_provider_type: ProviderType
    active_provider_type: ProviderType
    provider_mode: ProviderMode
    secondary_provider_types: list[ProviderType] = Field(default_factory=list)
    verified_level: TechnicianVerifiedLevel
    admission_status: UserStatus
    admission_gate_passed: bool = False
    enabled_capabilities: list[str] = Field(default_factory=list)
    home_layout: HomeLayout
    tab_set: list[str]
    quick_action_set: list[QuickAction] = Field(default_factory=list)
    required_onboarding_steps: list[str] = Field(default_factory=list)
    required_cert_kinds: list[TechnicianCertificateKind] = Field(default_factory=list)
    role_config_version: int


# V1 fixed tab set — Zod canonical ile aynı
V1_FIXED_TAB_SET: list[str] = ["home", "havuz", "kayitlar", "profil"]
