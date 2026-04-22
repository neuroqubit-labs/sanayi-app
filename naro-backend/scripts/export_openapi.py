"""OpenAPI spec export — drift detection + FE parity audit için canonical.

Kullanım:
    cd naro-backend
    set -a && source .env.local && set +a
    uv run python scripts/export_openapi.py                     # default path
    uv run python scripts/export_openapi.py /tmp/custom.json    # override

İdempotent: sort_keys=True + indent=2, her run → identical output. CI'a
drift detection için (PR diff openapi.json'u değiştirdiğinde review flag).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.main import app


def export(out_path: Path) -> None:
    spec = app.openapi()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    body = (
        json.dumps(spec, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    )
    out_path.write_text(body, encoding="utf-8")
    print(
        f"exported: {out_path} — {len(spec.get('paths', {}))} paths",
        flush=True,
    )


if __name__ == "__main__":
    default_path = (
        Path(__file__).resolve().parent.parent.parent
        / "docs"
        / "api"
        / "openapi.json"
    )
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path
    export(out)
