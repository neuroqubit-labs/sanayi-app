from fastapi import APIRouter

from app.api.v1.routes import (
    admin,
    appointments,
    auth,
    cases,
    health,
    insurance_claims,
    media,
    offers,
    pool,
    reviews,
    taxonomy,
    technicians,
    technicians_public,
    tow,
    tow_ws,
    vehicles,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(media.router)
api_router.include_router(cases.router)
api_router.include_router(offers.router)
api_router.include_router(appointments.router)
api_router.include_router(technicians.router)
api_router.include_router(technicians_public.router)
api_router.include_router(taxonomy.router)
api_router.include_router(vehicles.router)
api_router.include_router(insurance_claims.customer_router)
api_router.include_router(insurance_claims.admin_router)
api_router.include_router(pool.router)
api_router.include_router(reviews.router)
api_router.include_router(admin.router)
api_router.include_router(webhooks.router)
api_router.include_router(tow.router)
api_router.include_router(tow_ws.router)
