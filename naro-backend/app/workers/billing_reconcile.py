"""ARQ job — non-tow billing pre-auth reconcile (Faz 1 stale recovery).

30-dk cron: ServiceCase.billing_state=PREAUTH_REQUESTED ve updated_at
< now - PREAUTH_TIMEOUT_THRESHOLD olan vakaları PREAUTH_FAILED'e çek.

Senaryo: Iyzico checkout form başlatıldı, kullanıcı 3DS WebView'i açtı ama
webhook callback ulaşmadı (network partition, app kill, browser back, vs.).
Webhook gelmezse case sonsuza kadar PREAUTH_REQUESTED'da kalır → kullanıcı
ne retry edebilir ne iptal edebilir. Bu cron o "hayalet preauth"ları temizler.

V1: timeout-based marker. Pending idempotency kayıtları FAILED'e çekilir,
state PREAUTH_FAILED'e taşınır. Kullanıcı vakaya döndüğünde
PaymentInitiateScreen otomatik "Kart reddedildi" UI gösterir ve retry_N
anahtarıyla yeni initiate tetikleyebilir.

V1.1 enhancement: psp.get_payment_detail (Iyzico CheckoutForm.retrieve)
ile aktif durum sorgusu → success/fail/pending dispatcha
case_billing.process_3ds_callback reuse. provider_token idempotency
response_payload'da saklı.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, select

from app.db.session import get_db
from app.models.case import ServiceCase
from app.services.case_billing import mark_preauth_timeout
from app.services.case_billing_state import BillingState

logger = logging.getLogger(__name__)


# Webhook normalde 30s-2dk arası gelir. 2 saat üstü pending → kesin kayıp,
# state'i FAILED'e çek ki kullanıcı retry edebilsin.
PREAUTH_TIMEOUT_THRESHOLD = timedelta(hours=2)


async def billing_reconcile(ctx: dict[str, object]) -> None:
    """Stale PREAUTH_REQUESTED vakalarını FAILED'e çek.

    Iyzico webhook'unun gelmediği veya iletim sırasında kaybolduğu durumlar
    için defansif. Idempotent — aynı tur tekrar çalıştırılırsa bir şey değişmez
    (state PREAUTH_FAILED'a geçtiyse mark_preauth_timeout no-op döner).
    """
    now = datetime.now(UTC)
    timeout_cutoff = now - PREAUTH_TIMEOUT_THRESHOLD

    async for session in get_db():
        stmt = select(ServiceCase).where(
            and_(
                ServiceCase.billing_state
                == BillingState.PREAUTH_REQUESTED.value,
                ServiceCase.updated_at < timeout_cutoff,
                ServiceCase.deleted_at.is_(None),
            )
        )
        cases = list((await session.execute(stmt)).scalars().all())
        if not cases:
            await session.commit()
            break

        marked_count = 0
        for case in cases:
            stale_minutes = int(
                (now - case.updated_at).total_seconds() / 60
            )
            try:
                changed = await mark_preauth_timeout(
                    session,
                    case=case,
                    stale_minutes=stale_minutes,
                )
                if changed:
                    marked_count += 1
            except Exception:
                logger.exception(
                    "billing_reconcile failed for case_id=%s", case.id
                )
                # Diğer case'leri etkilememek için yutuyoruz; bir sonraki tur
                # tekrar denenecek.
                continue
        await session.commit()
        logger.info(
            "billing_reconcile swept %d candidates, marked %d as PREAUTH_FAILED",
            len(cases),
            marked_count,
        )
        break
