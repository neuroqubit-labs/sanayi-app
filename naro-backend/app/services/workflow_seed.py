"""Workflow blueprint seed — case create'de milestone+task setini otomatik doldur.

4 blueprint constant'ı ([case_process.CaseWorkflowBlueprint]):
- damage_insured: intake → insurance → approval → repair → delivery
- damage_uninsured: intake → diagnosis → approval → repair → delivery
- maintenance_standard: intake → scope → service → quality → delivery
- maintenance_major: intake → scope → service → quality → delivery

Mobil [packages/mobile-core/src/tracking/engine.ts::buildMilestones] ile
birebir template mirror'ı. Task listesi başlangıçta sadece intake
milestone'una ait "beklemeye al" görevleri açılır; status transition'lar
ilerledikçe yeni task'lar mobilden veya backend service'lerden açılır.

Seed çağrısı: `create_case()` sonrası `await seed_blueprint(session, case.id, blueprint)`.
"""

from __future__ import annotations

from typing import TypedDict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_process import (
    CaseActor,
    CaseMilestone,
    CaseMilestoneStatus,
    CaseTask,
    CaseTaskKind,
    CaseTaskStatus,
    CaseTaskUrgency,
    CaseWorkflowBlueprint,
)


class _MilestoneDef(TypedDict):
    key: str
    title: str
    description: str
    actor: CaseActor


class _TaskDef(TypedDict, total=False):
    # Yalnızca intake anında oluşturulacak başlangıç görevleri.
    # İleri aşama task'ları (parts_approval, invoice_shared, vb.) event-driven.
    milestone_key: str
    kind: CaseTaskKind
    title: str
    description: str
    actor: CaseActor
    status: CaseTaskStatus
    urgency: CaseTaskUrgency
    cta_label: str
    helper_label: str


class _BlueprintDef(TypedDict):
    milestones: list[_MilestoneDef]
    initial_tasks: list[_TaskDef]


BLUEPRINT_TEMPLATES: dict[CaseWorkflowBlueprint, _BlueprintDef] = {
    CaseWorkflowBlueprint.DAMAGE_INSURED: {
        "milestones": [
            {"key": "intake", "title": "Giriş ve güvenlik", "description": "Kabul ve ilk inceleme.", "actor": CaseActor.SYSTEM},
            {"key": "insurance", "title": "Sigorta ve ekspertiz", "description": "Sigorta dosyası ve ekspertiz raporu.", "actor": CaseActor.TECHNICIAN},
            {"key": "approval", "title": "Karar ve onay", "description": "Onarım kapsamı ve tutar onayı.", "actor": CaseActor.CUSTOMER},
            {"key": "repair", "title": "Onarım", "description": "Hasarın giderilmesi.", "actor": CaseActor.TECHNICIAN},
            {"key": "delivery", "title": "Teslim", "description": "Teslim ve kapanış.", "actor": CaseActor.TECHNICIAN},
        ],
        "initial_tasks": [
            {
                "milestone_key": "intake",
                "kind": CaseTaskKind.REVIEW_OFFERS,
                "title": "Teklifleri incele",
                "description": "Gelen teklifleri karşılaştırıp uygun ustayı seç.",
                "actor": CaseActor.CUSTOMER,
                "status": CaseTaskStatus.ACTIVE,
                "urgency": CaseTaskUrgency.SOON,
                "cta_label": "Teklifleri aç",
                "helper_label": "Teklif bekliyorsan havuzdan gelenleri takip et.",
            },
        ],
    },
    CaseWorkflowBlueprint.DAMAGE_UNINSURED: {
        "milestones": [
            {"key": "intake", "title": "Giriş ve teşhis", "description": "Kabul ve ön inceleme.", "actor": CaseActor.SYSTEM},
            {"key": "diagnosis", "title": "Teşhis", "description": "Hasarın detaylı teşhisi.", "actor": CaseActor.TECHNICIAN},
            {"key": "approval", "title": "Karar ve onay", "description": "Onarım kapsamı ve tutar onayı.", "actor": CaseActor.CUSTOMER},
            {"key": "repair", "title": "Onarım", "description": "Hasarın giderilmesi.", "actor": CaseActor.TECHNICIAN},
            {"key": "delivery", "title": "Teslim", "description": "Teslim ve kapanış.", "actor": CaseActor.TECHNICIAN},
        ],
        "initial_tasks": [
            {
                "milestone_key": "intake",
                "kind": CaseTaskKind.REVIEW_OFFERS,
                "title": "Teklifleri incele",
                "description": "Gelen teklifleri karşılaştırıp uygun ustayı seç.",
                "actor": CaseActor.CUSTOMER,
                "status": CaseTaskStatus.ACTIVE,
                "urgency": CaseTaskUrgency.SOON,
                "cta_label": "Teklifleri aç",
                "helper_label": "Teklif bekliyorsan havuzdan gelenleri takip et.",
            },
        ],
    },
    CaseWorkflowBlueprint.MAINTENANCE_STANDARD: {
        "milestones": [
            {"key": "intake", "title": "Kabul", "description": "Araç kabulü ve ön kontrol.", "actor": CaseActor.SYSTEM},
            {"key": "scope", "title": "Bakım kapsamı", "description": "Bakım listesi ve parça hazırlığı.", "actor": CaseActor.TECHNICIAN},
            {"key": "service", "title": "Bakım işlemi", "description": "Planlı bakımın uygulanması.", "actor": CaseActor.TECHNICIAN},
            {"key": "quality", "title": "Son kontrol", "description": "Kalite kontrol ve fatura.", "actor": CaseActor.TECHNICIAN},
            {"key": "delivery", "title": "Teslim", "description": "Teslim ve kapanış.", "actor": CaseActor.TECHNICIAN},
        ],
        "initial_tasks": [
            {
                "milestone_key": "intake",
                "kind": CaseTaskKind.REVIEW_OFFERS,
                "title": "Teklifleri incele",
                "description": "Bakım için gelen teklifleri karşılaştır.",
                "actor": CaseActor.CUSTOMER,
                "status": CaseTaskStatus.ACTIVE,
                "urgency": CaseTaskUrgency.SOON,
                "cta_label": "Teklifleri aç",
                "helper_label": "Havuzdan gelen teklifleri takip et.",
            },
        ],
    },
    CaseWorkflowBlueprint.MAINTENANCE_MAJOR: {
        "milestones": [
            {"key": "intake", "title": "Kabul", "description": "Araç kabulü ve ön kontrol.", "actor": CaseActor.SYSTEM},
            {"key": "scope", "title": "Geniş bakım kapsamı", "description": "Kapsamlı bakım listesi ve parça hazırlığı.", "actor": CaseActor.TECHNICIAN},
            {"key": "service", "title": "Bakım işlemi", "description": "Geniş bakımın uygulanması.", "actor": CaseActor.TECHNICIAN},
            {"key": "quality", "title": "Kalite ve fatura", "description": "Kalite kontrol + fatura.", "actor": CaseActor.TECHNICIAN},
            {"key": "delivery", "title": "Teslim", "description": "Teslim ve kapanış.", "actor": CaseActor.TECHNICIAN},
        ],
        "initial_tasks": [
            {
                "milestone_key": "intake",
                "kind": CaseTaskKind.REVIEW_OFFERS,
                "title": "Teklifleri incele",
                "description": "Geniş bakım için gelen teklifleri incele.",
                "actor": CaseActor.CUSTOMER,
                "status": CaseTaskStatus.ACTIVE,
                "urgency": CaseTaskUrgency.SOON,
                "cta_label": "Teklifleri aç",
                "helper_label": "Havuzdan gelen teklifleri takip et.",
            },
        ],
    },
}


class UnknownBlueprintError(ValueError):
    pass


async def seed_blueprint(
    session: AsyncSession,
    case_id: UUID,
    blueprint: str,
) -> dict[str, UUID]:
    """Workflow blueprint'e göre milestone+task setini yarat.

    `service_cases.workflow_blueprint` string olarak tutulur (mobil enum mirror).
    Return: `{milestone_key: milestone_id}` mapping (task seed'de kullanılır).
    """
    try:
        bp = CaseWorkflowBlueprint(blueprint)
    except ValueError as exc:
        raise UnknownBlueprintError(f"unknown workflow_blueprint: {blueprint}") from exc

    tpl = BLUEPRINT_TEMPLATES[bp]
    milestone_ids: dict[str, UUID] = {}

    for idx, m in enumerate(tpl["milestones"]):
        # İlk milestone başlangıçta active; diğerleri upcoming
        status = (
            CaseMilestoneStatus.ACTIVE if idx == 0 else CaseMilestoneStatus.UPCOMING
        )
        milestone = CaseMilestone(
            case_id=case_id,
            key=m["key"],
            title=m["title"],
            description=m["description"],
            actor=m["actor"],
            sequence=idx,
            status=status,
        )
        session.add(milestone)
        await session.flush()
        milestone_ids[m["key"]] = milestone.id

    for t in tpl["initial_tasks"]:
        milestone_id = milestone_ids[t["milestone_key"]]
        task = CaseTask(
            case_id=case_id,
            milestone_id=milestone_id,
            kind=t["kind"],
            title=t["title"],
            description=t.get("description"),
            actor=t["actor"],
            status=t.get("status", CaseTaskStatus.PENDING),
            urgency=t.get("urgency", CaseTaskUrgency.BACKGROUND),
            cta_label=t["cta_label"],
            helper_label=t.get("helper_label"),
        )
        session.add(task)

    await session.flush()
    return milestone_ids
