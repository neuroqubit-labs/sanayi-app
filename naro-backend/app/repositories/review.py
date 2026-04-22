"""Review repository — create + list (cursor) + get.

UNIQUE (case_id, reviewer_user_id) DB constraint → IntegrityError fırlar;
router yakalar → 409.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.review import Review


async def get_review(
    session: AsyncSession, review_id: UUID
) -> Review | None:
    return await session.get(Review, review_id)


async def create_review(
    session: AsyncSession,
    *,
    case_id: UUID,
    reviewer_user_id: UUID,
    reviewee_user_id: UUID,
    rating: int,
    body: str | None = None,
) -> Review:
    review = Review(
        case_id=case_id,
        reviewer_user_id=reviewer_user_id,
        reviewee_user_id=reviewee_user_id,
        rating=rating,
        body=body,
    )
    session.add(review)
    await session.flush()
    return review


async def list_for_technician(
    session: AsyncSession,
    technician_id: UUID,
    *,
    limit: int,
    before_created_at: str | None = None,
    before_id: UUID | None = None,
) -> list[Review]:
    """Cursor-based list — (created_at DESC, id ASC) sort.

    before_*: cursor'dan çözülen tuple; pagination için.
    """
    conds = [Review.reviewee_user_id == technician_id]
    if before_created_at is not None and before_id is not None:
        from datetime import datetime

        dt = datetime.fromisoformat(before_created_at)
        conds.append(
            (Review.created_at < dt)
            | ((Review.created_at == dt) & (Review.id > before_id))
        )
    stmt = (
        select(Review)
        .where(and_(*conds))
        .order_by(Review.created_at.desc(), Review.id.asc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def list_reviews_by_reviewer(
    session: AsyncSession,
    reviewer_user_id: UUID,
    *,
    limit: int = 100,
) -> list[Review]:
    stmt = (
        select(Review)
        .where(Review.reviewer_user_id == reviewer_user_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def list_reviews_for_reviewee(
    session: AsyncSession,
    reviewee_user_id: UUID,
    *,
    limit: int = 100,
) -> list[Review]:
    stmt = (
        select(Review)
        .where(Review.reviewee_user_id == reviewee_user_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())
