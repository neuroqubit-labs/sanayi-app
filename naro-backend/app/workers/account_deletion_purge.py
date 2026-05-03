"""ARQ cron — soft-deleted user'ları 30g grace sonrası hard-delete.

Üretim akışı:
1. `DELETE /users/me` (routes/users.py) → `soft_delete_user`:
   - `users.deleted_at = NOW`
   - phone/email anonymize (`DELETED_<uid>_<...>` prefix, partial unique
     index `deleted_at IS NULL` koşuluyla yeni kayda yer açıyor)
   - tüm aktif `auth_sessions` revoke
   - technician ise `technician_profiles.deleted_at` set
2. Bu cron günlük 03:00 UTC çalışır → `deleted_at < now - 30 days`
   olan kullanıcıları hard-delete eder. PII tamamen silinir; FK'lı
   tablolar (cases, vehicles, technician_profiles, payments...)
   DB seviyesinde ON DELETE CASCADE / SET NULL politikalarına göre
   temizlenir.

App Store + Play 2024+ policy: kullanıcı tarafından silme talebi
30g içinde gerçek silmeye dönmeli. Bu cron policy'i karşılayan
mekanizmadır.

V1 SCOPE: yalnızca **iskelet** — purge candidate'larını seçer ve
loglar; **gerçek hard delete bir sonraki sprint'te eklenecek** çünkü:
  - User'a referans veren tabloların (cases, vehicles, technician_*,
    payments, media_assets owner) FK politikalarının audit'i gerek
  - Cascade rules production data kaybı riski içerir → ayrı integration
    test + dry-run review gerek
  - Soft delete'in PII anonymize aşaması zaten yapılmış (KVKK uyumu);
    asıl satır temizliği 30g grace içinde implement edilebilir

Backlog (sonraki sprint):
- FK cascade matrisi (her tablo için on_delete policy doğrula)
- Hard delete sequence (önce dependent rows, sonra users)
- Integration test: soft delete → 30g+1 → cron → hard delete; yeni
  kullanıcı aynı telefonla register olabiliyor mu doğrula
- Dry-run flag (env'le açılır, production'da log-only)
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)


# App Store + Play policy: 30g grace. Daha kısa = kullanıcıya geri yükleme
# fırsatı tanımıyoruz; daha uzun = KVKK "makul süre" yorumu zorlanır.
HARD_DELETE_GRACE = timedelta(days=30)


async def account_deletion_purge(ctx: dict[str, object]) -> None:
    """Soft-deleted user'ları 30g grace sonrası hard-delete et (V1: log-only).

    Idempotent — her tur aynı candidate listesini bulup işler. V1'de
    yalnızca log düşüyor; gerçek silme operasyonu sonraki sprint'te
    cascade audit + integration test sonrası eklenecek.
    """
    del ctx
    now = datetime.now(UTC)
    cutoff = now - HARD_DELETE_GRACE

    async for session in get_db():
        stmt = select(User).where(
            User.deleted_at.is_not(None),
            User.deleted_at < cutoff,
        )
        result = await session.execute(stmt)
        candidates = list(result.scalars().all())

        if not candidates:
            logger.info(
                "account_deletion_purge: no candidates",
                extra={"cutoff": cutoff.isoformat()},
            )
            return

        # V1: yalnızca log. V1.1'de aşağıdaki adımlar:
        #   1. dependent rows (cases, vehicles, technician_*, payments, media)
        #      delete/anonymize — FK on_delete politika audit sonrası
        #   2. users row DELETE
        #   3. session.commit() per user (per-user atomicity, batch hatası
        #      tek user'ı engellemesin)
        for user in candidates:
            logger.warning(
                "account_deletion_purge: candidate (V1 log-only)",
                extra={
                    "user_id": str(user.id),
                    "deleted_at": user.deleted_at.isoformat()
                    if user.deleted_at
                    else None,
                    "role": user.role.value,
                    "grace_elapsed_days": (now - user.deleted_at).days
                    if user.deleted_at
                    else None,
                },
            )
        return
