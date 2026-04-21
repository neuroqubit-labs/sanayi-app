"""PG enum helper — StrEnum .value (not .name) binding.

SQLAlchemy default SAEnum, Python `Enum.name` (UPPERCASE) gönderir; PostgreSQL
native enum ise `.value` (lowercase) bekler. Bu modül `values_callable`'ı
her zaman aktif eden bir wrapper sağlar. Tüm model dosyaları `pg_enum` kullanır.

Neden: StrEnum subclass'ında `str(MyEnum.FOO)` = 'foo' (value) ama
SQLAlchemy yine `.name` = 'FOO' bind eder. Fix global: tek merkezden.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, TypeVar

from sqlalchemy import Enum as SAEnum

E = TypeVar("E", bound=Enum)


def pg_enum(*args: Any, name: str, **kwargs: Any) -> SAEnum:
    """SAEnum wrapper — Enum class için `values_callable` her zaman aktif.

    İki kullanım şekli:
    - `pg_enum(MyStrEnum, name="my_enum")` → values_callable otomatik
    - `pg_enum("val1", "val2", name="my_enum")` → raw string values, callable kullanılmaz
    """
    if len(args) == 1 and isinstance(args[0], type) and issubclass(args[0], Enum):
        kwargs.setdefault("values_callable", lambda cls: [m.value for m in cls])
    return SAEnum(*args, name=name, **kwargs)
