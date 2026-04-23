"""Case thread endpoint'leri (İş 3 — PO brief 2026-04-23).

3 route:
- POST /cases/{id}/thread/messages — yeni mesaj
- GET  /cases/{id}/thread/messages — listele (cursor)
- POST /cases/{id}/thread/seen      — markSeen (last_seen_by_* update)

Auth: case participant (customer veya assigned_technician).
Anti-disintermediation: content'te telefon/email → 422 reject.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.v1.deps import CurrentUserDep, DbDep
from app.models.case import ServiceCase
from app.repositories import case as case_repo
from app.schemas.case_thread import (
    ThreadMessageCreatePayload,
    ThreadMessageListResponse,
    ThreadMessageResponse,
)
from app.services import case_thread as thread_svc

router = APIRouter(prefix="/cases/{case_id}/thread", tags=["case-thread"])


@router.post(
    "/messages",
    response_model=ThreadMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thread'e yeni mesaj",
)
async def create_thread_message(
    case_id: UUID,
    payload: ThreadMessageCreatePayload,
    user: CurrentUserDep,
    db: DbDep,
) -> ThreadMessageResponse:
    case = await _ensure_participant(db, case_id, user.id)
    try:
        created = await thread_svc.create_message(
            db, case=case, user=user, content=payload.content
        )
    except thread_svc.DisintermediationRejectedError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=422,
            detail={
                "type": f"disintermediation_{exc.args[0]}",
                "message": "Mesajlarda telefon/email paylaşımı yasak",
            },
        ) from exc
    except thread_svc.ThreadClosedError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=403,
            detail={
                "type": "case_closed",
                "message": f"case status: {exc.args[0]}",
            },
        ) from exc
    await db.commit()
    return ThreadMessageResponse.model_validate(
        {
            "id": created.id,
            "sender_role": created.sender_role,
            "content": created.content,
            "created_at": created.created_at,
        }
    )


@router.get(
    "/messages",
    response_model=ThreadMessageListResponse,
    summary="Thread mesajlarını listele (cursor)",
)
async def list_thread_messages(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    cursor: str | None = Query(default=None),
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ThreadMessageListResponse:
    await _ensure_participant(db, case_id, user.id)
    try:
        page = await thread_svc.list_messages(
            db, case_id=case_id, limit=limit, cursor=cursor
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail={"type": "invalid_cursor"}
        ) from exc
    return ThreadMessageListResponse(
        items=[
            ThreadMessageResponse.model_validate(
                {
                    "id": m.id,
                    "sender_role": m.author_role,
                    "content": m.body,
                    "created_at": m.created_at,
                }
            )
            for m in page.items
        ],
        next_cursor=page.next_cursor,
    )


@router.post(
    "/seen",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Thread okundu işaretle",
)
async def mark_thread_seen(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> Response:
    case = await _ensure_participant(db, case_id, user.id)
    await thread_svc.mark_seen(db, case=case, user=user)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _ensure_participant(
    db: DbDep, case_id: UUID, user_id: UUID
) -> ServiceCase:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        )
    if user_id not in {case.customer_user_id, case.assigned_technician_id}:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_participant"}
        )
    return case
