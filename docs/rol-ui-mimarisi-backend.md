# Rol UI Mimarisi — Backend Brief

> **Sorumlu:** BACKEND-DEV sohbeti
> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Kardeş doc:** [rol-ui-mimarisi-frontend.md](rol-ui-mimarisi-frontend.md)
> **Bağlı:** [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) Faz 8 kapsam genişletmesi

---

## 1. Context

Service app (`naro-service-app`) 2+ rol için aynı shell kullanmak zorunda değil. Çekici rolü GPS-ağır + dar ekran seti; tamirci rolü geniş (kampanya, randevu, ekip, rapor). Gelecekte `satici`, `yedek_parcaci` gibi yeni aktör tipleri eklenecek.

Mevcut `technician_profiles.provider_type` enum (6 değer) ana rolü zaten taşır, ancak **işletme modu** (business vs bireysel) ve **aktif rol** (multi-role kişi için) boyutları eksik. UI routing için backend'in canonical config endpoint'i yok.

**Outcome:** Frontend kendi shell/tab/+ menü render kararını **backend config'e göre** verir. Migration-ucuz, genişletilebilir, test edilebilir.

---

## 2. Canonical model

```
technician_profiles (eklenecek):
  provider_type             enum (mevcut: usta, cekici, kaporta_boya,
                                   lastik, oto_elektrik, oto_aksesuar)
  secondary_provider_types  enum[] (mevcut — hibrit destekli)
  provider_mode             enum NEW: business | individual
                                      (side_gig V2'YE ERTELENDİ)
  active_provider_type      enum NEW: primary veya secondary'den biri
                                      (multi-role kişi için "şu an hangi rolde")
  role_config_version       SMALLINT NEW: shell-config cache invalidation
```

**Tab iskelet (V1 sabit):** `home / havuz / kayitlar / profil` — tüm roller için aynı. Rol-spesifik içerik (çekici aktif iş, kampanya, hasar akışı) home widget'larına + bottom sheet'lere + modallara düşer; ayrı tab YOK.

Matrisler service layer'da:
- `required_cert_kinds(provider_type, provider_mode) -> set[TechnicianCertificateKind]`
- `resolve_home_layout(provider_type, provider_mode) -> str`
- `resolve_quick_actions(provider_type, provider_mode, capabilities) -> list[QuickAction]`

---

## 3. PO kararları (V1)

**K-R1** Side gig **ERTELENDİ** — V1'de `provider_mode` enum sadece `{business, individual}`. `side_gig` değeri V2'de eklenir (TR vergi/regülasyon belirsizliği).

**K-R2** Migration default `provider_mode = 'business'`. Mevcut tüm kayıtlar business olarak back-fill; admin manuel review ile individual'a değiştirebilir.

**K-R3** `tow_operator` **V1'de yeni cert_kind**. Çekici (`provider_type='cekici'`) admission için zorunlu. **Not:** Frontend mock fixture'da (`naro-service-app/.../fixtures.ts`) bu ad zaten `tow_operator` olarak kullanılıyor; BE canonical ismi bu olacak. `capability_attestation` V2'ye kalır (side_gig ile birlikte).

**K-R4** Çekici × `provider_mode` için **sadece business + individual** geçerli; her ikisi için `tow_operator` + `vehicle_license` zorunlu (individual da operator belgesi gerekir).

**K-R5** Active role switch **explicit**: multi-role kişi (ör. usta + cekici) shell değiştirmek için `POST /switch-active-role` çağırır. `active_provider_type` NULL ise default = primary.

---

## 4. Deliverable

### 4.1 Alembic migration — `20260422_00XX_provider_role_model.py`

```sql
-- Yeni enum
CREATE TYPE provider_mode AS ENUM ('business', 'individual');

-- Mevcut enum'a değer ekle
ALTER TYPE technician_certificate_kind ADD VALUE 'tow_operator';

-- Kolonlar
ALTER TABLE technician_profiles
    ADD COLUMN provider_mode provider_mode NOT NULL DEFAULT 'business',
    ADD COLUMN active_provider_type provider_type,
    ADD COLUMN role_config_version SMALLINT NOT NULL DEFAULT 1;

-- Consistency constraint
ALTER TABLE technician_profiles
    ADD CONSTRAINT ck_active_provider_in_roles
    CHECK (
      active_provider_type IS NULL
      OR active_provider_type = provider_type
      OR active_provider_type = ANY(secondary_provider_types)
    );

-- Index: multi-role switch sorguları
CREATE INDEX ix_tech_profiles_active_role
    ON technician_profiles (active_provider_type, provider_mode)
    WHERE deleted_at IS NULL;
```

**Down:** kolonları drop, enum'dan `tow_operator` kaldırılamaz (tek yön). Bu kabul; rollback senaryosunda cert kayıtları korur.

### 4.2 Model güncellemesi ([app/models/technician.py](../naro-backend/app/models/technician.py))

- `ProviderMode(StrEnum)` ekle.
- `TechnicianProfile`'a 3 kolon alanı ekle + Python property `effective_active_provider_type` (null ise primary döner).
- `TechnicianCertificateKind` enum'a `TOW_OPERATOR = "tow_operator"`.

### 4.3 Service layer — `app/services/technician_admission.py` (yeni)

```python
REQUIRED_CERTS: dict[tuple[ProviderType, ProviderMode], set[TechnicianCertificateKind]] = {
    (CEKICI, BUSINESS):         {IDENTITY, VEHICLE_LICENSE, TOW_OPERATOR, INSURANCE, TAX_REGISTRATION, TRADE_REGISTRY},
    (CEKICI, INDIVIDUAL):       {IDENTITY, VEHICLE_LICENSE, TOW_OPERATOR, INSURANCE, TAX_REGISTRATION},
    (USTA, BUSINESS):           {IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY},
    (USTA, INDIVIDUAL):         {IDENTITY, TAX_REGISTRATION},
    (KAPORTA_BOYA, BUSINESS):   {IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY, INSURANCE},
    (KAPORTA_BOYA, INDIVIDUAL): {IDENTITY, TAX_REGISTRATION, INSURANCE},
    (LASTIK, BUSINESS):         {IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY},
    (LASTIK, INDIVIDUAL):       {IDENTITY, TAX_REGISTRATION},
    (OTO_ELEKTRIK, BUSINESS):   {IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY, TECHNICAL},
    (OTO_ELEKTRIK, INDIVIDUAL): {IDENTITY, TAX_REGISTRATION, TECHNICAL},
    (OTO_AKSESUAR, BUSINESS):   {IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY},
    (OTO_AKSESUAR, INDIVIDUAL): {IDENTITY, TAX_REGISTRATION},
}

def required_cert_kinds(pt: ProviderType, pm: ProviderMode) -> set[TechnicianCertificateKind]: ...

async def recompute_admission(session, profile_id: UUID) -> bool:
    """REQUIRED_CERTS ⊆ approved_certs ise admission_gate_passed=True;
    aksi halde users.status='pending'. role_config_version bump."""

async def switch_active_role(session, profile_id: UUID, new_type: ProviderType) -> None:
    """new_type primary veya secondary'den biri olmalı.
    active_provider_type=new_type + role_config_version++ + cache invalidate."""
```

### 4.4 Shell config — `app/services/shell_config.py` (yeni)

> **Revize (2026-04-22):** Tab seti V1'de **sabit** `["home", "havuz", "kayitlar", "profil"]` — tüm roller için aynı. Home layout + quick actions rol-spesifik varyasyon taşır. Sebep: PO kararı — tab sayısı değişkenliği UI'da "farklı app" etkisi yaratıyordu; sabit iskelet daha temiz zihinsel model.

```python
FIXED_TAB_SET: list[str] = ["home", "havuz", "kayitlar", "profil"]

HOME_LAYOUTS: dict[tuple[ProviderType, ProviderMode], str] = {
    (CEKICI, BUSINESS):         "tow_focused",
    (CEKICI, INDIVIDUAL):       "tow_focused",
    (USTA, BUSINESS):           "full",
    (USTA, INDIVIDUAL):         "business_lite",
    (KAPORTA_BOYA, BUSINESS):   "damage_shop",
    (KAPORTA_BOYA, INDIVIDUAL): "business_lite",
    (LASTIK, BUSINESS):         "business_lite",
    (LASTIK, INDIVIDUAL):       "minimal",
    (OTO_ELEKTRIK, BUSINESS):   "business_lite",
    (OTO_ELEKTRIK, INDIVIDUAL): "minimal",
    (OTO_AKSESUAR, BUSINESS):   "business_lite",
    (OTO_AKSESUAR, INDIVIDUAL): "minimal",
}

QUICK_ACTIONS: dict[tuple[ProviderType, ProviderMode], list[QuickActionSpec]] = {
    # her satır rol+mode için, capability-bağlı action'lar `requires_capability` ile filtrelenir
    ...
}

async def build_shell_config(session, profile_id: UUID) -> ShellConfig:
    """Profile + certs + capabilities okuyup ShellConfig Pydantic döner.
    Admission fail → required_onboarding_steps dolu; tab_set sabit döner, UI locked state gösterir."""
```

### 4.5 API endpoint'ler

| Method | Path | Role | Body / Query | Response |
|---|---|---|---|---|
| GET | `/technicians/me/shell-config` | technician | — | `ShellConfig` |
| POST | `/technicians/me/switch-active-role` | technician | `{target_provider_type}` | `ShellConfig` (yeni) |
| PATCH | `/technicians/me/provider-mode` | technician | `{mode: business\|individual}` | `{role_config_version}` — onboarding re-triggered |
| POST | `/admin/technicians/{id}/provider-mode` | admin | aynı | admin override |

**Cache:** Redis `shell_config:{user_id}:{role_config_version}` TTL 300s. Response header `X-Role-Config-Version` frontend cache hint için.

**Rate limit:** shell-config 60/dk/user (polling'i engelle).

### 4.6 Pydantic şemaları — `app/schemas/shell_config.py` (yeni)

```python
class HomeLayout(StrEnum):
    TOW_FOCUSED = "tow_focused"
    FULL = "full"
    BUSINESS_LITE = "business_lite"
    MINIMAL = "minimal"
    DAMAGE_SHOP = "damage_shop"

class QuickAction(BaseModel):
    id: str
    label: str
    icon: str
    route: str
    requires_capability: str | None = None

class ShellConfig(BaseModel):
    primary_provider_type: ProviderType
    active_provider_type: ProviderType
    provider_mode: ProviderMode
    secondary_provider_types: list[ProviderType]
    verified_level: TechnicianVerifiedLevel
    admission_status: UserStatus
    admission_gate_passed: bool
    enabled_capabilities: list[str]   # 4 boolean capability'den true olanlar
    home_layout: HomeLayout
    tab_set: list[str] = Field(default_factory=lambda: ["home", "havuz", "kayitlar", "profil"])
    # V1: sabit FIXED_TAB_SET. Forward-compat için response'ta kalır; V2'de genişletilebilir.
    quick_action_set: list[QuickAction]
    required_onboarding_steps: list[str]
    required_cert_kinds: list[TechnicianCertificateKind]
    role_config_version: int
```

### 4.7 Dispatch filtreleme güncellemesi

[app/services/pool_matching.py](../naro-backend/app/services/pool_matching.py) + mevcut `list_pool_cases`:
- `active_provider_type` filter'ı eklenir. Multi-role kişi "şu an usta olarak çalışıyorum" ise çekici havuzu görmez.
- Acil çekici auto-dispatch havuzu (Faz 8 tow work): `provider_type='cekici' AND active_provider_type='cekici' AND admission_gate_passed=true`.

### 4.8 Testler — `tests/test_rol_ui/` (yeni dizin)

- `test_required_cert_matrix.py` — 12 kombinasyon (6 type × 2 mode)
- `test_admission_recompute.py` — cert eksik → status=pending + version bump
- `test_switch_active_role.py` — legal + illegal (secondary'de olmayan değer) transition
- `test_shell_config_build.py` — 12+ matris çıktısı beklenen alanları döner
- `test_shell_config_cache.py` — Redis TTL + version bump invalidate
- `test_dispatch_respects_active_role.py` — multi-role kişi active=usta iken çekici havuzuna girmez

### 4.9 Dokümantasyon

- [docs/veri-modeli/KARAR-LOG.md](veri-modeli/KARAR-LOG.md) — faz kaydı (PO tarafından yazıldı)
- [docs/veri-modeli/02-technician.md](veri-modeli/02-technician.md) — `provider_mode`, `active_provider_type`, `role_config_version` kolon + `tow_operator` cert_kind eklemesi dökümante edilir.

---

## 5. Acceptance criteria

- [ ] Alembic migration up/down idempotent (enum add_value rollback edilemeyeceği için migration comment'i not alır)
- [ ] `REQUIRED_CERTS` matrisi 12 kombinasyon için test geçer
- [ ] `/me/shell-config` response Zod ↔ Pydantic parity test ✓
- [ ] Redis cache + version bump akışı test ✓
- [ ] Admission failure → `required_onboarding_steps` UI'a doğru step ID'leriyle döner (`upload_cert:tow_operator` vs.)
- [ ] `switch-active-role` illegal transition 422 döner
- [ ] Dispatch pool query `active_provider_type` filter'ını kullanır
- [ ] `ruff + mypy + pytest` temiz geçer

---

## 6. Out of scope

- Side gig rolü ve `capability_attestation` cert — V2
- Onboarding path fork implementation — Frontend brief'inde; backend sadece `required_onboarding_steps` döner (UI hangi step'i nasıl render edeceğine karar verir)
- Satıcı / yedek parçacı yeni provider_type değerleri — sonraki iterasyon
- Mevcut technicians için bulk back-fill — migration default=business yeter; admin panel aracı ayrı PR

---

## 7. Açık sorular (BE'ye)

1. **Enum `ADD VALUE` rollback edilemiyor** (Postgres kısıtı) — migration comment'te belirt; PO onayı var, risk kabul edildi.
2. **`tow_operator` mevcut vehicle_license'a gömülsün mü?** Öneri: ayrı tutulsun — vehicle_license = araç ruhsatı, tow_operator = sürücü yetki belgesi. İkisi farklı belge.
3. **Admin endpoint `POST /admin/technicians/{id}/provider-mode`** scope — şimdi stub mu, tam admin UI Faz 10'a mı kalsın?

---

## 8. Referanslar

- [docs/rol-ui-mimarisi-frontend.md](rol-ui-mimarisi-frontend.md) — kardeş brief
- [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) §P0-3 (admission gate) + §3 (ürün kararları yansıması)
- [docs/cekici-backend-mimarisi.md](cekici-backend-mimarisi.md) — tow dispatch admission kuralları bu brief'e bağlı
- [docs/sinyal-hiyerarsi-mimari.md](sinyal-hiyerarsi-mimari.md) — provider_type admission ile uyumlu
- [memory/role_ui_separation.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/role_ui_separation.md) — ürün kararı memory
- [memory/tow_capability_gate.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/tow_capability_gate.md) — çekici aktivasyon kuralları (admission ile entegre)
