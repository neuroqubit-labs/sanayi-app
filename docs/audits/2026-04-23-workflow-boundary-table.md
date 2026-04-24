# 2026-04-23 Workflow Boundary Table

Bu tablo, shared shell workflow ile subtype lifecycle arasındaki sınırı bugünkü
repo gerçeğine göre netleştirir.

## Genel Kural

- Shared shell status'ları kullanıcı görünürlüğü, teklif/randevu/billing ve
  case kapanışını taşır.
- Subtype lifecycle alanları operasyonel detayları taşır.
- Aynı bilgi hem shell status hem subtype stage olarak iki yerde tutulmamalı;
  biri coarse, diğeri detailed olmalıdır.

## Mevcut Durum ve Audit Kararı

| Case kind | Current create path | Current workflow anchor | Current gap | Audit kararı |
| --- | --- | --- | --- | --- |
| `towing` | `/tow/cases` | `service_cases.status` + `tow_stage` | Tow ayrı lifecycle taşıyor ama ayrı subtype tablo yok. `workflow_blueprint` olarak `towing_immediate` / `towing_scheduled` yazılıyor; shared enum bunu tanımıyor. | Tow lifecycle subtype-specific kalmalı. Shell yalnızca görünürlük / billing / ownership durumlarını taşımalı. |
| `accident` | `/cases` | `workflow_blueprint = damage_insured/uninsured` | Accident subtype tablosu yok; hasar ve insurance intent JSON/request içinde. | `accident_case` üstünde subtype detay + subtype workflow family olmalı; shell coarse kalmalı. |
| `breakdown` | `/cases` | `workflow_blueprint = maintenance_standard` fallback | Breakdown kendi workflow'una sahip değil; generic fallback yanlış semantik üretiyor. | `breakdown_case` için ayrı workflow family gerekli. |
| `maintenance` | `/cases` | `workflow_blueprint = maintenance_standard/major` | Workflow niyeti var ama subtype detail request-only. `seed_blueprint()` çağrısı görünmüyor. | `maintenance_case` detay ve workflow birlikte canonical hale gelmeli. |

## Kanıt Notları

- `case_create.resolve_blueprint()` `breakdown + towing` için
  `maintenance_standard` fallback döndürüyor:
  `naro-backend/app/services/case_create.py:151-172`
- Workflow seed şablonları yalnızca dört blueprint tanıyor:
  `naro-backend/app/services/workflow_seed.py:62-150`
- `seed_blueprint()` tanımlı ama `create_case()` içinde çağrı görünmüyor:
  `naro-backend/app/services/workflow_seed.py:158-210`,
  `naro-backend/app/services/case_create.py:247-299`
- Tow route shell'e shared enum dışında blueprint string yazıyor:
  `naro-backend/app/api/v1/routes/tow.py:166-169`
- Shared frontend domain yalnızca dört blueprint enum'unu kabul ediyor:
  `packages/domain/src/service-case.ts:388-396`

## Target Boundary

| Concern | Shared shell mi? | Subtype lifecycle mı? | Not |
| --- | --- | --- | --- |
| Teklif bekleniyor / teklif hazır | Evet | Hayır | Ticari shell durumu. |
| Randevu bekleniyor / planlandı | Evet | Hayır | Ortak görünürlük ve customer action yüzeyi. |
| Onay / fatura / completion bekliyor | Evet | Hayır | Approval/billing orchestration. |
| Tow `searching -> accepted -> arrived -> delivered` | Hayır | Evet (`tow_stage`) | Operasyonel tow truth. |
| Accident `intake -> insurance -> repair -> delivery` | Kısmen | Evet | Shell sadece coarse status taşır. |
| Breakdown `intake -> diagnosis -> decision -> service -> delivery` | Kısmen | Evet | Bugün eksik olan subtype workflow. |
| Maintenance `scope -> service -> quality -> delivery` | Kısmen | Evet | Blueprint niyeti subtype detail ile birleşmeli. |
| Cancel / complete / archive | Evet | Evet, gerekiyorsa terminal subtype sync | Shell terminal durum authoritative kalabilir. |

## Sonuç

Bugünkü sistemde workflow mantığı üç parçaya bölünmüş durumda:

- shared `status`
- `workflow_blueprint`
- tow için özel `tow_stage`

Audit kararı, bu üç parçayı şu role oturtmaktır:

- `status`: shell görünürlüğü
- `workflow_blueprint`: subtype workflow family seçimi
- subtype stage enum'ları: operasyonel detay

Tow bu modele en yakın örnek, fakat bugünkü implementasyon hâlâ shared shell ile
subtype workflow arasında tutarsız.
