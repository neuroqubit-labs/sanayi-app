"""taxonomy_master: 5 master tablo + brand_tier enum + canonical seed

Revision ID: 20260422_0023
Revises: 20260422_0022
Create Date: 2026-04-22 22:00:00.000000

Faz 13 PR 4 Gün 3a — Signal model V2 master taxonomy (brief §4.1).

Tablolar:
- taxonomy_service_domains (12 domain seed)
- taxonomy_procedures (~30 popular procedure seed)
- taxonomy_brands (~22 popular brand seed, brand_tier enum)
- taxonomy_cities (81 TR il seed)
- taxonomy_districts (IST/ANK/IZM ilçeleri seed)
- taxonomy_drivetrains (9 drivetrain seed)

Enum:
- brand_tier ('mass','premium','luxury','commercial','motorcycle')

Downgrade: tüm tablolar + enum drop; read-only reference data olduğu için seed
kaybolur ama uygulama rows tutmaz (sadece master lookup).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260422_0023"
down_revision: str | None = "20260422_0022"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    _create_enum()
    _create_service_domains()
    _create_procedures()
    _create_brands()
    _create_cities()
    _create_districts()
    _create_drivetrains()


def downgrade() -> None:
    op.drop_table("taxonomy_drivetrains")
    op.drop_table("taxonomy_districts")
    op.drop_table("taxonomy_cities")
    op.drop_table("taxonomy_brands")
    op.drop_table("taxonomy_procedures")
    op.drop_table("taxonomy_service_domains")
    op.execute("DROP TYPE IF EXISTS brand_tier")


def _create_enum() -> None:
    # PG 16'da CREATE TYPE IF NOT EXISTS desteklenmez; DO block + pg_type check.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_tier') THEN
                CREATE TYPE brand_tier AS ENUM ('mass','premium','luxury','commercial','motorcycle');
            END IF;
        END
        $$;
        """
    )


def _create_service_domains() -> None:
    op.create_table(
        "taxonomy_service_domains",
        sa.Column("domain_key", sa.String(40), primary_key=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("icon", sa.String(40)),
        sa.Column("display_order", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _seed_service_domains()


def _seed_service_domains() -> None:
    rows = [
        ("motor", "Motor", "Motor bakım + revizyon + arıza teşhisi", "engine", 10),
        ("sanziman", "Şanzıman", "Otomatik/manuel şanzıman bakım + revizyon", "gearbox", 20),
        ("fren", "Fren", "Balata/disk + ABS + hidrolik", "brake", 30),
        ("suspansiyon", "Süspansiyon", "Amortisör, rot, salıncak", "suspension", 40),
        ("elektrik", "Elektrik", "Akü, alternatör, marş, kablo", "electric", 50),
        ("klima", "Klima", "Gaz dolumu, kompresör, evaporatör", "climate", 60),
        ("lastik", "Lastik", "Değişim, rotasyon, balans, tamir", "tire", 70),
        ("kaporta", "Kaporta + Boya", "Ezik, çizik, komple boya, pert", "body", 80),
        ("cam", "Cam + Film", "Değişim, tamir, cam filmi", "glass", 90),
        ("aku", "Akü + Elektronik", "Akü değişim, batarya, OBD", "battery", 100),
        ("aksesuar", "Aksesuar", "Multimedya, far, alarm, donanım", "accessories", 110),
        ("cekici", "Çekici + Yol yardım", "Çekici, jump start, lastik patlağı", "tow", 120),
    ]
    op.bulk_insert(
        sa.table(
            "taxonomy_service_domains",
            sa.column("domain_key", sa.String),
            sa.column("label", sa.String),
            sa.column("description", sa.Text),
            sa.column("icon", sa.String),
            sa.column("display_order", sa.SmallInteger),
        ),
        [
            {
                "domain_key": key,
                "label": label,
                "description": desc,
                "icon": icon,
                "display_order": order,
            }
            for key, label, desc, icon, order in rows
        ],
    )


def _create_procedures() -> None:
    op.create_table(
        "taxonomy_procedures",
        sa.Column("procedure_key", sa.String(60), primary_key=True),
        sa.Column(
            "domain_key",
            sa.String(40),
            sa.ForeignKey("taxonomy_service_domains.domain_key"),
            nullable=False,
        ),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("typical_labor_hours_min", sa.Numeric(5, 2)),
        sa.Column("typical_labor_hours_max", sa.Numeric(5, 2)),
        sa.Column("typical_parts_cost_min", sa.Numeric(10, 2)),
        sa.Column("typical_parts_cost_max", sa.Numeric(10, 2)),
        sa.Column("is_popular", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("display_order", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_taxonomy_procedures_domain",
        "taxonomy_procedures",
        ["domain_key", "is_active"],
    )
    op.create_index(
        "ix_taxonomy_procedures_popular",
        "taxonomy_procedures",
        ["domain_key", "is_popular", "display_order"],
    )
    _seed_procedures()


def _seed_procedures() -> None:
    # Seed ~30 popular procedure — domain başına 2-4.
    rows = [
        ("yag_bakimi", "motor", "Yağ + Filtre Bakımı", True, 10),
        ("zamanlama_kiti", "motor", "Zamanlama Kiti (Eksantrik) Değişim", True, 20),
        ("turbo_rebuild", "motor", "Turbo Rebuild / Değişim", False, 30),
        ("motor_teshis", "motor", "OBD Teşhis", True, 5),
        ("sanziman_yag", "sanziman", "Şanzıman Yağ Değişimi", True, 10),
        ("sanziman_revizyon", "sanziman", "Şanzıman Revizyonu", False, 20),
        ("balata", "fren", "Balata Değişim", True, 10),
        ("disk_balata", "fren", "Disk + Balata Değişim", True, 15),
        ("abs_teshis", "fren", "ABS Teşhis", False, 20),
        ("amortisor", "suspansiyon", "Amortisör Değişim", True, 10),
        ("rot_balans", "suspansiyon", "Rot-Balans", True, 20),
        ("aku_degisim", "elektrik", "Akü Değişim", True, 10),
        ("alternator", "elektrik", "Alternatör Değişim", False, 20),
        ("mars", "elektrik", "Marş Motoru", False, 30),
        ("klima_gaz", "klima", "Klima Gaz Dolumu", True, 10),
        ("klima_kompresor", "klima", "Klima Kompresör", False, 20),
        ("lastik_degisim", "lastik", "Lastik Değişim (4)", True, 10),
        ("lastik_rotasyon", "lastik", "Rotasyon + Balans", True, 20),
        ("lastik_tamir", "lastik", "Lastik Tamiri", True, 30),
        ("kucuk_kaporta", "kaporta", "Küçük Ezik/Çizik", True, 10),
        ("panel_boya", "kaporta", "Panel Boyama", True, 20),
        ("komple_boya", "kaporta", "Komple Boya", False, 30),
        ("pert", "kaporta", "Pert Ekspertizi", False, 40),
        ("on_cam", "cam", "Ön Cam Değişim", True, 10),
        ("cam_filmi", "cam", "Cam Filmi", True, 20),
        ("cam_tamir", "cam", "Cam Tamiri", True, 30),
        ("multimedya", "aksesuar", "Multimedya Kurulum", False, 10),
        ("alarm", "aksesuar", "Alarm / Immobilizer", False, 20),
        ("cekici_standart", "cekici", "Standart Çekici", True, 10),
        ("yol_yardim", "cekici", "Yol Yardım (Jump/Stepne)", True, 20),
    ]
    op.bulk_insert(
        sa.table(
            "taxonomy_procedures",
            sa.column("procedure_key", sa.String),
            sa.column("domain_key", sa.String),
            sa.column("label", sa.String),
            sa.column("is_popular", sa.Boolean),
            sa.column("display_order", sa.SmallInteger),
        ),
        [
            {
                "procedure_key": key,
                "domain_key": domain,
                "label": label,
                "is_popular": popular,
                "display_order": order,
            }
            for key, domain, label, popular, order in rows
        ],
    )


def _create_brands() -> None:
    op.create_table(
        "taxonomy_brands",
        sa.Column("brand_key", sa.String(40), primary_key=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column(
            "tier",
            postgresql.ENUM(
                "mass", "premium", "luxury", "commercial", "motorcycle",
                name="brand_tier", create_type=False,
            ),
            nullable=False,
            server_default="mass",
        ),
        sa.Column("country_code", sa.String(2)),
        sa.Column("display_order", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _seed_brands()


def _seed_brands() -> None:
    # Seed ~22 popular brand — tier + country
    rows = [
        ("tofas_fiat", "Fiat / Tofaş", "mass", "TR", 10),
        ("renault", "Renault", "mass", "FR", 20),
        ("volkswagen", "Volkswagen", "mass", "DE", 30),
        ("hyundai", "Hyundai", "mass", "KR", 40),
        ("toyota", "Toyota", "mass", "JP", 50),
        ("ford", "Ford", "mass", "US", 60),
        ("opel", "Opel", "mass", "DE", 70),
        ("peugeot", "Peugeot", "mass", "FR", 80),
        ("dacia", "Dacia", "mass", "RO", 90),
        ("skoda", "Škoda", "mass", "CZ", 100),
        ("seat", "SEAT", "mass", "ES", 110),
        ("honda", "Honda", "mass", "JP", 120),
        ("nissan", "Nissan", "mass", "JP", 130),
        ("kia", "Kia", "mass", "KR", 140),
        ("bmw", "BMW", "premium", "DE", 200),
        ("mercedes", "Mercedes-Benz", "premium", "DE", 210),
        ("audi", "Audi", "premium", "DE", 220),
        ("volvo", "Volvo", "premium", "SE", 230),
        ("porsche", "Porsche", "luxury", "DE", 300),
        ("bentley", "Bentley", "luxury", "GB", 310),
        ("iveco", "IVECO", "commercial", "IT", 400),
        ("ducati", "Ducati", "motorcycle", "IT", 500),
    ]
    # Enum kolonlara raw SQL cast — bulk_insert Python str → asyncpg VARCHAR
    # gönderiyor; DB enum bekliyor. Raw SQL ile her row insert.
    for key, label, tier, country, order in rows:
        op.execute(
            sa.text(
                "INSERT INTO taxonomy_brands (brand_key, label, tier, country_code, display_order) "
                "VALUES (:key, :label, CAST(:tier AS brand_tier), :country, :order)"
            ).bindparams(
                key=key, label=label, tier=tier, country=country, order=order
            )
        )


def _create_cities() -> None:
    op.create_table(
        "taxonomy_cities",
        sa.Column("city_code", sa.String(8), primary_key=True),
        sa.Column("label", sa.String(80), nullable=False),
        sa.Column("region", sa.String(40)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    _seed_cities()


def _seed_cities() -> None:
    # 81 TR plaka + bölge. Seed tam.
    rows = [
        ("01", "Adana", "Akdeniz"), ("02", "Adıyaman", "Güneydoğu"),
        ("03", "Afyonkarahisar", "Ege"), ("04", "Ağrı", "Doğu"),
        ("05", "Amasya", "Karadeniz"), ("06", "Ankara", "İç Anadolu"),
        ("07", "Antalya", "Akdeniz"), ("08", "Artvin", "Karadeniz"),
        ("09", "Aydın", "Ege"), ("10", "Balıkesir", "Marmara"),
        ("11", "Bilecik", "Marmara"), ("12", "Bingöl", "Doğu"),
        ("13", "Bitlis", "Doğu"), ("14", "Bolu", "Karadeniz"),
        ("15", "Burdur", "Akdeniz"), ("16", "Bursa", "Marmara"),
        ("17", "Çanakkale", "Marmara"), ("18", "Çankırı", "İç Anadolu"),
        ("19", "Çorum", "Karadeniz"), ("20", "Denizli", "Ege"),
        ("21", "Diyarbakır", "Güneydoğu"), ("22", "Edirne", "Marmara"),
        ("23", "Elazığ", "Doğu"), ("24", "Erzincan", "Doğu"),
        ("25", "Erzurum", "Doğu"), ("26", "Eskişehir", "İç Anadolu"),
        ("27", "Gaziantep", "Güneydoğu"), ("28", "Giresun", "Karadeniz"),
        ("29", "Gümüşhane", "Karadeniz"), ("30", "Hakkari", "Doğu"),
        ("31", "Hatay", "Akdeniz"), ("32", "Isparta", "Akdeniz"),
        ("33", "Mersin", "Akdeniz"), ("34", "İstanbul", "Marmara"),
        ("35", "İzmir", "Ege"), ("36", "Kars", "Doğu"),
        ("37", "Kastamonu", "Karadeniz"), ("38", "Kayseri", "İç Anadolu"),
        ("39", "Kırklareli", "Marmara"), ("40", "Kırşehir", "İç Anadolu"),
        ("41", "Kocaeli", "Marmara"), ("42", "Konya", "İç Anadolu"),
        ("43", "Kütahya", "Ege"), ("44", "Malatya", "Doğu"),
        ("45", "Manisa", "Ege"), ("46", "Kahramanmaraş", "Akdeniz"),
        ("47", "Mardin", "Güneydoğu"), ("48", "Muğla", "Ege"),
        ("49", "Muş", "Doğu"), ("50", "Nevşehir", "İç Anadolu"),
        ("51", "Niğde", "İç Anadolu"), ("52", "Ordu", "Karadeniz"),
        ("53", "Rize", "Karadeniz"), ("54", "Sakarya", "Marmara"),
        ("55", "Samsun", "Karadeniz"), ("56", "Siirt", "Güneydoğu"),
        ("57", "Sinop", "Karadeniz"), ("58", "Sivas", "İç Anadolu"),
        ("59", "Tekirdağ", "Marmara"), ("60", "Tokat", "Karadeniz"),
        ("61", "Trabzon", "Karadeniz"), ("62", "Tunceli", "Doğu"),
        ("63", "Şanlıurfa", "Güneydoğu"), ("64", "Uşak", "Ege"),
        ("65", "Van", "Doğu"), ("66", "Yozgat", "İç Anadolu"),
        ("67", "Zonguldak", "Karadeniz"), ("68", "Aksaray", "İç Anadolu"),
        ("69", "Bayburt", "Karadeniz"), ("70", "Karaman", "İç Anadolu"),
        ("71", "Kırıkkale", "İç Anadolu"), ("72", "Batman", "Güneydoğu"),
        ("73", "Şırnak", "Güneydoğu"), ("74", "Bartın", "Karadeniz"),
        ("75", "Ardahan", "Doğu"), ("76", "Iğdır", "Doğu"),
        ("77", "Yalova", "Marmara"), ("78", "Karabük", "Karadeniz"),
        ("79", "Kilis", "Güneydoğu"), ("80", "Osmaniye", "Akdeniz"),
        ("81", "Düzce", "Karadeniz"),
    ]
    op.bulk_insert(
        sa.table(
            "taxonomy_cities",
            sa.column("city_code", sa.String),
            sa.column("label", sa.String),
            sa.column("region", sa.String),
        ),
        [{"city_code": c, "label": l, "region": r} for c, l, r in rows],
    )


def _create_districts() -> None:
    op.create_table(
        "taxonomy_districts",
        sa.Column(
            "district_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "city_code",
            sa.String(8),
            sa.ForeignKey("taxonomy_cities.city_code"),
            nullable=False,
        ),
        sa.Column("label", sa.String(80), nullable=False),
        sa.Column("center_lat", sa.Numeric(9, 6)),
        sa.Column("center_lng", sa.Numeric(9, 6)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("city_code", "label", name="uq_taxonomy_districts_city_label"),
    )
    op.create_index(
        "ix_districts_city", "taxonomy_districts", ["city_code", "is_active"]
    )
    _seed_districts()


def _seed_districts() -> None:
    # IST (34) + ANK (06) + IZM (35) popular districts V1 seed.
    rows = [
        ("34", "Kadıköy"), ("34", "Beşiktaş"), ("34", "Şişli"),
        ("34", "Beyoğlu"), ("34", "Üsküdar"), ("34", "Bakırköy"),
        ("34", "Maltepe"), ("34", "Ataşehir"), ("34", "Pendik"),
        ("34", "Kartal"), ("34", "Bağcılar"), ("34", "Küçükçekmece"),
        ("34", "Ümraniye"), ("34", "Sancaktepe"), ("34", "Zeytinburnu"),
        ("34", "Fatih"), ("34", "Avcılar"), ("34", "Esenler"),
        ("06", "Çankaya"), ("06", "Keçiören"), ("06", "Yenimahalle"),
        ("06", "Mamak"), ("06", "Sincan"), ("06", "Altındağ"),
        ("06", "Etimesgut"), ("06", "Gölbaşı"), ("06", "Polatlı"),
        ("35", "Karşıyaka"), ("35", "Bornova"), ("35", "Konak"),
        ("35", "Buca"), ("35", "Bayraklı"), ("35", "Gaziemir"),
        ("35", "Çiğli"), ("35", "Karabağlar"),
    ]
    op.bulk_insert(
        sa.table(
            "taxonomy_districts",
            sa.column("city_code", sa.String),
            sa.column("label", sa.String),
        ),
        [{"city_code": c, "label": l} for c, l in rows],
    )


def _create_drivetrains() -> None:
    op.create_table(
        "taxonomy_drivetrains",
        sa.Column("drivetrain_key", sa.String(40), primary_key=True),
        sa.Column("label", sa.String(80), nullable=False),
        sa.Column("fuel_type", sa.String(20), nullable=False),
        sa.Column("transmission", sa.String(20)),
        sa.Column("display_order", sa.SmallInteger, nullable=False, server_default="0"),
    )
    _seed_drivetrains()


def _seed_drivetrains() -> None:
    rows = [
        ("benzin_otomatik", "Benzin Otomatik", "benzin", "otomatik", 10),
        ("benzin_manuel", "Benzin Manuel", "benzin", "manuel", 20),
        ("dizel_otomatik", "Dizel Otomatik", "dizel", "otomatik", 30),
        ("dizel_manuel", "Dizel Manuel", "dizel", "manuel", 40),
        ("hibrit", "Hibrit", "hibrit", "otomatik", 50),
        ("ev", "Elektrikli", "ev", "otomatik", 60),
        ("lpg_donusumlu", "LPG Dönüşümlü", "lpg", "manuel", 70),
        ("cng_donusumlu", "CNG Dönüşümlü", "cng", None, 80),
        ("motosiklet", "Motosiklet", "benzin", "manuel", 90),
    ]
    op.bulk_insert(
        sa.table(
            "taxonomy_drivetrains",
            sa.column("drivetrain_key", sa.String),
            sa.column("label", sa.String),
            sa.column("fuel_type", sa.String),
            sa.column("transmission", sa.String),
            sa.column("display_order", sa.SmallInteger),
        ),
        [
            {
                "drivetrain_key": key,
                "label": label,
                "fuel_type": fuel,
                "transmission": trans,
                "display_order": order,
            }
            for key, label, fuel, trans, order in rows
        ],
    )
