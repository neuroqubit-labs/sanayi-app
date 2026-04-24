# 2026-04-23 Domain Model Fix Backlog

Bu backlog implementasyon sırası için hazırlanmıştır. Kod değişikliği içermez;
audit sonuçlarını uygulanabilir iş paketlerine böler.

## Hemen Düzelt

- `Subtype truth`:
  `service_case` ortak shell, subtype tablolar hedefi resmi karar olarak
  sabitlenmeli. Yeni feature'lar subtype verisini tekrar `request_draft` içine
  eklememeli.
  Sahip ekip: `backend + product`

- `Tow relation`:
  `towing_required` boolean'ı canonical domain relation olarak kullanılmaktan
  çıkarılmalı; `accident/breakdown -> linked tow case` kuralı resmi hale
  getirilmeli.
  Sahip ekip: `backend + customer app + product`

- `Workflow drift`:
  `breakdown/towing -> maintenance_standard` fallback ve tow'un shared enum
  dışında blueprint string yazması blocker olarak işaretlenmeli.
  Sahip ekip: `backend`

- `Subtype payload loss`:
  Customer shared draft ve submit katmanında kaybolan alanlar
  (`damage_severity`, `maintenance_detail`, attachment category) P0 contract
  backlog'una alınmalı.
  Sahip ekip: `customer app + shared domain`

- `Vehicle snapshot policy`:
  Matching'e girecek araç sinyallerinin master mı snapshot mı olacağı resmi
  tablo üzerinden kilitlenmeli; aksi halde yeni alanlar yine dağınık eklenir.
  Sahip ekip: `backend + product`

## Launch Öncesi

- `Subtype create contracts`:
  Generic `ServiceRequestDraftCreate` kullanımının uzun vadeli kaderi
  netleştirilmeli; subtype-specific request yüzeyleri tasarlanmalı.
  Sahip ekip: `backend + customer app`

- `Workflow seeding`:
  Shared workflow tabloları gerçekten kullanılacaksa seed ve read path'leri
  bağlanmalı; kullanılmayacaksa "varmış gibi" kalmamalı.
  Sahip ekip: `backend`

- `Vehicle model extension`:
  `body_type`, `vehicle_segment`, `drivetrain`, `gross_weight_class`,
  `vehicle_photo_asset_ids`, `plate_photo_asset_id` için canonical schema
  hazırlanmalı.
  Sahip ekip: `backend + customer app`

- `Insurance boundary hardening`:
  Claim domain'i generic `case.kind` kontrolünden subtype sınırına
  taşınabilecek şekilde tasarlanmalı.
  Sahip ekip: `backend`

- `Shared contract split`:
  `ServiceCaseSummary` ve subtype detail union yönü netleşmeli.
  Sahip ekip: `shared domain + mobile`

## Algoritma V2

- `Subtype-specific matching signals`:
  Accident, breakdown, maintenance ve tow için normalize alanlar doğrudan
  matching karar motoruna bağlanmalı.
  Sahip ekip: `backend`

- `Vehicle snapshot usage`:
  Matching ve fiyatlama, live vehicle kaydı yerine immutable case snapshot
  üstünden çalışmalı.
  Sahip ekip: `backend`

- `Linked case orchestration`:
  `accident/breakdown -> tow` relation'ı orchestration, bildirim ve takip
  ekranlarında first-class hale getirilmeli.
  Sahip ekip: `backend + customer app + service app`

## Ürün Kararı Gerekli

- `Immediate tow` ile generic case shell arasındaki kullanıcı görünürlüğü
  seviyesi ne olacak:
  tam case timeline mı, daha hafif dispatch görünümü mü?

- `Breakdown` için subtype workflow ne kadar derin olacak:
  sadece diagnosis + offer mı, yoksa bakım benzeri repair/delivery zinciri mi?

- `Vehicle snapshot` kullanıcıya ne kadar gösterilecek:
  sadece sistem içi truth mü, yoksa case detayında "araç bu haliyle kaydedildi"
  açıklaması mı olacak?

- `Insurance` ileride `breakdown` veya `tow` ile ilişkilenebilecek mi, yoksa
  uzun vadede de sadece `accident` bounded context'i olarak mı kalacak?
