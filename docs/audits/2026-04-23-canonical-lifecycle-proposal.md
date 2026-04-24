# 2026-04-23 Canonical Lifecycle Proposal

Bu not, audit sonucu önerilen hedef lifecycle mimarisini sabitler.

## Tasarım İlkeleri

- `ServiceCaseStatus` yalnızca coarse shell görünürlüğü taşımalı.
- Subtype operasyonu subtype stage veya subtype workflow family üzerinde
  yaşamalı.
- `BillingState`, `InsuranceClaimStatus` ve `AppointmentStatus` case shell'i
  yerine geçmeyen yan branch graph'ları olmalı.
- `completed` ve `cancelled`, admin override hariç sink state olmalı.
- `completed` yalnızca iş + müşteri onayı + ödeme kapanışı gerçekleştiğinde
  yazılmalı.
- Tow, accident veya breakdown içinde flag olarak değil; first-class case/subflow
  olarak modellenmeli.

## Public Surface Kararları

| Surface | Canonical rol | Not |
| --- | --- | --- |
| `ServiceCaseStatus` | Shared shell visibility | Teklif/randevu/onay/kapanış yüzeyi |
| `TowDispatchStage` | Tow operasyonunun primary truth'ü | Immediate ve scheduled tow burada yaşar |
| `AppointmentStatus` | Scheduling branch | Shell'e etkisi explicit olmalı |
| `BillingState` | Finansal branch | Shell completion'ı tetikleyebilir ama shell'in yerine geçmez |
| `InsuranceClaimStatus` | Sadece accident bounded context branch'i | Shell'i tamamen bloklamaz |

## Shared Shell Önerisi

Bugünkü `ServiceCaseStatus` enum seti korunabilir; fakat anlamı daraltılmalıdır.

| Shell status | Canonical anlam | Kimler kullanır |
| --- | --- | --- |
| `matching` | Case açık; dispatch veya ticari seçim sürüyor | Tüm case type'lar |
| `offers_ready` | Müşteri değerlendirebileceği teklif setine sahip | Non-tow |
| `appointment_pending` | Slot üzerinde karar bekleniyor | Non-tow |
| `scheduled` | Planlı servis slot'u onaylandı | Non-tow |
| `service_in_progress` | Aktif operasyon başladı | Tow + non-tow |
| `parts_approval` | Müşteri parça kararında bekleniyor | Non-tow |
| `invoice_approval` | Müşteri finansal/teslim öncesi onay aşamasında | Non-tow |
| `completed` | Operasyon bitti, müşteri onayı geldi, ödeme kapandı | Tüm case type'lar |
| `cancelled` | Case authoritative cancel yolu ile kapandı | Tüm case type'lar |
| `archived` | Terminal case pasif görünümde | Tüm case type'lar |

## Case Type Bazlı Hedef

### `towing`

- Shell:
  Yalnızca `matching -> service_in_progress -> completed/cancelled -> archived`
  eksenini kullanmalı.
- Primary truth:
  `TowDispatchStage`
- Immediate tow entry:
  `searching`
- Scheduled tow entry:
  `scheduled_waiting`
- Complete kuralı:
  `tow_stage=delivered` operasyonel teslimi temsil eder; shell `completed`
  ancak teslim kanıtı ve settlement closure ile yazılmalıdır.
- Cancel kuralı:
  Yalnızca tow cancel orchestrator shell'i kapatabilir.

Hedef akış:

`create -> searching/scheduled_waiting -> accepted -> en_route -> arrived ->
loading -> in_transit -> delivered -> completed`

### `accident`

- Shell:
  `matching -> offers_ready -> appointment_pending -> scheduled ->
  service_in_progress -> parts_approval/invoice_approval -> completed`
- Optional branch:
  `InsuranceClaimStatus`
- Tow ihtiyacı:
  Ana case içine gömülmez; ayrı linked tow child case açılır.
- Complete kuralı:
  `invoice approve` tek başına completion değildir. Operasyon bittiğinde ve
  müşteri teslim/iş onayı verdiğinde, ödeme kapanışıyla birlikte shell
  `completed` olur.

Hedef lifecycle family:

`reported -> insurance_optional -> repair_coordination -> repair ->
delivery_confirmation -> completed`

### `breakdown`

- Shell:
  Accident ile aynı generic ticari ve operasyonel shell'i kullanabilir.
- Optional linked child:
  Tow gerekiyorsa ayrı tow child case açılır; ana breakdown case kapanmaz.
- Complete kuralı:
  Diagnosis ve repair tamamlanır, müşteri onayı gelir, ödeme kapanır.

Hedef lifecycle family:

`reported -> diagnosis -> tow_handoff_optional -> repair_decision -> repair ->
delivery_confirmation -> completed`

### `maintenance`

- Shell:
  Shared non-tow flow ile en uyumlu tip budur.
- Subtype family:
  Gerekirse `scope -> service -> quality -> delivery_confirmation`
  katmanı eklenebilir; ama shell ile birebir aynı olmak zorunda değildir.
- Complete kuralı:
  Shell `completed` yalnızca bakım gerçekten bittiğinde ve müşteri/ödeme
  kapanışı geldiğinde yazılır.

Hedef lifecycle family:

`scope -> appointment -> service -> quality -> delivery_confirmation ->
completed`

## Completion Kuralı

Bu audit'te seçilen default şu şekildedir:

1. Operasyon subtype truth'e göre gerçekten bitmiş olmalı.
2. Müşteri onayı alınmış olmalı.
3. Finansal kapanış authoritative biçimde tamamlanmış olmalı.

Buna göre:

- `invoice approve` finansal ve dokümansal bir gate'tir, tek başına completion
  değildir.
- `completion approve` müşteri teslim/iş onayı truth'ü olarak ele alınmalıdır.
- `billing capture` shell'i tek başına kapatmamalı; completion kararının bir
  parçası olmalıdır.

## Cancel Kuralı

- Her case type yalnızca kendi authoritative cancel yolu ile `cancelled` olur.
- Appointment cancel, case cancel değildir; commercial state'e geri dönüş
  hareketidir.
- Tow cancel, fee/refund ve occupancy release içerdiği için ayrı orchestrator
  kalmalıdır.
- Billing cancel, shell cancel ile aynı akışa bağlanmalı; ikinci bağımsız
  terminal write üretmemelidir.

## Insurance Kuralı

- Insurance yalnızca `accident` için geçerlidir.
- Insurance branch case shell'ini otomatik kapatmaz.
- Insurance reddi, case'i `cancelled` yapmaz.
- Insurance kabulü, repair teklif/randevu akışını isterse bilgilendirir ama
  onu tek başına zorunlu gate haline getirmez.

## Mobile Projection Kuralı

- Generic case tracking, case kind ve subtype stage aware olmalıdır.
- Tow ekranı stage üstünden okunmalıdır.
- Non-tow ekranları shell üstünden çalışabilir; fakat subtype branch
  bilgilerini saklamamalıdır.
- Review butonu yalnızca gerçek terminal `completed` sonrası görünmelidir.

## Sonuç

Canonical yön şudur:

- `status` = shell
- `stage` = subtype operasyon truth'ü
- `billing/insurance/appointment` = yan branch graph'ları
- `completed/cancelled` = tek anlamlı sink state

Bu model, hem backend guard'larını sadeleştirir hem mobile parity sorununu
çözmek için net bir zemin kurar.
