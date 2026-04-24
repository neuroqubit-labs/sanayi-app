"""/users/me router — authenticated user's own profile (read + update).

- GET   /users/me  → UserResponse (id, phone, email, full_name, role, status, locale, ...)
- PATCH /users/me  → UserResponse (partial update: full_name, email, locale)

Phone değişikliği OTP-reverify akışında (ayrı endpoint olacak) yapılır —
burada reddedilir. Role + status backend yönetir, caller değiştiremez.

Register akışı için hazırlık (docs/audits/2026-04-24-register-login-schema-alignment.md):
OTP verify sonrası client `PATCH /users/me { full_name, email? }` çağırır.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.v1.deps import CurrentUserDep, DbDep
from app.repositories.user import UserRepository
from app.schemas.user import UserResponse, UserUpdate

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
