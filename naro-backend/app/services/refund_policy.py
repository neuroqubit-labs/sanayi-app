"""Refund policy (Faz B-1, brief §7.1).

V1 simplified — müşteri iptali sadece tow'da fee'li (Faz 10 TowCancellation).
Non-tow (bakım/arıza/hasar) kind'larda iptal ücreti **YOK** (brief §7.2).
Usta reputation dolaylı dengeleme.

V2: kind-bazlı cancellation_fee matrix. Şimdi hazırlık — fonksiyon interface
kalır, V1 %0 döner.

Decimal strict — float sızmaz (B-3 bayrağı).
"""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal
from enum import StrEnum


class CancellationStage(StrEnum):
    """Case içinde iptal anındaki stage. refund_policy matrix'in anchor'ı.

    matching / offers_ready / scheduled / service_in_progress
    Brief §7.1 tablosundan türetildi.
    """

    BEFORE_OFFER_ACCEPT = "before_offer_accept"
    AFTER_OFFER_BEFORE_SCHEDULE = "after_offer_before_schedule"
    DAY_BEFORE_APPOINTMENT = "day_before_appointment"  # 24h+ öncesi
    DAY_OF_APPOINTMENT = "day_of_appointment"  # <24h
    SERVICE_IN_PROGRESS = "service_in_progress"


class CancellationActor(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"
    SYSTEM = "system"
    ADMIN = "admin"


_ZERO = Decimal("0.00")


def compute_cancellation_fee(
    *,
    preauth_amount: Decimal,
    stage: CancellationStage,
    actor: CancellationActor,
) -> Decimal:
    """V1 non-tow cancellation fee — brief §7.2: her durumda %0.

    Tow fee'leri tow_cancellation_flow.py içinde ayrı. V2'de bu fn
    kind-bazlı matrix olur.

    Args:
        preauth_amount: Mevcut pre-auth hold tutarı (Decimal).
        stage: İptal anındaki finansal stage.
        actor: Kim iptal etti (customer/technician/system/admin).

    Returns:
        Müşteriden capture edilecek cancellation fee (Decimal). V1'de 0.00.
    """
    _ = preauth_amount, stage, actor  # V1'de fee = 0; V2'de matrix param
    return _ZERO


def quantize_money(amount: Decimal) -> Decimal:
    """Finansal tutarı 2 ondalığa ROUND_HALF_EVEN ile yuvarla.

    Brief B-3 bayrağı — float asla; Decimal exact. Commission + net
    hesaplamalarında tek giriş noktası.
    """
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)


V1_COMMISSION_RATE: Decimal = Decimal("0.1000")


def calculate_commission(
    gross_amount: Decimal,
    rate: Decimal = V1_COMMISSION_RATE,
) -> tuple[Decimal, Decimal]:
    """Komisyon + net hesapla — Decimal strict, ROUND_HALF_EVEN.

    Brief §4.1 — V1 flat %10.
    Invariant I-BILL-3: `gross = commission + net` (decimal exact).

    Args:
        gross_amount: Toplam capture tutarı (iş bitince müşteriden tahsil).
        rate: Komisyon oranı (default V1 %10 = 0.1000).

    Returns:
        (commission, net_to_technician) — Decimal pair, quantize 0.01.
    """
    commission = quantize_money(gross_amount * rate)
    net = quantize_money(gross_amount - commission)
    return commission, net
