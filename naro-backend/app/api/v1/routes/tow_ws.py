"""WebSocket /ws/tow/{case_id} — Redis Streams consumer.

Auth: JWT query param `token=<jwt>`. RequireCaseParticipant eşdeğeri.
Subscribe: `XREAD BLOCK` pattern with `resume_from` cursor support.
Events published by service layer (XADD): location_update, stage_changed,
match_found, otp_required, fare_finalized, cancelled, preauth_stale.

Client reconnect: `?resume_from=<last_stream_id>` → partial replay.
"""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.core.config import get_settings
from app.core.security import validate_access_token
from app.db.session import get_db
from app.models.case import ServiceCase, ServiceRequestKind

router = APIRouter()


async def _validate_ws_auth(token: str) -> UUID:
    payload = validate_access_token(token)
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise ValueError("invalid token subject")
    return UUID(subject)


@router.websocket("/ws/tow/{case_id}")
async def tow_websocket(
    websocket: WebSocket,
    case_id: UUID,
    token: str = Query(...),
    resume_from: str = Query(default="$"),  # "$" = only new messages
) -> None:
    """Subscribe to tow:stream:{case_id}. JWT auth via query param."""
    try:
        user_id = await _validate_ws_auth(token)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Verify case participation
    async for db in get_db():
        case = await db.get(ServiceCase, case_id)
        if case is None or case.kind != ServiceRequestKind.TOWING:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        if user_id not in {case.customer_user_id, case.assigned_technician_id}:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        break

    settings = get_settings()
    from redis.asyncio import Redis

    redis: Redis = Redis.from_url(settings.redis_url, decode_responses=True)
    stream_key = f"tow:stream:{case_id}"

    await websocket.accept()
    last_id = resume_from

    try:
        while True:
            try:
                messages = await redis.xread(
                    streams={stream_key: last_id},
                    block=15000,  # 15s block
                    count=50,
                )
            except Exception:
                await asyncio.sleep(1.0)
                continue

            if not messages:
                try:
                    await websocket.send_json({"type": "heartbeat"})
                except RuntimeError:
                    break
                continue

            for _stream_name, entries in messages:
                for message_id, payload in entries:
                    last_id = message_id
                    try:
                        await websocket.send_json(
                            {
                                "id": message_id,
                                "data": payload,
                            }
                        )
                    except RuntimeError:
                        return
    except WebSocketDisconnect:
        pass
    finally:
        await redis.aclose()
