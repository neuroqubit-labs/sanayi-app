"""docs/api/README.md generator — OpenAPI JSON'dan human digest üretir.

Idempotent; her çalıştırmada aynı Markdown. Script openapi.json'u okur
(export_openapi.py önce çalıştırılır), tag bazında section'lara böler.

Kullanım:
    uv run python scripts/render_api_readme.py
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

_METHOD_ORDER = ("get", "post", "put", "patch", "delete")
_TAG_DESCRIPTIONS: dict[str, str] = {
    "admin": "Admin operasyon yüzeyi (teknisyen onay + cert review + case override + audit).",
    "appointments": "Randevu yaşam döngüsü (request/accept/counter/cancel).",
    "auth": "OTP + JWT authentication + session lifecycle.",
    "billing": "Ödeme akışı — 3DS checkout, capture, refund, kasko reimburse, payout. "
    "Customer/technician/admin endpoint'leri tek namespace.",
    "cases": "Müşteri vaka (ServiceCase) CRUD + cancel.",
    "health": "Sistem health check.",
    "insurance-claims": "Kaza kasko/trafik sigorta claim yaşam döngüsü. Customer "
    "submit/list/detail + admin accept/reject/mark-paid/list.",
    "media": "Medya upload intent + presigned URL + preview + retention.",
    "observability": "Prometheus metrics scrape endpoint.",
    "offers": "Teklif yaşam döngüsü (technician submit/withdraw, customer accept/reject).",
    "pool": "Teknisyen havuz feed — kendine uygun case'leri listeler (admission gate).",
    "reviews": "Vaka bitişi sonrası puanlama (customer → technician V1).",
    "taxonomy": "Service domain + procedure + brand + city/district + drivetrain master data.",
    "technicians-me": "Teknisyen kendi profil + cert + capability + availability yönetimi.",
    "technicians-public": "Public keşif yüzeyi — PII masked (Çarşı ekranı).",
    "tow": "Çekici auto-dispatch + stage + OTP + evidence + fare.",
    "tow-ws": "Çekici real-time WebSocket kanalı (live location broadcast).",
    "vehicles": "Müşteri araç kaydı + owner link + history consent (audit P1-1).",
    "webhooks": "PSP webhook callback'leri (Iyzico 3DS + chargeback V2).",
}


def _role_for_path(path: str, method: str) -> str:
    """Path heuristics → role hint (OpenAPI security'den türetilmez; kod bilgisi)."""
    _ = method
    if path.startswith("/api/v1/admin/"):
        return "admin"
    if path.startswith("/api/v1/technicians/me"):
        return "technician"
    if "/me" in path:
        return "customer/technician"
    if path.startswith("/api/v1/technicians/public"):
        return "any auth"
    if path.startswith("/api/v1/webhooks"):
        return "PSP (HMAC)"
    if "/ws/" in path:
        return "any auth (WebSocket)"
    if path in ("/api/v1/health", "/metrics"):
        return "public"
    return "role-dependent (see route)"


def _ref_name(ref: str) -> str:
    return ref.rsplit("/", 1)[-1]


def _schema_hint(payload: dict[str, Any] | None) -> str | None:
    if not payload:
        return None
    content = payload.get("content", {})
    app_json = content.get("application/json", {})
    schema = app_json.get("schema", {})
    if "$ref" in schema:
        return _ref_name(schema["$ref"])
    if schema.get("type") == "array":
        items = schema.get("items", {})
        if "$ref" in items:
            return f"list[{_ref_name(items['$ref'])}]"
        return f"list[{items.get('type', 'any')}]"
    return schema.get("type") or "object"


def _response_hints(responses: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for code in sorted(responses.keys()):
        resp = responses[code]
        hint = _schema_hint(resp)
        desc = resp.get("description") or ""
        suffix = f" — {hint}" if hint else ""
        lines.append(f"  - `{code}`{suffix} {desc}".rstrip())
    return lines


def _render_endpoint(path: str, method: str, op: dict[str, Any]) -> list[str]:
    method_upper = method.upper()
    role = _role_for_path(path, method)
    summary = op.get("summary") or op.get("description") or ""
    lines: list[str] = [
        f"### {method_upper} {path}",
        "",
        f"- **Auth:** {role}",
    ]
    if summary:
        lines.append(f"- **Özet:** {summary}")

    req_body = op.get("requestBody")
    if req_body:
        req_hint = _schema_hint(req_body)
        if req_hint:
            lines.append(f"- **Request:** `{req_hint}`")

    parameters = op.get("parameters") or []
    query_params = [p for p in parameters if p.get("in") == "query"]
    if query_params:
        qp_names = ", ".join(
            f"`{p['name']}`" for p in query_params if "name" in p
        )
        lines.append(f"- **Query:** {qp_names}")

    responses = op.get("responses", {})
    if responses:
        lines.append("- **Responses:**")
        lines.extend(_response_hints(responses))

    lines.append("")
    return lines


def _group_by_tag(spec: dict[str, Any]) -> dict[str, list[tuple[str, str, dict[str, Any]]]]:
    grouped: dict[str, list[tuple[str, str, dict[str, Any]]]] = defaultdict(
        list
    )
    for path, methods in spec.get("paths", {}).items():
        for method, op in methods.items():
            if method not in _METHOD_ORDER:
                continue
            tags = op.get("tags") or ["_untagged_"]
            for tag in tags:
                grouped[tag].append((path, method, op))
    # Sort: path ascending, then method order
    for tag in grouped:
        grouped[tag].sort(
            key=lambda row: (row[0], _METHOD_ORDER.index(row[1]))
        )
    return grouped


def render(spec: dict[str, Any]) -> str:
    info = spec.get("info", {})
    title = info.get("title", "Naro Backend API")
    version = info.get("version", "v1")

    total = sum(
        1
        for methods in spec.get("paths", {}).values()
        for m in methods
        if m in _METHOD_ORDER
    )
    path_count = len(spec.get("paths", {}))

    grouped = _group_by_tag(spec)
    tags_sorted = sorted(grouped.keys())

    out: list[str] = [
        f"# {title} — Canonical",
        "",
        f"**Version:** {version}",
        "**Base URL:** `/api/v1` (production), `http://localhost:8000/api/v1` (dev)",
        "**Auth:** Bearer JWT (Authorization header), OTP login üzerinden",
        "**Content-Type:** `application/json`",
        "",
        f"**Kapsam:** {total} endpoint, {path_count} unique path, {len(tags_sorted)} tag.",
        "",
        "> Bu dokümana `scripts/export_openapi.py` + `scripts/render_api_readme.py`",
        "> ile `docs/api/openapi.json`'dan üretilir — manuel düzenleme YAPMA;",
        "> kod değişince script'leri yeniden çalıştır.",
        "",
        "## İçindekiler",
        "",
    ]
    for tag in tags_sorted:
        anchor = tag.lower().replace("-", "-").replace(" ", "-")
        count = len(grouped[tag])
        out.append(f"- [{tag}](#{anchor}) ({count} endpoint)")
    out.append("")
    out.append("---")
    out.append("")

    for tag in tags_sorted:
        out.append(f"## {tag}")
        out.append("")
        desc = _TAG_DESCRIPTIONS.get(tag)
        if desc:
            out.append(desc)
            out.append("")
        for path, method, op in grouped[tag]:
            out.extend(_render_endpoint(path, method, op))
        out.append("---")
        out.append("")

    # Schema index
    components = spec.get("components", {}).get("schemas", {})
    if components:
        out.append("## Şema referansı")
        out.append("")
        out.append("OpenAPI JSON içindeki tüm response/request şemaları. Her")
        out.append("şemanın alan listesi için `docs/api/openapi.json` içindeki")
        out.append("`components.schemas.<SchemaName>` path'ine bak.")
        out.append("")
        for name in sorted(components.keys()):
            out.append(f"- `{name}`")
        out.append("")

    return "\n".join(out) + "\n"


def main(out_path: Path) -> None:
    openapi_path = out_path.parent / "openapi.json"
    if not openapi_path.exists():
        raise SystemExit(
            f"{openapi_path} yok — önce `uv run python scripts/export_openapi.py`"
        )
    spec = json.loads(openapi_path.read_text(encoding="utf-8"))
    body = render(spec)
    out_path.write_text(body, encoding="utf-8")
    print(f"rendered: {out_path} — {len(body.splitlines())} lines", flush=True)


if __name__ == "__main__":
    default_path = (
        Path(__file__).resolve().parent.parent.parent
        / "docs"
        / "api"
        / "README.md"
    )
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else default_path)
