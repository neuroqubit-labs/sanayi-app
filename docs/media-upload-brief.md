# Medya Yükleme — Ürün Brief'i (BE + FE)

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbetler:** BACKEND-DEV (S3 + service + worker), UI-UX-FRONTEND-DEV (shared hook + UX)
> **Durum:** Altyapı yarı hazır; iş mantığı + production provision eksik. Dev'ler mevcut yapıyı **bu brief'e göre denetleyip tamamlar**.

---

## 1. Amaç ve bağlam

Naro'da medya (foto + video + PDF) **her üründen daha merkezde** — güven + kanıt + KVKK katmanı medyayla ayakta duruyor. Mevcut backend `MediaAsset` iskelet + 4 endpoint + S3 integration yazılmış ama:

- **Purpose taksonomisi tanımsız** — "vehicle_photo" ile "case_damage_photo" ile "technician_cert" arasındaki davranış farkı hard-coded yok
- **İş mantığı kuralları dokümanize değil** — hangi asset public? Hangisi KVKK-sensitive? Retention kaç gün? Max size per purpose?
- **İki mobil app'te duplicate hook riski** — paylaşılan `useMediaUpload` yok
- **Orphan cleanup + anti-virus + EXIF strip + compression** — hiçbiri production-ready değil
- **S3 production provisioning yapılmadı** — env şablonu var, gerçek bucket + CloudFront + IAM yok

Bu brief'in üstüne dev'ler **mevcut kod denetler + eksikleri tamamlar**. Yeni baştan yazmaya gerek yok — mevcut `app/services/media.py`, `app/workers/media.py`, `app/integrations/storage/`, `app/models/media.py`, `packages/domain/src/media.ts` ve `naro-service-app/src/shared/media/` korunur, brief kurallarıyla hizalanır.

---

## 2. Purpose master listesi (canonical taksonomi)

Her medya yüklemesi bu enum değerlerinden birini taşır. Her purpose farklı davranış:

| Purpose key | Owner | Visibility | Max size | Max boyut/süre | Retention | Anti-virus |
|---|---|---|---|---|---|---|
| `user_avatar` | `users.id` | public | 5 MB | 1024×1024 | sürekli (kullanıcı silme → purge) | gerek yok |
| `vehicle_license_photo` | `vehicles.id` | private | 10 MB | 2048×2048 | aktif + 2 yıl | **evet** |
| `vehicle_photo` | `vehicles.id` | private | 10 MB | 2048×2048 | aktif + 2 yıl | gerek yok |
| `case_damage_photo` | `service_cases.id` | private | 15 MB | 4096×4096 | case_closed + 2 yıl | gerek yok |
| `case_evidence_photo` | `service_cases.id` | private | 15 MB | 4096×4096 | case_closed + 2 yıl | gerek yok |
| `case_evidence_video` | `service_cases.id` | private | 200 MB | 1080p / 120 sn | case_closed + 2 yıl | gerek yok |
| `case_evidence_audio` | `service_cases.id` | private | 20 MB | — / 120 sn | case_closed + 2 yıl | gerek yok |
| `accident_proof` | `service_cases.id` | private (KVKK-sensitive) | 15 MB | 4096×4096 | case_closed + **10 yıl** (hukuki) | gerek yok |
| `insurance_doc` | `insurance_claims.id` | private (KVKK) | 20 MB | PDF veya 4K | **10 yıl** (VUK) | **evet** |
| `technician_avatar` | `technician_profiles.id` | public | 5 MB | 1024×1024 | aktif + 30 gün purge (deactivation) | gerek yok |
| `technician_gallery_photo` | `technician_profiles.id` | public | 10 MB | 1920×1920 | aktif + 30 gün | gerek yok |
| `technician_gallery_video` | `technician_profiles.id` | public | 100 MB | 1080p / 60 sn | aktif + 30 gün | gerek yok |
| `technician_promo_video` | `technician_profiles.id` | public | 150 MB | 1080p / 120 sn | aktif + 30 gün | gerek yok |
| `technician_cert` | `technician_certificates.id` | private (KVKK) | 20 MB | PDF / 2048px | aktif + 5 yıl (expiry sonrası) | **evet** |
| `tow_arrival_photo` | `service_cases.id` | private | 10 MB | 2048×2048 | case_closed + 1 yıl | gerek yok |
| `tow_loading_photo` | `service_cases.id` | private | 10 MB | 2048×2048 | case_closed + 1 yıl | gerek yok |
| `tow_delivery_photo` | `service_cases.id` | private | 10 MB | 2048×2048 | case_closed + 1 yıl | gerek yok |
| `campaign_asset` | `campaigns.id` (V2) | public | 15 MB | 1920×1920 | kampanya aktif + 30 gün | gerek yok |

**Server-side enforcement:** Upload intent endpoint'inde `purpose` doğrulanır. Mime + size + boyut purpose'tan türetilir; client hile yaparsa reddedilir. Üç alan (size_max, dim_max, mime_whitelist, duration_max_sec) tek kaynaktan: `app/services/media_policy.py` (yeni).

---

## 3. İş mantığı kuralları (production davranışı)

### 3.1 Upload pattern (mevcut — dokümante + enforce)

```
1. POST /api/v1/uploads/intents
   body: { purpose, mime, byte_size, owner_kind, owner_id, meta? }
   → { asset_id, presigned_put_url, expires_at }  (TTL: 5 dk)
   DB: media_assets row INSERT (status='pending')

2. Mobile PUT {presigned_put_url} (raw file)
   S3 direkt

3. POST /api/v1/uploads/{asset_id}/complete
   body: { checksum?, dimensions?, duration_sec? }
   → { asset_id, status='complete', view_url? }
   DB: status='complete', completed_at=NOW()
   Worker enqueue: media.process (compression + EXIF strip + antivirus)
```

### 3.2 Orphan cleanup
- `status='pending' AND created_at < NOW() - 24h` → hard delete (DB row + S3 object delete)
- Günlük ARQ cron `media_orphan_purge` (03:30 UTC)

### 3.3 EXIF strip (privacy-first)
- Upload complete → worker çağrısı: EXIF metadata (özellikle GPS) strip edilir
- Orijinal yüklenen hemen, worker finished olduktan sonra overwrite edilir
- `media_assets.exif_stripped_at TIMESTAMPTZ` audit kolonu

### 3.4 Compression
- Foto: JPEG Q85, purpose'un dim_max'ına resize (büyükse); PNG→JPEG dönüşüm opsiyonel (compress katsayısına göre)
- Video: max süreyi aşıyorsa truncate + H.264 1080p transcode (ffmpeg worker); ileri faz
- PDF: compression yok, sayfa sayısı limit (20 sayfa)

### 3.5 Antivirus tarama
- `antivirus_required=true` olan purpose'ler için upload complete → `media_antivirus_scan` worker
- Temiz → `status='complete'`, kirli → `status='quarantined'`, user'a + admin'e bildirim
- V1: ClamAV (Docker container); V2: S3 GuardDuty veya Cloudflare Scan

### 3.6 Access control
- `private` asset → sadece `owner_user_id` + ilişkili case/claim/profile üzerinden yetkili kullanıcı + admin erişebilir
- Download için her seferinde yeni presigned GET URL (TTL 15 dk)
- `public` asset → CloudFront direkt, presigned gerek yok
- Admin download → audit log zorunlu

### 3.7 Retention + KVKK
- Her purpose için retention kuralı (tabloda)
- ARQ cron `media_retention_sweep` (günlük): purpose + ilişkili owner state'e göre hard delete
- Kullanıcı KVKK silme talebi → 30 gün içinde hepsi purge
- Delete işlemi = S3 obj delete + DB row delete + audit log

### 3.8 Anti-fraud
- Aynı checksum 5+ kez yüklüyorsa → flag (sahte cert foto sirkülasyonu)
- Reverse image search (V2 — Google Vision API)
- EXIF timestamp vs upload timestamp > 30 gün → flag (eski foto yeni vaka)

---

## 4. Mobile UX gereksinimleri

### 4.1 Shared hook (yeni)
`packages/mobile-core/src/media/useMediaUpload.ts` — iki app tek hook'tan tüketir. Duplicate yok.

```typescript
const { upload, progress, cancel, retry, error } = useMediaUpload();
await upload({
  purpose: "case_damage_photo",
  ownerKind: "service_case",
  ownerId: caseId,
  source: { uri, mime, size },
});
```

### 4.2 Client-side öncesi
- `expo-image-manipulator` ile purpose.dim_max'a resize
- JPEG Q85 compress
- EXIF strip (client-side pre-upload; server yine strip eder — defense in depth)
- Video: purpose.duration_max_sec aşıyorsa trim UI göster

### 4.3 UX
- Progress indicator (% + KB/s)
- Cancel butonu (incomplete upload → intent DELETE)
- Retry + exponential backoff (1s, 3s, 9s — max 3 deneme)
- Offline queue: uploads persisted (Zustand persist), connection gelince otomatik flush
- Background upload: active dispatch'te çekici foto offline yükler (Expo TaskManager + BackgroundUpload)
- Hata state: "yeniden dene" / "tamamen vazgeç" net seçenek

### 4.4 Özel davranışlar per purpose
- `case_damage_photo` + `accident_proof`: çekim sırasında otomatik 4 açı rehberi (front/rear/left/right) — rehberli foto UI
- `technician_cert`: PDF + foto destek; foto ise OCR ipucu ("vergi levhası'nın yıl + numara okunabilir olmalı")
- `tow_*_photo`: çekici stage geçişi sırasında **foto zorunlu** — upload bitmeden transition etmez
- `technician_gallery_video` + `promo_video`: yükleme sırasında poster frame client-side otomatik çıkarılır

---

## 5. Mevcut yapıya dev denetim listesi

### BACKEND-DEV denetim noktaları

- [ ] `app/models/media.py` — `MediaAsset` modeli bu brief'in alanlarını taşıyor mu? Eksikse ALTER migration (`purpose`, `owner_kind`, `owner_id`, `exif_stripped_at`, `antivirus_scanned_at`, `checksum_sha256`, `dimensions_json`, `duration_sec`)
- [ ] `app/services/media.py` — policy enforcement (§2 matrisi) var mı? Yoksa `app/services/media_policy.py` oluştur
- [ ] `app/api/v1/routes/media.py` — §3.1 pattern birebir mi? `purpose` param validate mi?
- [ ] `app/workers/media.py` — mypy 2 error var (Image typing) → fix + compression + EXIF strip + antivirus hook
- [ ] `app/integrations/storage/` — presigned TTL purpose'a göre parametrik mi?
- [ ] ARQ cron'lar eksik: `media_orphan_purge` + `media_retention_sweep` + `media_antivirus_scan` — yazıp `app/workers/settings.py`'a register
- [ ] S3 production provisioning:
  - [ ] 2 bucket: `naro-media-private-prod`, `naro-media-public-prod`
  - [ ] CloudFront distribution (public bucket) + OAI + alias domain (ör. `cdn.naro.com.tr`)
  - [ ] Lifecycle rule: pending intent'ler 24 saat sonra S3'ten silinsin
  - [ ] CORS policy (sadece app origin + PUT method)
  - [ ] IAM user/role: backend'in sadece presigned + delete + metadata izni
  - [ ] Versioning açık (accident recovery için 30 gün)
- [ ] Test: `tests/test_media_policy.py` (18 purpose için max_size + mime reddetme), `tests/test_media_orphan_purge.py`, `tests/test_media_exif_strip.py`
- [ ] Observability metric: `media_upload_intent_total{purpose}`, `media_upload_complete_total{purpose}`, `media_orphan_purged_total`, `media_antivirus_quarantined_total`, `media_retention_deleted_total`

### UI-UX-FRONTEND-DEV denetim noktaları

- [ ] `packages/domain/src/media.ts` — `MediaPurpose` enum 18 değerle tam mı? `MediaUploadIntent`, `MediaAsset` Zod şemaları brief'e uyumlu mu?
- [ ] `packages/mobile-core/src/media/useMediaUpload.ts` — **yeni dosya**; iki app tüketir. `naro-service-app/src/shared/media/useServiceMediaUpload.ts` mevcut hook'tan genişletilir, service-app'e özel kısmı kaldırılır
- [ ] `naro-app/src/shared/media/` — varsa duplicate temizle, yeni mobile-core hook'a yönlendir (cleaner-controller koordinasyonu)
- [ ] Client-side compression (`expo-image-manipulator`) + EXIF strip — purpose.dim_max değerlerine göre
- [ ] Progress UI + retry + offline queue + background upload
- [ ] Per-purpose özel UX:
  - [ ] Kaza 7 foto rehberi
  - [ ] Çekici 4 açı guide
  - [ ] Cert OCR ipucu
  - [ ] Video poster frame otomatik
- [ ] Hata state'leri (upload fail, antivirus quarantine, size aşımı) için UI copy

### Ortak koordinasyon (shared contract)
- [ ] `packages/domain/src/media.ts` tek kaynak — max_size, dim_max, mime_whitelist her purpose için
- [ ] Brief bu doc; değişiklik olursa her iki taraf senkronize

---

## 6. Acceptance criteria

- [ ] 18 purpose için policy enforcement çalışıyor (max_size/mime/dim)
- [ ] Orphan purge cron canlı; 24h sonrası pending intent S3'ten silinmiş
- [ ] EXIF GPS stripped — upload complete sonrası metadata kontrol ✓
- [ ] Antivirus: test virüs dosyası quarantined, kullanıcı bildirimi
- [ ] Retention: policy aşan asset hard delete
- [ ] Private asset'e yetkisiz kullanıcı erişemez (403)
- [ ] CloudFront public asset'leri cache'liyor, private'lara erişim yok
- [ ] Mobile: `useMediaUpload` tek hook, iki app'te kullanılır
- [ ] Client-side compression çalışıyor (5 MB foto → 800 KB civarı)
- [ ] Offline queue: uçak modunda yüklenen sonra otomatik flush
- [ ] Background upload: tow dispatch'te foto app kapalıyken de yüklenir
- [ ] KVKK silme talebi → 30 gün içinde S3 + DB temiz
- [ ] Load test: 100 concurrent upload, p95 < 10 sn (4 MB foto için)

---

## 7. Out of scope (V2'ye)

- Reverse image search (anti-fraud)
- ffmpeg transcoding (video compression tam server-side)
- ML-based photo quality scoring
- Face blur (accident/cert'te kullanıcı yüzü otomatik blur)
- Campaign asset management (V2)

---

## 8. Faz planı

**Sorumlu sohbet:** BACKEND-DEV + UI-UX-FRONTEND-DEV paralel, PO koordinatör.

- **Gün 1-2 (BE):** Policy matrix + media_policy.py + model ALTER + mypy fix + orphan cron + retention cron
- **Gün 1-2 (FE):** `packages/mobile-core/src/media/useMediaUpload.ts` + compression + EXIF + progress
- **Gün 3 (BE):** S3 production provisioning + CloudFront + IAM + env secret
- **Gün 3 (FE):** Offline queue + background upload + per-purpose UX
- **Gün 4 (ortak):** End-to-end smoke — her purpose için intent → PUT → complete → view working
- **Gün 5 (BE):** Antivirus worker (ClamAV Docker) + metric export
- **Gün 5 (PO):** Kabul kriterleri doğrulama + KARAR-LOG kayıt

**Toplam:** ~5 iş günü (2 dev paralel).

---

## 9. Referanslar

- [docs/veri-modeli/09-media-asset.md](veri-modeli/09-media-asset.md) — mevcut DB şema doc
- [docs/media-upload-gap-report.md](media-upload-gap-report.md) — önceki gap raporu (denetlenecek)
- [naro-backend/app/services/media.py](../naro-backend/app/services/media.py)
- [naro-backend/app/workers/media.py](../naro-backend/app/workers/media.py)
- [naro-backend/app/integrations/storage/](../naro-backend/app/integrations/storage/)
- [packages/domain/src/media.ts](../packages/domain/src/media.ts)
- [naro-service-app/src/shared/media/](../naro-service-app/src/shared/media/)
