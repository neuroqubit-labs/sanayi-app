"""Tow API router package.

Public paths stay under /tow; modules are split by behavior so each route file
stays small enough to audit.
"""

from fastapi import APIRouter

from . import availability, cases, dispatch, misc, otp_evidence, tracking

router = APIRouter(prefix="/tow", tags=["tow"])
router.include_router(availability.router)
router.include_router(cases.router)
router.include_router(tracking.router)
router.include_router(dispatch.router)
router.include_router(otp_evidence.router)
router.include_router(misc.router)
