# 2026-04-23 Transition Matrix

Bu doküman, case type bazında bugünkü lifecycle davranışını ve hedef canonical
matrix'i tek tabloda toplar.

## Mevcut Gözlenen Matrix

| Case type | Entry state'ler | Allowed state'ler bugün | Terminal state'ler | Cancel path | Complete path | Review eligibility | Bugünkü temel drift |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `towing` | Shell: `matching` Stage: `searching` veya `scheduled_waiting` | Shell fiilen `matching`, `service_in_progress`, `completed`, `cancelled`, `archived`; stage tarafında `searching`, `accepted`, `en_route`, `nearby`, `arrived`, `loading`, `in_transit`, `delivered`, `cancelled`, `timeout_converted_to_pool`, `scheduled_waiting`, `bidding_open`, `offer_accepted`, `preauth_failed`, `preauth_stale` | Stage: `delivered`, `cancelled`; shell: `completed`, `cancelled`, `archived` | `/tow/cases/{id}/cancel` -> tow cancel servisi + fee/refund | `delivered` stage'i shell'i `completed` yapıyor | `case.status == completed` olduğunda açılıyor | Shell status tow operasyonunu aşırı sıkıştırıyor; payment closure ile terminal anlam aynı değil |
| `accident` | Shell: `matching`; insurance yoksa claim branch kapalı | Generic shell graph'ın tamamı pratikte erişilebilir: `matching`, `offers_ready`, `appointment_pending`, `scheduled`, `service_in_progress`, `parts_approval`, `invoice_approval`, `completed`, `cancelled`, `archived`; yan branch: `insurance_claim submitted/accepted/rejected/paid`; yan branch: appointment status'leri | Shell: `completed`, `cancelled`, `archived`; claim: `paid`, `rejected` | Generic `/cases/{id}/cancel` veya billing cancel | Bugün `invoice approve` veya `completion approve` veya billing capture ile kapanabiliyor | `completed` olduğunda açılıyor | Insurance branch doğru ama shell completion anlamı tutarsız |
| `breakdown` | Shell: `matching` | Generic shell graph'ın tamamı fiilen kullanılıyor; ayrı subtype stage yok; appointment/billing branch'leri generic akıyor | Shell: `completed`, `cancelled`, `archived` | Generic `/cases/{id}/cancel` veya billing cancel | Generic approval/billing kapanışı | `completed` olduğunda açılıyor | Tow ihtiyacı linked case değil; subtype truth generic maintenance akışına sıkışıyor |
| `maintenance` | Shell: `matching` | Generic shell graph'ın tamamı fiilen kullanılıyor; appointment/billing branch'leri generic akıyor | Shell: `completed`, `cancelled`, `archived` | Generic `/cases/{id}/cancel` veya billing cancel | Generic approval/billing kapanışı | `completed` olduğunda açılıyor | Shared shell bu tipe daha yakın ama `completed/cancelled` semantiği yine parçalı |

## Hedef Canonical Matrix

| Case type | Entry state'ler | Allowed shell state'ler | Allowed subtype / branch state'ler | Forbidden / authoritative olmayan state'ler | Terminal state'ler | Cancel path | Complete path | Review eligibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `towing` | Shell: `matching`; stage: `searching` veya `scheduled_waiting` | `matching`, `service_in_progress`, `completed`, `cancelled`, `archived` | `TowDispatchStage` bütün operasyonel truth'ü taşır; settlement ayrı branch olarak izlenir | `offers_ready`, `appointment_pending`, `scheduled`, `parts_approval`, `invoice_approval` tow için authoritative state olmamalı | Shell: `completed/cancelled`; stage: `delivered/cancelled` | Yalnızca tow cancel orchestrator | `tow_stage=delivered` + teslim onayı + settlement closure sonrası shell `completed` | Shell gerçekten `completed` olduktan sonra |
| `accident` | Shell: `matching` | `matching`, `offers_ready`, `appointment_pending`, `scheduled`, `service_in_progress`, `parts_approval`, `invoice_approval`, `completed`, `cancelled`, `archived` | Insurance ayrı optional branch; ileride subtype stage family: `intake`, `insurance_optional`, `repair`, `delivery_ready` | Insurance state'leri shell'in yerine geçmemeli; tow ihtiyacı main case içine gömülmemeli | Shell: `completed/cancelled`; insurance: `paid/rejected` | Generic cancel orchestrator; linked tow varsa ayrı child cancel yolu | Operasyon bitti + müşteri teslim onayı + payment closure | Yalnızca shell `completed` sonrası |
| `breakdown` | Shell: `matching` | `matching`, `offers_ready`, `appointment_pending`, `scheduled`, `service_in_progress`, `parts_approval`, `invoice_approval`, `completed`, `cancelled`, `archived` | İleride subtype stage family: `intake`, `diagnosis`, `repair_decision`, `repair`; linked tow child case ayrı branch olur | Tow child'ın stage'i parent breakdown shell'i olmamalı | Shell: `completed/cancelled` | Generic cancel orchestrator; linked tow child ayrı iptal edilir | Diagnosis/repair biter + müşteri onayı + payment closure | Yalnızca shell `completed` sonrası |
| `maintenance` | Shell: `matching` | `matching`, `offers_ready`, `appointment_pending`, `scheduled`, `service_in_progress`, `parts_approval`, `invoice_approval`, `completed`, `cancelled`, `archived` | İleride subtype stage family: `scope`, `service`, `quality`, `delivery_ready`; appointment ve billing yan branch olarak kalır | Tow stage ve insurance branch maintenance shell'inin parçası olmamalı | Shell: `completed/cancelled` | Generic cancel orchestrator | İş tamam + müşteri onayı + payment closure | Yalnızca shell `completed` sonrası |

## Ortak Kurallar

- `completed` ve `cancelled`, admin override hariç sink state kabul edilir.
- Review açma kuralı bütün case type'larda aynı business meaning'i taşımalıdır:
  gerçek terminal `completed`.
- `AppointmentStatus`, `BillingState` ve `InsuranceClaimStatus`, shell'in yerine
  geçmez; shell'i etkileyen yan branch graph'larıdır.
- `tow` için subtype stage authoritative kabul edilir.
- `breakdown` içindeki tow ihtiyacı parent case state'i değil, linked child tow
  case relation'ı üretmelidir.
