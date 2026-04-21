"""Faz 10 exception → HTTP mapping.

Service layer `raise InvalidStageTransitionError(...)` → handler 409 döner.
Router'lar try/except yazmaz; FastAPI global exception_handlers map eder.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.services.tow_dispatch import (
    ConcurrentOfferError,
    NoCandidateFoundError,
)
from app.services.tow_evidence import (
    OtpExpiredError,
    OtpInvalidError,
    OtpMaxAttemptsError,
)
from app.services.tow_lifecycle import EvidenceGateUnmetError, InvalidStageTransitionError
from app.services.tow_payment import PaymentDeclinedError, PaymentPreAuthStaleError


def _error_body(code: str, message: str, **extra: object) -> dict[str, object]:
    body: dict[str, object] = {"error": {"code": code, "message": message}}
    if extra:
        body["error"]["context"] = extra  # type: ignore[index]
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(InvalidStageTransitionError)
    async def _invalid_stage(_req: Request, exc: InvalidStageTransitionError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_error_body("invalid_stage_transition", str(exc)),
        )

    @app.exception_handler(EvidenceGateUnmetError)
    async def _evidence_gate(_req: Request, exc: EvidenceGateUnmetError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_error_body(
                "evidence_gate_unmet",
                str(exc),
                missing=exc.missing,
            ),
        )

    @app.exception_handler(ConcurrentOfferError)
    async def _concurrent_offer(_req: Request, exc: ConcurrentOfferError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_error_body("concurrent_offer", str(exc)),
        )

    @app.exception_handler(NoCandidateFoundError)
    async def _no_candidate(_req: Request, exc: NoCandidateFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_410_GONE,
            content=_error_body("dispatch_no_candidate", str(exc)),
        )

    @app.exception_handler(OtpExpiredError)
    async def _otp_expired(_req: Request, exc: OtpExpiredError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_410_GONE,
            content=_error_body("otp_expired", str(exc)),
        )

    @app.exception_handler(OtpMaxAttemptsError)
    async def _otp_max(_req: Request, exc: OtpMaxAttemptsError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content=_error_body("otp_max_attempts", str(exc)),
        )

    @app.exception_handler(OtpInvalidError)
    async def _otp_invalid(_req: Request, exc: OtpInvalidError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_error_body("otp_invalid", str(exc)),
        )

    @app.exception_handler(PaymentDeclinedError)
    async def _payment_declined(
        _req: Request, exc: PaymentDeclinedError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content=_error_body(
                "payment_declined",
                str(exc),
                provider_code=exc.error_code,
            ),
        )

    @app.exception_handler(PaymentPreAuthStaleError)
    async def _preauth_stale(
        _req: Request, exc: PaymentPreAuthStaleError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content=_error_body("payment_preauth_stale", str(exc)),
        )

    @app.exception_handler(LookupError)
    async def _lookup(_req: Request, exc: LookupError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=_error_body("not_found", str(exc)),
        )


class FraudSuspectedError(HTTPException):
    def __init__(self, detail: str = "fraud suspected"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
