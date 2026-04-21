from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole, UserStatus


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_phone(self, phone: str) -> User | None:
        result = await self._db.execute(select(User).where(User.phone == phone))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        role: UserRole,
        phone: str | None = None,
        email: str | None = None,
    ) -> User:
        # Customer otomatik aktif; technician pending (KYC/onay sonrası active olur).
        status = UserStatus.ACTIVE if role == UserRole.CUSTOMER else UserStatus.PENDING
        user = User(role=role, status=status, phone=phone, email=email)
        self._db.add(user)
        await self._db.flush()
        await self._db.refresh(user)
        return user
