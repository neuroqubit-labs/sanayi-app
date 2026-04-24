# Tow Invariant Checklist — 2026-04-23

## Matching

| İnvariant | Beklenen | Bugünkü durum | Not |
|---|---|---|---|
| `towing` sadece `cekici` adaylarına görünür | Pool, offer submit ve service-app filtreleri yalnızca `cekici` kabul eder | **FAIL** | Backend ve service app `usta`yı da kabul ediyor |
| Accepted tow, çekiciyi ikinci işe açık bırakmaz | Occupancy lock terminal stage'e kadar korunur | **FAIL** | Accept sonrası `current_offer_case_id` bırakılıyor |
| Decline/timeout sonrası bir sonraki aday seçilir | Lock release sadece decline/timeout için çalışır | **PASS/FAIL karışık** | Decline doğru, accept yanlış |
| Pool fallback yalnızca attempt/radius ladder tükenince olur | Search → timeout_to_pool kontrollü geçiş | **PASS** | Kodda ladder ve max attempt var |

## Payment

| İnvariant | Beklenen | Bugünkü durum | Not |
|---|---|---|---|
| Immediate tow create preauth ile başlar | Settlement/preauth yoksa dispatch başlamaz | **FAIL** | Tow preauth service var ama route'a bağlı değil |
| Cancellation fee `stage_at_cancel` bazlıdır | Mutasyondan önceki stage kullanılmalı | **FAIL** | Route, `cancelled` stage sonrası fee'yi yeniden hesaplıyor |
| Refund authoritative settlement üzerinden yürür | Ledger ve PSP çağrısı aynı kaynağa bakar | **PARTIAL** | Settlement/refund servisleri var, create path bağsız |
| Capture/refund idempotent olmalı | Idempotency key + durable kayıt | **PASS** | Tow payment service bu yapıyı kurmuş |

## Tracking ve OTP

| İnvariant | Beklenen | Bugünkü durum | Not |
|---|---|---|---|
| Service-app location POST canonical route'u vurur | `/tow/cases/{id}/location` | **FAIL** | Client `/tow/${id}/location` vuruyor |
| Arrival/delivery OTP server authoritative olur | Issue + verify backend'de tutulur | **FAIL (launch path)** | UI local OTP kullanıyor |
| Customer tracking state backend snapshot'tan gelir | Local store yalnızca cache/shadow olabilir | **FAIL** | Customer tow ekranı local snapshot tabanlı |
| Provider active job state backend'ten gelir | Demo job store launch path olmamalı | **FAIL** | Service app active tow job local |

## Contract Parity

| İnvariant | Beklenen | Bugünkü durum | Not |
|---|---|---|---|
| FE route path'i backend canonical route ile aynı olmalı | Path drift olmamalı | **FAIL** | Billing approvals + refunds + tow location |
| FE response shape'i backend canonical DTO ile aynı olmalı | Parse layer authoritative | **FAIL** | Approval decision wrapped response bekleniyor |
| Shared domain enum'ları backend live enum'larını kapsamalı | Live ek değerler parse kırmamalı | **FAIL/P2** | Tow extra stage/status drift'i var |

## Non-Tow Parity

| İnvariant | Beklenen | Bugünkü durum | Not |
|---|---|---|---|
| Offer accept atomic olmalı | Tek accept + sibling reject tek yarışta güvenli olmalı | **FAIL** | Check-then-update yapısı sürüyor |
| Customer case detail aksiyonları live olmalı | Offer/appointment/cancel local store'da kalmamalı | **FAIL** | `useCasesStore` hâlâ dominant |
| Service pool/jobs aksiyonları live olmalı | Teklif/randevu/messages backend ile senkron olmalı | **FAIL** | `useJobsStore` hâlâ dominant |

## Smoke Checklist

- [x] Python 3.12 audit ortamı `uv` ile doğrulandı
- [x] `dev` bağımlılıkları yüklendiğinde saf testler 3.12 altında koştu
- [x] Tow/billing/pool/payout route varlığı app router üstünden doğrulandı
- [x] Missing route'lar ve wrong-path consumer'lar çıkarıldı
- [ ] DB-backed smoke için `postgres` ve `redis` servisleriyle tekrar koşu
- [ ] Immediate tow create → preauth → dispatch → cancel senaryosunun gerçek entegrasyon smoke'u
