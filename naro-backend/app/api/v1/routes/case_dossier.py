from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.v1.deps import CurrentUserDep, DbDep
from app.schemas.case_dossier import CaseDossierResponse
from app.services import case_dossier

router = APIRouter(prefix="/cases", tags=["case-dossier"])


@router.get(
    "/{case_id}/dossier",
    response_model=CaseDossierResponse,
    summary="Vaka dosyası — role-safe canonical contract",
)
async def get_case_dossier(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> CaseDossierResponse:
    try:
        return await case_dossier.assemble_dossier(
            db,
            case_id=case_id,
            viewer_user_id=user.id,
            viewer_role=user.role,
        )
    except (case_dossier.CaseNotFoundError, case_dossier.NotPermittedError) as exc:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        ) from exc
