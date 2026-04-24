# 2026-04-23 Backend ↔ Mobile Lifecycle Drift

Bu tablo, backend'in gerçek lifecycle modelinin shared/mobile katmanda nerede
düzleştiğini gösterir.

## Drift Tablosu

| Surface | Backend truth | Mobile/shared varsayımı | Etki | Audit kararı |
| --- | --- | --- | --- | --- |
| `ServiceCaseStatusSchema` | Backend'te shell'e ek olarak tow, billing, insurance, appointment graph'ları var | Shared domain tek bir evrensel status enum'u sunuyor | Çoklu graph yapısı tip seviyesinde kayboluyor | Shared domain shell ve subtype branch'leri daha görünür hale getirmeli |
| Tow operasyonu | Primary truth `TowDispatchStage` | Generic tracking omurgası `ServiceCaseStatus` ile çalışıyor | Tow progress yanlış milestone'lara sıkışabilir | Tow tracking stage-first kalmalı |
| `TowCaseScreenLive` | Backend tow snapshot stage veriyor | Ekran `snapshot.stage` ile karar veriyor | Bu ekran görece doğru; generic sistemden daha tutarlı | Tow ekranı referans yaklaşım olarak korunmalı |
| `mobile-core` tracking engine | Backend case kind'e göre farklı lifecycle'lar taşıyor | Tüm case type'lar için tek `repairFlow` ve tek `completedUntilByStatus` kullanılıyor | Accident, breakdown, maintenance ve tow aynı ilerleme diliyle gösteriliyor | Tracking case kind aware hale getirilmeli |
| Service app case profil ekranı | Backend'te tow stage, appointment, approval ve billing ayrı branch'ler | `CaseProfileScreen` context ve sticky kararlarını yalnızca `case.status` üstünden veriyor | Usta uygulaması pool/process/archive kararını fazla kaba veriyor | Service app de subtype-aware projection kullanmalı |
| Review gate | Backend `case.status == completed` şartını arıyor | Mobilde completion algısı statik progress üstünden erken oluşabilir | Review CTA erken veya geç açılabilir | Review gösterimi canonical completion'a bağlanmalı |
| Mock case store | Backend generic create shell'i `matching` başlatıyor | Mock store `breakdown` ve `maintenance` için başlangıcı `offers_ready` seed ediyor | Demo akışları gerçek lifecycle'i maskeleyebilir | Mock seeding canonical shell'e çekilmeli |
| Tow shell sync | Backend tow stage'i shell'e `matching/service_in_progress/completed/cancelled` olarak yansıtıyor | Shared UI shell'i final truth gibi kullanabilir | `accepted`, `nearby`, `arrived` gibi kritik farklar kaybolur | Tow shell her zaman coarse projection olarak etiketlenmeli |

## Özel Notlar

### Tow tarafı iki ayrı UX gerçekliği yaşıyor

- `naro-app/src/features/tow/screens/TowCaseScreenLive.tsx` stage-aware
  çalışıyor.
- Generic mobile-core tracking ve service app case ekranları ise shell-aware
  çalışıyor.

Bu ikisinin aynı projede birlikte yaşaması, backend ile mobil arasında kopuk
çalışma hissinin ana kaynaklarından biri.

### Shared domain tek spine varsayıyor

`packages/domain/src/service-case.ts:229-241` tek `ServiceCaseStatus` enum'u
sunarken, `packages/domain/src/tow.ts:33-50` tow için ayrı stage tipi sunuyor.
Yani shared domain bile tow'un özel bir graph olduğunu biliyor; ama generic
ekran mantığı bu ayrımı sonuna kadar taşımıyor.

### Mock/store drift gerçek bug'ları gizleyebilir

`naro-app/src/features/cases/store.ts:176` customer mock store'da
`accident/towing -> matching`, `breakdown/maintenance -> offers_ready`
başlangıcı veriyor. Bu, gerçek backend başlangıç mantığı ile uyuşmadığı için
state machine sorunlarını demo sırasında saklayabilir.

## Audit Kararı

- Mobile tarafı tek progress spine varsayımından çıkmalı.
- `ServiceCaseStatus`, mobilde de shell olarak ele alınmalı.
- Tow ekranı stage-first yaklaşımını korumalı.
- Non-tow ekranları shell üstüne subtype branch rozetleri veya timeline
  segmentleri eklemeli.
- Mock/store seed'leri backend lifecycle truth'üne göre yeniden hizalanmalı.
