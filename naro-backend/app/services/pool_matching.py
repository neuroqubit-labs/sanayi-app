"""Pool matching — hangi provider_type hangi case kind'lerini görür?

Bu map Faz 4 case havuzunun birincil filtresidir. Teknisyen bir provider_type'a
sahipse (primary + secondary) karşılık gelen case kind'lerini havuz feed'inde
görür.
"""

from __future__ import annotations

from app.models.case import ServiceRequestKind
from app.models.technician import ProviderType

K = ServiceRequestKind
P = ProviderType

KIND_PROVIDER_MAP: dict[ServiceRequestKind, set[ProviderType]] = {
    K.ACCIDENT: {P.USTA, P.KAPORTA_BOYA, P.CEKICI},
    K.TOWING: {P.CEKICI, P.USTA},
    K.BREAKDOWN: {P.USTA, P.OTO_ELEKTRIK, P.LASTIK, P.CEKICI},
    K.MAINTENANCE: {P.USTA, P.LASTIK, P.OTO_ELEKTRIK, P.OTO_AKSESUAR},
}


def kinds_for_provider(provider_type: ProviderType) -> set[ServiceRequestKind]:
    """Bir provider_type'ın gördüğü case kind'leri."""
    return {
        kind
        for kind, providers in KIND_PROVIDER_MAP.items()
        if provider_type in providers
    }
