# 2026-04-23 State Machine Fix Backlog

Bu backlog, state machine audit bulgularını uygulanabilir sıraya böler.

## Hemen Düzelt

- `Authoritative shell writes`:
  Admin override hariç bütün `case.status` yazımları tek authority katmanına
  taşınmalı. `cases.py`, `offers.py`, `tow_dispatch.py`, `case_billing.py`
  direct write bölgeleri blocker kabul edilmeli.
  Sahip ekip: `backend`

- `Completed semantics`:
  `invoice approve`, `completion approve` ve `billing capture` yollarından
  yalnızca biri shell `completed` üretecek biçimde birleştirilmeli. Bu audit'in
  default kararı: `completed = iş bitti + müşteri onayı + ödeme kapanışı`.
  Sahip ekip: `backend + product`

- `Cancel orchestration`:
  Generic cancel, tow cancel ve billing cancel aynı terminal kelimeyi farklı
  yan etkilerle üretmemeli. Case kind bazlı authoritative cancel orchestrator
  sabitlenmeli.
  Sahip ekip: `backend`

- `Tow accept authority`:
  `tow_dispatch._transition_to_accepted()` shell status'u doğrudan yazmamalı;
  tow lifecycle authority'si altında ilerlemeli.
  Sahip ekip: `backend`

- `Mobile progress split`:
  Tow ve non-tow için tek progress spine varsayımı kaldırılmalı. Tow ekranı
  stage-first, generic case ekranları shell-first çalışmalı.
  Sahip ekip: `mobile + customer app + service app`

## Launch Öncesi

- `Lifecycle projection DTO`:
  Backend, shell status ile subtype/branch state'leri birlikte taşıyan net bir
  projection yüzeyi çıkarmalı. Mobil ekranlar kaba türetim yerine bu projeksiyonu
  tüketmeli.
  Sahip ekip: `backend + mobile`

- `Review gate hardening`:
  Review butonu ve review endpoint'i canonical completion anlamıyla birebir
  hizalanmalı.
  Sahip ekip: `backend + customer app`

- `Scheduled tow visibility`:
  `scheduled_waiting`, `bidding_open`, `offer_accepted` gibi tow stage'leri
  mobilde açık şekilde görünür olmalı; shell `matching` tek başına yeterli
  değil.
  Sahip ekip: `backend + customer app + service app`

- `Breakdown linked tow`:
  Breakdown içindeki tow ihtiyacı boolean flag olmaktan çıkarılıp linked child
  tow case kuralına taşınmalı.
  Sahip ekip: `backend + customer app`

- `Insurance branch UX`:
  Accident ekranları insurance branch'i ayrı ve opsiyonel olarak göstermeli;
  case shell ile karıştırmamalı.
  Sahip ekip: `backend + customer app`

## State Machine V2

- `Subtype stage families`:
  `accident`, `breakdown` ve `maintenance` için subtype-aware stage family
  tanımlanmalı.
  Sahip ekip: `backend + product`

- `Unified orchestration service`:
  Offer, appointment, approval, billing ve subtype stage etkilerini tek
  lifecycle orchestration katmanında toplama yönüne gidilmeli.
  Sahip ekip: `backend`

- `Projection-first mobile architecture`:
  Generic tracking ve service app context kararları, raw status switch yerine
  backend projection modeli üstünden çalışmalı.
  Sahip ekip: `mobile + customer app + service app`

- `State transition observability`:
  Her authoritative transition için tek tip event, metric ve audit trail
  standardı tanımlanmalı.
  Sahip ekip: `backend`

## Default Seçilmiş Ürün Kararları

- `Completion truth`:
  Varsayılan olarak `invoice approve` tek başına completion sayılmaz.

- `Insurance boundary`:
  Insurance yalnızca `accident` branch'idir; generic shell'i tek başına
  bloklamaz.

- `Breakdown + tow`:
  Tow gerektiğinde ana breakdown kapanmaz; linked tow child case açılır.

- `Tow shell`:
  Tow için authoritative operasyon `TowDispatchStage` olur; shell yalnızca
  coarse visibility taşır.

- `Terminal states`:
  `completed` ve `cancelled`, admin override hariç sink state kabul edilir.
