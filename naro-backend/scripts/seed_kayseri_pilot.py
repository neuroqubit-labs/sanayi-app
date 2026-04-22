"""Kayseri Pilot Seed — 10 mock technician_profile (Faz B Seed Kick).

Kullanım:
    cd naro-backend
    set -a && source .env.local && set +a
    uv run python scripts/seed_kayseri_pilot.py

Idempotent — 2x çalıştırınca aynı 10 kayıt (phone check).

Dağılım (Kayseri profesyonel servisler pilotu):
- 3 × USTA (bakım odaklı: motor + fren + lastik + elektrik)
- 3 × USTA (arıza odaklı: motor + klima + transmisyon + elektrik)
- 2 × CEKICI (çekici + yol yardım)
- 2 × USTA (hasar/boya odaklı: kaporta + boya + cam)

Yardımcı yan-etkiler:
- taxonomy_districts: 5 Kayseri district (Melikgazi, Kocasinan, Talas,
  İncesu, Hacılar) insert if not exists

Mock'luk pilotta kullanıcıya şeffaf — /technicians/public/feed filtre etmez.
Admin moderation: `is_mock = true` partial index üzerinden hızlı query.
"""

from __future__ import annotations

import asyncio
import logging
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.taxonomy import TaxonomyDistrict
from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianAvailability,
    TechnicianCapability,
    TechnicianProfile,
    TechnicianVerifiedLevel,
)
from app.models.technician_signal import (
    TechnicianBrandCoverage,
    TechnicianDrivetrainCoverage,
    TechnicianServiceArea,
    TechnicianServiceDomain,
)
from app.models.user import User, UserApprovalStatus, UserRole, UserStatus

logger = logging.getLogger("seed_kayseri_pilot")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

# ─── Kayseri 5 district (merkez) ──────────────────────────────────────────

KAYSERI_DISTRICTS: list[tuple[str, Decimal, Decimal]] = [
    ("Melikgazi", Decimal("38.733056"), Decimal("35.485278")),
    ("Kocasinan", Decimal("38.739167"), Decimal("35.463889")),
    ("Talas", Decimal("38.692500"), Decimal("35.555833")),
    ("İncesu", Decimal("38.641944"), Decimal("35.188889")),
    ("Hacılar", Decimal("38.617500"), Decimal("35.446944")),
]

# ─── 10 popüler marka (pilot için) ────────────────────────────────────────

POPULAR_BRANDS: list[str] = [
    "bmw",
    "mercedes",
    "audi",
    "volkswagen",
    "renault",
    "tofas_fiat",
    "toyota",
    "hyundai",
    "kia",
    "dacia",
]

# ─── Tüm drivetrain'ler ───────────────────────────────────────────────────

ALL_DRIVETRAINS: list[str] = [
    "benzin_otomatik",
    "benzin_manuel",
    "dizel_otomatik",
    "dizel_manuel",
    "hibrit",
    "ev",
    "lpg_donusumlu",
]

# ─── 10 mock profil spec ──────────────────────────────────────────────────


class MockSpec:
    __slots__ = (
        "biography",
        "capability",
        "display_name",
        "district_idx",
        "email",
        "full_name",
        "index",
        "phone",
        "provider_type",
        "radius_km",
        "service_domains",
        "tagline",
    )

    def __init__(
        self,
        index: int,
        phone: str,
        email: str,
        full_name: str,
        display_name: str,
        tagline: str,
        biography: str,
        provider_type: ProviderType,
        service_domains: list[str],
        district_idx: int,
        radius_km: int,
        capability: dict[str, bool],
    ) -> None:
        self.index = index
        self.phone = phone
        self.email = email
        self.full_name = full_name
        self.display_name = display_name
        self.tagline = tagline
        self.biography = biography
        self.provider_type = provider_type
        self.service_domains = service_domains
        self.district_idx = district_idx
        self.radius_km = radius_km
        self.capability = capability


MOCK_PROFILES: list[MockSpec] = [
    # 3 × Bakım odaklı (USTA)
    MockSpec(
        index=1,
        phone="+905559000001",
        email="pilot-kayseri-01@mock.naro.app",
        full_name="Erciyes Bakım Merkezi",
        display_name="Erciyes Bakım Merkezi",
        tagline="15 yıllık periyodik bakım deneyimi",
        biography="Melikgazi merkezde BMW, Mercedes ve Audi için yetkili "
        "servis kalitesinde periyodik bakım. Motor, fren, lastik + elektrik.",
        provider_type=ProviderType.USTA,
        service_domains=["motor", "fren", "lastik", "elektrik"],
        district_idx=0,  # Melikgazi
        radius_km=10,
        capability={"on_site_repair": False, "valet_service": True},
    ),
    MockSpec(
        index=2,
        phone="+905559000002",
        email="pilot-kayseri-02@mock.naro.app",
        full_name="Kayseri Oto Bakım Servis",
        display_name="Kayseri Oto Bakım Servis",
        tagline="Aile işletmesi, 3 kuşak usta",
        biography="Kocasinan'da 1998'den beri Renault, Fiat, Dacia uzmanı. "
        "Yağ + filtre + akü + lastik bakımı.",
        provider_type=ProviderType.USTA,
        service_domains=["motor", "fren", "aku", "lastik"],
        district_idx=1,  # Kocasinan
        radius_km=8,
        capability={"on_site_repair": True, "valet_service": False},
    ),
    MockSpec(
        index=3,
        phone="+905559000003",
        email="pilot-kayseri-03@mock.naro.app",
        full_name="Talas Oto Merkez",
        display_name="Talas Oto Merkez",
        tagline="Hızlı servis + şeffaf fiyat",
        biography="Talas'ta 10+ yıldır Toyota, Hyundai, Kia periyodik bakım "
        "uzmanı. Online randevu + SMS bildirim.",
        provider_type=ProviderType.USTA,
        service_domains=["motor", "fren", "klima", "lastik"],
        district_idx=2,  # Talas
        radius_km=7,
        capability={"on_site_repair": False, "valet_service": True},
    ),
    # 3 × Arıza odaklı (USTA)
    MockSpec(
        index=4,
        phone="+905559000004",
        email="pilot-kayseri-04@mock.naro.app",
        full_name="Oto Elektrik Kayseri",
        display_name="Oto Elektrik Kayseri",
        tagline="Arıza teşhis uzmanı — ECU + sensör",
        biography="Melikgazi'de tüm marka araçlar için elektrik, klima ve "
        "transmisyon arıza teşhisi. 24 saat içinde servis.",
        provider_type=ProviderType.USTA,
        service_domains=["elektrik", "klima", "sanziman", "aku"],
        district_idx=0,  # Melikgazi
        radius_km=12,
        capability={"on_site_repair": True, "valet_service": False},
    ),
    MockSpec(
        index=5,
        phone="+905559000005",
        email="pilot-kayseri-05@mock.naro.app",
        full_name="Kocasinan Arıza Servisi",
        display_name="Kocasinan Arıza Servisi",
        tagline="Yol yardım + yerinde onarım",
        biography="Kocasinan merkezde acil arıza servisi. Motor, klima, "
        "süspansiyon. VW, Peugeot, Opel deneyimi.",
        provider_type=ProviderType.USTA,
        service_domains=["motor", "klima", "suspansiyon", "elektrik"],
        district_idx=1,  # Kocasinan
        radius_km=10,
        capability={"on_site_repair": True, "valet_service": True},
    ),
    MockSpec(
        index=6,
        phone="+905559000006",
        email="pilot-kayseri-06@mock.naro.app",
        full_name="Erciyes Motor Uzmanı",
        display_name="Erciyes Motor Uzmanı",
        tagline="Motor revizyonu + şanzıman",
        biography="İncesu'da 20 yıllık motor revizyonu tecrübesi. BMW, "
        "Mercedes, Audi büyük onarım. Hibrit + elektrikli araç sertifikalı.",
        provider_type=ProviderType.USTA,
        service_domains=["motor", "sanziman", "elektrik"],
        district_idx=3,  # İncesu
        radius_km=15,
        capability={"on_site_repair": False, "valet_service": True},
    ),
    # 2 × CEKICI
    MockSpec(
        index=7,
        phone="+905559000007",
        email="pilot-kayseri-07@mock.naro.app",
        full_name="7/24 Çekici Kayseri",
        display_name="7/24 Çekici Kayseri",
        tagline="7/24 yol yardım + şehirler arası",
        biography="Kayseri + çevre illere 7/24 çekici hizmeti. 4 araçlık "
        "filo, max 30dk yanıt süresi.",
        provider_type=ProviderType.CEKICI,
        service_domains=["cekici"],
        district_idx=0,  # Melikgazi (merkez)
        radius_km=50,
        capability={"on_site_repair": False, "towing_coordination": True},
    ),
    MockSpec(
        index=8,
        phone="+905559000008",
        email="pilot-kayseri-08@mock.naro.app",
        full_name="Erciyes Çekici",
        display_name="Erciyes Çekici",
        tagline="Şehir içi hızlı çekici",
        biography="Melikgazi + Kocasinan + Talas üçgeninde ortalama 15dk "
        "yanıt. Kaza + arıza çekme deneyimi.",
        provider_type=ProviderType.CEKICI,
        service_domains=["cekici"],
        district_idx=1,  # Kocasinan
        radius_km=25,
        capability={"on_site_repair": False, "towing_coordination": True},
    ),
    # 2 × USTA (Hasar/Boya odaklı)
    MockSpec(
        index=9,
        phone="+905559000009",
        email="pilot-kayseri-09@mock.naro.app",
        full_name="Kaporta Boya Kayseri",
        display_name="Kaporta Boya Kayseri",
        tagline="Sigorta onaylı kaporta + boya uzmanı",
        biography="Hacılar'da sigorta onaylı kaporta-boya servisi. Axa, "
        "Allianz, Anadolu ile çalışıyoruz. Ekspertiz ücretsiz.",
        provider_type=ProviderType.USTA,
        service_domains=["kaporta", "cam"],
        district_idx=4,  # Hacılar
        radius_km=20,
        capability={
            "insurance_case_handler": True,
            "on_site_repair": False,
            "valet_service": True,
        },
    ),
    MockSpec(
        index=10,
        phone="+905559000010",
        email="pilot-kayseri-10@mock.naro.app",
        full_name="Talas Kaporta Merkezi",
        display_name="Talas Kaporta Merkezi",
        tagline="Kaporta + cam + film + detay",
        biography="Talas'ta profesyonel kaporta onarımı, boya, cam + film "
        "uygulaması. PDR (göçük giderme) uzmanı.",
        provider_type=ProviderType.USTA,
        service_domains=["kaporta", "cam"],
        district_idx=2,  # Talas
        radius_km=15,
        capability={
            "insurance_case_handler": True,
            "on_site_repair": False,
            "valet_service": False,
        },
    ),
]


# ─── Helpers ──────────────────────────────────────────────────────────────


async def _upsert_kayseri_districts(
    db: AsyncSession,
) -> list[UUID]:
    """5 Kayseri district'i insert if not exists. Idempotent."""
    district_ids: list[UUID] = []
    for label, lat, lng in KAYSERI_DISTRICTS:
        stmt = select(TaxonomyDistrict).where(
            TaxonomyDistrict.city_code == "38",
            TaxonomyDistrict.label == label,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            district_ids.append(existing.district_id)
            continue
        new_id = uuid4()
        district = TaxonomyDistrict(
            district_id=new_id,
            city_code="38",
            label=label,
            center_lat=lat,
            center_lng=lng,
        )
        db.add(district)
        await db.flush()
        district_ids.append(new_id)
        logger.info("district inserted: %s (%s)", label, new_id)
    return district_ids


async def _upsert_user(db: AsyncSession, spec: MockSpec) -> User:
    stmt = select(User).where(User.phone == spec.phone)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return existing
    user = User(
        phone=spec.phone,
        email=spec.email,
        full_name=spec.full_name,
        role=UserRole.TECHNICIAN,
        status=UserStatus.ACTIVE,
        approval_status=UserApprovalStatus.ACTIVE,
    )
    db.add(user)
    await db.flush()
    logger.info("user inserted: %s (%s)", spec.phone, user.id)
    return user


async def _upsert_profile(
    db: AsyncSession, user: User, spec: MockSpec
) -> TechnicianProfile:
    stmt = select(TechnicianProfile).where(
        TechnicianProfile.user_id == user.id
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return existing
    profile = TechnicianProfile(
        user_id=user.id,
        display_name=spec.display_name,
        tagline=spec.tagline,
        biography=spec.biography,
        availability=TechnicianAvailability.AVAILABLE,
        verified_level=TechnicianVerifiedLevel.VERIFIED,
        provider_type=spec.provider_type,
        provider_mode=ProviderMode.BUSINESS,
        active_provider_type=spec.provider_type,
        is_mock=True,
    )
    db.add(profile)
    await db.flush()
    logger.info(
        "profile inserted: %s (%s, is_mock=true)",
        spec.display_name,
        profile.id,
    )
    return profile


async def _upsert_capability(
    db: AsyncSession, profile_id: UUID, caps: dict[str, bool]
) -> None:
    stmt = select(TechnicianCapability).where(
        TechnicianCapability.profile_id == profile_id
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return
    cap = TechnicianCapability(
        profile_id=profile_id,
        insurance_case_handler=caps.get("insurance_case_handler", False),
        on_site_repair=caps.get("on_site_repair", False),
        valet_service=caps.get("valet_service", False),
        towing_coordination=caps.get("towing_coordination", False),
    )
    db.add(cap)
    await db.flush()


async def _upsert_service_domains(
    db: AsyncSession, profile_id: UUID, domains: list[str]
) -> None:
    for domain_key in domains:
        stmt = select(TechnicianServiceDomain).where(
            TechnicianServiceDomain.profile_id == profile_id,
            TechnicianServiceDomain.domain_key == domain_key,
        )
        if (await db.execute(stmt)).scalar_one_or_none() is not None:
            continue
        db.add(
            TechnicianServiceDomain(
                profile_id=profile_id, domain_key=domain_key
            )
        )
    await db.flush()


async def _upsert_brand_coverage(
    db: AsyncSession, profile_id: UUID
) -> None:
    for brand_key in POPULAR_BRANDS:
        stmt = select(TechnicianBrandCoverage).where(
            TechnicianBrandCoverage.profile_id == profile_id,
            TechnicianBrandCoverage.brand_key == brand_key,
        )
        if (await db.execute(stmt)).scalar_one_or_none() is not None:
            continue
        db.add(
            TechnicianBrandCoverage(
                profile_id=profile_id,
                brand_key=brand_key,
                is_authorized=False,
                is_premium_authorized=False,
            )
        )
    await db.flush()


async def _upsert_drivetrain_coverage(
    db: AsyncSession, profile_id: UUID
) -> None:
    for key in ALL_DRIVETRAINS:
        stmt = select(TechnicianDrivetrainCoverage).where(
            TechnicianDrivetrainCoverage.profile_id == profile_id,
            TechnicianDrivetrainCoverage.drivetrain_key == key,
        )
        if (await db.execute(stmt)).scalar_one_or_none() is not None:
            continue
        db.add(
            TechnicianDrivetrainCoverage(
                profile_id=profile_id, drivetrain_key=key
            )
        )
    await db.flush()


async def _upsert_service_area(
    db: AsyncSession,
    profile_id: UUID,
    district_id: UUID,
    district_lat: Decimal,
    district_lng: Decimal,
    radius_km: int,
) -> None:
    stmt = select(TechnicianServiceArea).where(
        TechnicianServiceArea.profile_id == profile_id
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return
    area = TechnicianServiceArea(
        profile_id=profile_id,
        workshop_lat=district_lat,
        workshop_lng=district_lng,
        service_radius_km=radius_km,
        city_code="38",
        primary_district_id=district_id,
        mobile_unit_count=0,
    )
    db.add(area)
    await db.flush()


async def _seed_mock(
    db: AsyncSession, spec: MockSpec, district_ids: list[UUID]
) -> None:
    user = await _upsert_user(db, spec)
    profile = await _upsert_profile(db, user, spec)
    await _upsert_capability(db, profile.id, spec.capability)
    await _upsert_service_domains(db, profile.id, spec.service_domains)
    await _upsert_brand_coverage(db, profile.id)
    await _upsert_drivetrain_coverage(db, profile.id)
    district_id = district_ids[spec.district_idx]
    _, district_lat, district_lng = KAYSERI_DISTRICTS[spec.district_idx]
    await _upsert_service_area(
        db,
        profile.id,
        district_id,
        district_lat,
        district_lng,
        spec.radius_km,
    )


async def main() -> None:
    async with AsyncSessionLocal() as db:
        district_ids = await _upsert_kayseri_districts(db)
        for spec in MOCK_PROFILES:
            await _seed_mock(db, spec, district_ids)
        await db.commit()

    async with AsyncSessionLocal() as db:
        count_stmt = select(TechnicianProfile).where(
            TechnicianProfile.is_mock.is_(True)
        )
        mocks = list((await db.execute(count_stmt)).scalars().all())
        logger.info("total mock profiles in DB: %d", len(mocks))


if __name__ == "__main__":
    asyncio.run(main())
