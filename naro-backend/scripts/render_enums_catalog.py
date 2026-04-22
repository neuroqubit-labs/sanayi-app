"""docs/api/enums.md generator — StrEnum katalog.

app/models/*.py içindeki tüm StrEnum subclass'larını introspect eder,
kategori (dosya adına göre) başlıklar altında enum değerlerini (tanım
sırası) + ilgili schema referanslarını üretir.

Idempotent. Enum sırası önemli (FE dropdown order).

Kullanım:
    uv run python scripts/render_enums_catalog.py
"""

from __future__ import annotations

import importlib
import inspect
import pkgutil
import sys
from enum import StrEnum
from pathlib import Path

_CATEGORY_ORDER: list[tuple[str, str]] = [
    ("user", "User + Auth"),
    ("auth", "User + Auth"),
    ("auth_event", "User + Auth"),
    ("auth_identity", "User + Auth"),
    ("vehicle", "Vehicle"),
    ("case", "Case — Request + Kind"),
    ("case_audit", "Case — Event + Audit"),
    ("case_process", "Case — Process (approval/task/milestone)"),
    ("case_artifact", "Case — Artifact"),
    ("case_communication", "Case — Communication"),
    ("technician", "Technician"),
    ("technician_signal", "Technician — Signal model"),
    ("tow", "Tow (çekici)"),
    ("billing", "Billing"),
    ("offer", "Offer"),
    ("appointment", "Appointment"),
    ("insurance_claim", "Insurance claim"),
    ("media", "Media"),
    ("taxonomy", "Taxonomy"),
    ("review", "Review"),
]


def _category_for_module(module_name: str) -> str:
    """module 'app.models.xyz' → kategori başlığı."""
    short = module_name.rsplit(".", 1)[-1]
    for key, title in _CATEGORY_ORDER:
        if short == key:
            return title
    return "Diğer"


def _iter_model_modules() -> list[object]:
    from app import models as models_pkg

    modules: list[object] = []
    for mod_info in pkgutil.iter_modules(models_pkg.__path__):
        full = f"app.models.{mod_info.name}"
        try:
            mod = importlib.import_module(full)
        except Exception as exc:
            print(
                f"skip import error: {full} — {exc}", file=sys.stderr
            )
            continue
        modules.append(mod)
    return modules


def _collect_enums() -> dict[str, list[tuple[str, type[StrEnum], str]]]:
    """category → [(enum_name, enum_class, module_short_name), ...]"""
    by_category: dict[str, list[tuple[str, type[StrEnum], str]]] = {}
    for mod in _iter_model_modules():
        mod_name = getattr(mod, "__name__", "")
        short = mod_name.rsplit(".", 1)[-1]
        for name, obj in inspect.getmembers(mod):
            if (
                not inspect.isclass(obj)
                or not issubclass(obj, StrEnum)
                or obj is StrEnum
                or obj.__module__ != mod_name
            ):
                continue
            cat = _category_for_module(mod_name)
            by_category.setdefault(cat, []).append((name, obj, short))
    # Dedup + sort per category
    for cat, items in by_category.items():
        seen: set[str] = set()
        uniq: list[tuple[str, type[StrEnum], str]] = []
        for name, cls, mod in items:
            if name in seen:
                continue
            seen.add(name)
            uniq.append((name, cls, mod))
        uniq.sort(key=lambda t: t[0])
        by_category[cat] = uniq
    return by_category


def _render_enum_block(name: str, cls: type[StrEnum], module_short: str) -> list[str]:
    doc = inspect.getdoc(cls)
    lines: list[str] = [f"### {name}", ""]
    if doc:
        # İlk satır yeter
        first_line = doc.splitlines()[0].strip()
        if first_line:
            lines.append(first_line)
            lines.append("")
    lines.append("```")
    for member in cls:  # enum definition order
        lines.append(member.value)
    lines.append("```")
    lines.append("")
    lines.append(f"**Kaynak:** `app/models/{module_short}.py`")
    lines.append("")
    return lines


def render() -> str:
    by_category = _collect_enums()
    total_enums = sum(len(v) for v in by_category.values())

    out: list[str] = [
        "# Naro Backend — Enum Katalogu",
        "",
        "Her enum exact string değerler ve **tanım sırası**. FE select/",
        "dropdown bileşenleri bu sırayı kullanır — sıra değişmez (yeni değer",
        "sonuna eklenir, mevcut değerler yerinde kalır).",
        "",
        "> Bu dokümana `scripts/render_enums_catalog.py` ile `app/models/*.py`",
        "> içindeki `StrEnum` subclass'larından üretilir. Manuel düzenleme",
        "> YAPMA; model değişince script'i yeniden çalıştır.",
        "",
        f"**Toplam:** {total_enums} enum, {len(by_category)} kategori.",
        "",
        "## İçindekiler",
        "",
    ]

    ordered_cats: list[str] = []
    seen: set[str] = set()
    for _, title in _CATEGORY_ORDER:
        if title in by_category and title not in seen:
            ordered_cats.append(title)
            seen.add(title)
    for cat in sorted(by_category.keys()):
        if cat not in seen:
            ordered_cats.append(cat)
            seen.add(cat)

    for cat in ordered_cats:
        count = len(by_category[cat])
        anchor = cat.lower().replace(" ", "-").replace("—", "").replace(
            "(", ""
        ).replace(")", "").replace("/", "-")
        out.append(f"- [{cat}](#{anchor}) ({count})")
    out.append("")
    out.append("---")
    out.append("")

    for cat in ordered_cats:
        out.append(f"## {cat}")
        out.append("")
        for name, cls, mod_short in by_category[cat]:
            out.extend(_render_enum_block(name, cls, mod_short))
        out.append("---")
        out.append("")

    return "\n".join(out) + "\n"


def main(out_path: Path) -> None:
    body = render()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(body, encoding="utf-8")
    print(
        f"rendered: {out_path} — {len(body.splitlines())} lines",
        flush=True,
    )


if __name__ == "__main__":
    default_path = (
        Path(__file__).resolve().parent.parent.parent
        / "docs"
        / "api"
        / "enums.md"
    )
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else default_path)
