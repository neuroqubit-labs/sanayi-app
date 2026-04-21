# Shared Media Upload Gap Report

Tarih: 2026-04-20

## 1. Ozet

Media upload foundation cekirdek olarak olusmus durumda:

- `packages/domain` tarafinda `MediaAsset` kontrati ve ilgili `asset` referanslari eklenmis.
- `packages/mobile-core` tarafinda `createMediaApi` ve `uploadAsset` akisi testlerle dogrulanmis.
- Backend tarafinda `/media` endpointleri, auth dependency, S3 gateway, LocalStack konfigurasyonu ve image worker omurgasi eklenmis.
- Technician profile certificate upload ekrani gercek picker + presign + direct upload + complete akisini kullaniyor.

Ancak sistem butunsel olarak henuz "demo-ready" degil. En kritik bosluklar:

1. Customer app typecheck kirik; `CaseAttachment.asset` alani bazi manual attachment ureten yerlerde tasinmamis.
2. Technician onboarding certificate akisi hala `mock://` uzerinden ilerliyor.
3. Technician evidence/job upload akislari gercek picker/upload yerine mock store mutasyonu kullaniyor.
4. Public media yuzeyleri (gallery, promo, avatar) icin foundation var, UI entegrasyonu yok.
5. Backend pytest dogrulamasi mevcut ortamda bloke; repo `Python >= 3.12` isterken makine `Python 3.10.12`.

## 2. Statik Dogrulama Sonuclari

| Yuzey | Komut / kontrol | Sonuc | Not |
|---|---|---|---|
| Domain | `pnpm --filter @naro/domain typecheck` | GECTI | Kontrat seviyesi temiz |
| Mobile core | `pnpm --filter @naro/mobile-core test` | GECTI | `media.test.ts` dahil 12 test gecti |
| Customer app | `pnpm --filter naro-app typecheck` | BASARISIZ | `asset` propagation eksik |
| Service app | `pnpm --filter naro-service-app typecheck` | GECTI | Certificate upload entegrasyonu type seviyesinde oturmus |
| Backend syntax | `python -m compileall app tests` | GECTI | Import/syntax seviyesi temiz |
| Backend pytest | `cd naro-backend && python -m pytest -q` | BLOKLU | Python 3.10 sebebiyle `datetime.UTC` import'u kiriliyor |

### Customer app typecheck kiriklari

- [AddAttachmentSheet.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/components/AddAttachmentSheet.tsx:80)
  Manual uretilen `CaseAttachment` nesnesinde `asset` eksik.
- [store.ts](/home/alfonso/sanayi-app/naro-app/src/features/cases/store.ts:201)
  `draft.attachments -> documents` donusumunde `asset` alinmiyor.

Bu iki kirik, kontratin customer app'e kismen tasindigini gosteriyor.

## 3. Kontrat Uyumluluk Matrisi

| Yuzey | Durum | Degerlendirme |
|---|---|---|
| `MediaAssetSchema` <-> mobile-core parse | Uyumlu | [media.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/media.ts:6) backend envelope'larini parse ediyor |
| `CaseAttachment.asset` | Kismi | Domain'de var, picker akisi dolduruyor; manual attachment yollarinda eksik |
| `CaseDocument.asset` | Kismi | Domain'de var, ama customer store map'inde tasinmiyor |
| `TechnicianCertificate.asset` | Uyumlu | Profile certificate upload gercek asset donuyor |
| Backend `/media/uploads/intents` | Uyumlu | mobile-core request sekli backend ile ayni |
| Backend `/media/uploads/{id}/complete` | Uyumlu | complete envelope -> `MediaAsset` parse oluyor |
| Backend `GET /media/assets/{id}` | Kismi | Endpoint var ama UI tarafinda hic kullanilmiyor |
| Backend `DELETE /media/assets/{id}` | Kismi | Endpoint var ama UI tarafinda hic kullanilmiyor |
| Signed URL refresh | Uyumsuz | `getAsset` mevcut ama expire oldugunda hicbir ekran refetch yapmiyor |

## 4. Mock Data ve Mock Flow Envanteri

### A. Gercek upload'a gecmesi gereken ama mock kalan yuzeyler

| Akis | Kanit | Durum | Oneri |
|---|---|---|---|
| Technician onboarding certificate | [certificates.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/certificates.tsx:20) | Sadece mock | Profile certificate ekranindaki upload mantigi onboarding'e tasinmali |
| Technician job evidence quick upload | [JobTaskScreen.tsx](/home/alfonso/sanayi-app/naro-service-app/src/features/jobs/screens/JobTaskScreen.tsx:176) | Sadece mock | `addEvidence` once gercek picker/upload, sonra store mutasyonu kullanmali |
| Customer manual attachment sheet | [AddAttachmentSheet.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/components/AddAttachmentSheet.tsx:80) | Kismi / kirik | Manual uretilen attachment'lar ya gercek upload'a baglanmali ya da `asset: null` ile kontrat tamamlansin |

### B. Fixture olarak kalabilir ama yeni kontratla hizalanmali yuzeyler

| Akis | Kanit | Durum | Oneri |
|---|---|---|---|
| Technician profile fixture certificates | [fixtures.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/technicians/data/fixtures.ts:12) | Fixture | `asset: null` bilincli tutulabilir; raporda fixture olarak isaretlensin |
| Technician gallery fixtures | [fixtures.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/technicians/data/fixtures.ts:78) | Fixture | Public media UI gelene kadar `asset: null` kabul edilebilir |
| Shared tracking mock data | `packages/mobile-core/src/tracking/mock-data.ts` | Fixture | Demo veri olarak kalabilir ama "read-only fixture" diye etiketlenmeli |

### C. Kontrat uyumu icin guncellenmesi gereken mock turetme noktalar

| Akis | Kanit | Durum | Oneri |
|---|---|---|---|
| Customer store document map | [store.ts](/home/alfonso/sanayi-app/naro-app/src/features/cases/store.ts:201) | Eksik | `document.asset = item.asset ?? null` tasinmali |
| Tracking engine generated attachments/docs | `packages/mobile-core/src/tracking/engine.ts` | Kismi | Uretilen tum attachment/document nesneleri kontrati eksplisit doldurmali |

## 5. Tasarim ve UX Readiness

### Technician profile certificate upload

Kanit: [CertificateUploadScreen.tsx](/home/alfonso/sanayi-app/naro-service-app/src/features/profile/screens/CertificateUploadScreen.tsx:64)

| UX adimi | Durum | Not |
|---|---|---|
| Picker acma | Var | Foto/PDF ayrimi var |
| Upload loading | Var | `isUploading` ve buton label'i degisiyor |
| Error alert | Var | `Alert.alert("Yukleme basarisiz", ...)` |
| Success state | Var | Dosya secili durumuna geciyor, submit sonrasi alert var |
| Retry | Kismi | Alert sonrasi kullanici tekrar deneyebiliyor ama acik retry CTA yok |
| Progress bar | Yok | `uploadAsset.onProgress` tanimli ama UI kullanmiyor |
| Expired signed URL refresh | Yok | `mediaApi.getAsset` hicbir yerde kullanilmiyor |

### Customer case composer attachment akisi

Kanit: [useAttachmentPicker.ts](/home/alfonso/sanayi-app/naro-app/src/shared/attachments/useAttachmentPicker.ts:40)

| UX adimi | Durum | Not |
|---|---|---|
| Picker acma | Var | Photo/document/video icin bagli |
| Upload loading | Var | `status === "uploading"` ile disable |
| Error alert | Var | Alert tabanli |
| Success state | Var | `AttachmentDraft.asset` doluyor |
| Retry | Kismi | Alert sonrasi manuel tekrar deneme |
| Progress bar | Yok | Progress callback UI'ya bagli degil |
| Contract completeness | Kismi | Composer akisi iyi, manual attachment sheet kirik |

### Technician evidence / gallery / promo / avatar

| Akis | Durum | Not |
|---|---|---|
| Technician evidence quick upload | Sadece mock | UI butonu var, gercek upload yok |
| Gallery | Kontrat hazir ama UI yok | `GalleryItem.asset` var ama upload akisi yok |
| Promo video | Kontrat hazir ama UI yok | State'te alan dusunulmus, ekran yok |
| Avatar | Foundation var ama UI yok | `user_avatar` purpose var, kullanim yok |

## 6. Backend ve Ortam Readiness

### Kod readiness

| Baslik | Durum | Not |
|---|---|---|
| Access token -> current user | Var | [deps.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/deps.py:42) |
| Media routes | Var | intent / complete / get / delete mevcut |
| S3 signed PUT/GET | Var | [s3.py](/home/alfonso/sanayi-app/naro-backend/app/integrations/storage/s3.py:15) |
| Bucket bootstrap | Var | `ensure_bucket_exists` var |
| Image derivative worker | Var | [media.py](/home/alfonso/sanayi-app/naro-backend/app/workers/media.py:29) |
| Multipart upload | Yok | Kod sadece `single_put` donuyor |
| Repository bazli ownership | Yok | Yetki kontrolu role bazli, domain ownership dogrulama yok |
| Asset refresh/delete UI entegrasyonu | Yok | Endpoint var, client kullanmiyor |

### Ortam readiness

| Baslik | Durum | Not |
|---|---|---|
| Python runtime | Bloklu | Makine `3.10.12`, repo `>=3.12` |
| Pytest guvenilirligi | Bloklu | `datetime.UTC` import'u 3.10'da kiriliyor |
| LocalStack wiring | Kismi | Compose'a ekli, ama gercek upload smoke testi yapilmadi |
| Boto3/Pillow/ARQ install path | Kismi | `compileall` gecti, fakat runtime smoke yok |

### Backend readiness sinifi

- Kod dogru ama ortam yanlis: `pytest`, runtime import, Python 3.12 gereksinimi
- Kod eksik: multipart upload, repository tabanli ownership, signed URL refresh kullanan client yolu
- Ikisi de eksik: end-to-end LocalStack smoke test ve worker enqueue'nin gercekten calistigi dogrulanmamis

## 7. Uctan Uca Senaryo Readiness

| Senaryo | Durum | Not |
|---|---|---|
| Technician profile certificate upload | Calisiyor | En ileri gercek akis |
| Customer case attachment upload | Kismen bagli | Composer akisi var, manual attachment ve document map kirik |
| Attachment -> case document yansimasi | Kismen bagli | `documents` map'inde `asset` dusuyor |
| Technician onboarding certificate | Sadece mock | Profile upload reuse edilmiyor |
| Technician job evidence quick upload | Sadece mock | Store mutasyonu var, gerçek upload yok |
| Technician gallery | Kontrat hazir ama UI yok | Public medya foundation hazir |
| Technician promo video | Kontrat hazir ama UI yok | Purpose var, ekran yok |
| Avatar | Kontrat hazir ama UI yok | Purpose var, ekran yok |

## 8. Oncelikli Gap Listesi

### P0

1. Customer app `asset` propagation kiriklari
   - Etki: typecheck kirik, kontrat butunlugu bozuk
   - Aksiyon: manual attachment ve document map akislarini yeni `asset` kontratina hizala

2. Backend dogrulama ortami bloklu
   - Etki: `/media` foundation gercek testten gecmiyor
   - Aksiyon: Python 3.12 ile backend test env kur, pytest ve media smoke testlerini calistir

### P1

3. Technician onboarding certificate halen mock
   - Etki: kullanici iki farkli certificate deneyimi yasiyor
   - Aksiyon: onboarding adimi profile certificate upload mantigini reuse etsin

4. Technician evidence quick upload halen mock
   - Etki: service-side en kritik operasyonel medya akisi gercek degil
   - Aksiyon: picker + upload + store mutation zinciri eklenmeli

5. Signed URL refresh path yok
   - Etki: private dosya URL'leri zaman asimina ugrarsa ekranda stale link kalir
   - Aksiyon: asset render eden UI'larda `mediaApi.getAsset` ile refresh yolu tasarlanmalı

### P2

6. Gallery / promo / avatar UI entegrasyonlari eksik
   - Etki: public medya stratejisi foundation seviyesinde kalmis
   - Aksiyon: profile edit yuzeylerine upload flow ekle

7. Multipart upload yok
   - Etki: buyuk video dosyalarinda olcek riski
   - Aksiyon: `100MB+` icin backend ve mobile-core kontratini genislet

## 9. Sonraki Implementasyon Turuna Net Oneri

Sira olarak su paket mantikli:

1. Customer app typecheck onarimi
2. Onboarding certificate -> profile upload reuse
3. Technician evidence quick upload gercekleme
4. Python 3.12 backend smoke test + LocalStack upload testi
5. Signed URL refresh kullanan read path

Bu siralama ile hem demo riski azalir hem de customer/service tarafinda en kritik medya yolları gercek davranisa yaklasir.
