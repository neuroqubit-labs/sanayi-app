"""/users/me router — authenticated user's own profile (read + update + delete).

- GET    /users/me  → UserResponse (id, phone, email, full_name, role, status, locale, ...)
- PATCH  /users/me  → UserResponse (partial update: full_name, email, locale)
- DELETE /users/me  → 204 No Content (soft delete; 30g grace sonrası hard-delete worker)

Phone değişikliği OTP-reverify akışında (ayrı endpoint olacak) yapılır —
burada reddedilir. Role + status backend yönetir, caller değiştiremez.

Register akışı için hazırlık (docs/audits/2026-04-24-register-login-schema-alignment.md):
OTP verify sonrası client `PATCH /users/me { full_name, email? }` çağırır.

Hesap silme (App Store + Play 2024+ policy zorunlu):
- DELETE /users/me → soft_delete_user(self) → 204
- Anonymize phone/email + revoke sessions + technician profile soft-delete
- 30g grace sonrası hard-delete worker (workers/account_deletion_purge.py)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from app.api.v1.deps import CurrentUserDep, DbDep
from app.repositories.user import UserRepository
from app.repositories.user_push_token import UserPushTokenRepository
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.user_push_token import (
    PushTokenRegisterPayload,
    PushTokenResponse,
)
from app.services.user_lifecycle import (
    UserAlreadyDeletedError,
    UserNotFoundError,
    soft_delete_user,
)

router = APIRouter(prefix="/users/me", tags=["users-me"])


@router.get("", response_model=UserResponse)
async def get_me(user: CurrentUserDep) -> UserResponse:
    return UserResponse.model_validate(user)


@router.patch("", response_model=UserResponse)
async def patch_me(
    payload: UserUpdate,
    user: CurrentUserDep,
    db: DbDep,
) -> UserResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return UserResponse.model_validate(user)

    # Email unique index check — başka user aynı emaili tutuyorsa 409.
    new_email = updates.get("email")
    if new_email is not None and new_email != user.email:
        existing = await UserRepository(db).get_by_email(new_email)
        if existing is not None and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email already in use",
            )

    for key, value in updates.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_me(user: CurrentUserDep, db: DbDep) -> Response:
    """Self-service hesap silme.

    Soft delete: users.deleted_at = NOW, phone/email anonymize, tüm aktif
    session'lar revoke. Technician ise technician_profile.deleted_at de set.
    30g grace sonrası hard-delete worker (account_deletion_purge) PII +
    cascade'i temizler.

    Idempotent: zaten silinmişse 410 Gone.
    """
    try:
        await soft_delete_user(
            db,
            user.id,
            reason="self_request",
            actor_user_id=user.id,
        )
    except UserAlreadyDeletedError as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="account already deleted",
        ) from exc
    except UserNotFoundError as exc:
        # CurrentUserDep zaten user'ı doğruladı; bu pratik olarak race ihtimali.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        ) from exc

    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/push-tokens",
    response_model=PushTokenResponse,
    status_code=status.HTTP_200_OK,
)
async def register_push_token(
    payload: PushTokenRegisterPayload,
    user: CurrentUserDep,
    db: DbDep,
) -> PushTokenResponse:
    """Device push token kaydı (idempotent).

    FE bootstrap'te (her launch'ta) bu endpoint çağrılır. (user_id, device_id)
    unique → aynı cihazdan tekrar gelirse UPDATE; yeni cihazsa INSERT.
    Push gönderme akışı (V1.1) bu tabloyu okur.
    """
    record = await UserPushTokenRepository(db).upsert(
        user_id=user.id,
        platform=payload.platform,
        token=payload.token,
        device_id=payload.device_id,
        app_version=payload.app_version,
    )
    await db.commit()
    return PushTokenResponse.model_validate(record)
