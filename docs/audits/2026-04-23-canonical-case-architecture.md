# 2026-04-23 Canonical Case Architecture Note

## Amaç

Bu not, audit boyunca referans alınacak hedef domain omurgasını tanımlar.
Kod değişikliği yapmaz; implementation fazında mimari kararları kilitlemek için
üretilmiştir.

## Canonical Model

### 1. Shared Shell

`service_cases` ortak üst varlık olarak kalır.

Bu katmanın sorumluluğu:

- ortak kimlik ve discriminator (`id`, `kind`)
- ownership / visibility (`customer_user_id`, `assigned_technician_id`)
- ortak ticari durum (`status`, `billing_state`, `closed_at`)
- üst seviye listeleme özetleri (`title`, `summary`, `location_label`)
- audit / event / document / participant bağları
- immutable request trace için snapshot pointer'ı

Bu katmanın sorumluluğu olmaması gerekenler:

- tow dispatch lifecycle detayları
- accident hasar semantiği
- breakdown diagnosis semantiği
- maintenance kategori detayı
- araç uyumluluğu için subtype-specific operasyon verisi

### 2. First-Class Subtypes

Hedef referans model:

- `service_case`
- `tow_case`
- `accident_case`
- `breakdown_case`
- `maintenance_case`

Beklenen ilişki:

- Her subtype kaydı `service_case.id` ile birebir bağlanır.
- `kind` ile subtype tablosu tutarlı olmalıdır.
- Shared shell var olup subtype yoksa kayıt eksik sayılır.

### 3. Linked Tow Relation

Tow ayrı bir case ailesidir.

- `immediate tow` ürün deneyimi anlık dispatch gibi akabilir.
- Buna rağmen backend tarafında persisted `tow_case` olarak yaşamalıdır.
- `accident` veya `breakdown` içinden tow ihtiyacı doğarsa subtype içine
  boolean gömülmez; ayrı `tow_case` açılır.
- Ana vaka ile tow vaka arasında açık relation gerekir.

Canonical karar:

- `towing_required` kalıcı domain truth değildir.
- `linked tow case` relation canonical truth'tur.

### 4. Vehicle Master + Immutable Snapshot

Araç ana kaydı source of truth olarak kalır.

Ancak case operasyonu için gereken veriler canlı vehicle kaydına bağımlı
olmamalıdır.

Canonical karar:

- Vehicle master: uzun ömürlü araç profili, ownership, history, reminder,
  typed media.
- Vehicle snapshot: case açılışında dondurulmuş operasyonel kopya.

Snapshot'a aday veri:

- plaka, make, model, year
- fuel / drivetrain / body / segment / weight class
- km ve eşleşmeyi etkileyen durum verileri
- typed vehicle media referansları
- tow uyumluluğunu etkileyen alanlar

### 5. JSON Policy

`request_draft` veya eşdeğer JSON alanları tamamen kaldırılmak zorunda değil.

Ama canonical rolü şu olmalıdır:

- immutable request trace
- UI replay / support / audit
- freeform açıklama

Canonical rolü olmaması gerekenler:

- matching hard filter kaynağı
- ranking kaynağı
- workflow state kaynağı
- reporting / analytics primary source

## Public Interface Kararları

Bu faz runtime API değiştirmez; ama audit sonucunda gelecekteki canonical
interface yönü aşağıdaki gibi olmalıdır.

### 1. Case Detail Contract

Tek generic `ServiceCase` response yerine iki katman düşünülmeli:

- `ServiceCaseSummary`
- `ServiceCaseDetail = SharedCase + subtype detail union`

Subtype union örneği:

- `TowCaseDetail`
- `AccidentCaseDetail`
- `BreakdownCaseDetail`
- `MaintenanceCaseDetail`

### 2. Create Request Contract

Create yüzeyi subtype-first olmalıdır.

Hedef yön:

- `CreateAccidentCaseRequest`
- `CreateBreakdownCaseRequest`
- `CreateMaintenanceCaseRequest`
- mevcut ayrı `TowCreateCaseRequest`

`ServiceRequestDraftCreate` tek başına uzun vadeli canonical giriş yüzeyi
olmamalıdır; en fazla transport shell veya backward-compat köprüsü olarak
kalabilir.

### 3. Workflow Contract

Shared shell status ile subtype lifecycle ayrı yüzeyler olmalıdır.

- Shell: yüksek seviye kullanıcı ve ticari akış
- Subtype lifecycle: operasyonel detay

Tow için mevcut `tow_stage` bu ayrımın erken bir örneği sayılabilir; diğer
subtype'lar için de benzer ayrım gerekir.

## Insurance Boundary

Insurance v1 yalnızca `accident` subtype bounded context'i olarak ele alınır.

Canonical karar:

- Claim açma hakkı `accident_case` üzerinden okunur.
- Claim yaşam döngüsü generic `case.kind` kontrolüne değil subtype varlığına
  dayanmalıdır.
- Gelecekte diğer subtype'lara genişleme istenirse bu açık ürün kararıyla
  yapılmalıdır; bugünden generic claim domain'e genelleştirilmemelidir.

## Sonuç

Hedef mimari şu cümleyle özetlenebilir:

`service_case` ortak kabuk, subtype tablolar operasyonel truth, vehicle master
uzun ömürlü truth, case snapshot immutable operasyon kopyası, tow relation ise
ayrı case-to-case bağdır.
