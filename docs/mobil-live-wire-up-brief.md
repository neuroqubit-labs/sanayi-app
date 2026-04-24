# Mobil Live Wire-up Brief (B + C + A)

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbet:** UI-UX-FRONTEND-DEV
> **Referans:** [`naro-urun-use-case-spec.md`](naro-urun-use-case-spec.md) — UC-1 + UC-2 launch path
> **Ön koşul:** BE Faz A shipped (11 router, 60+ endpoint). Commit `a89c35d` tarihi itibarıyla hazır.

Mock-first evresi kapanıyor. Müşteri composer'ları + vehicle + çarşı feed + usta onboarding coverage şu an %100 mock; backend'e bağlanacak. Bu brief 3 PR hattını tanımlar: **B (onboarding coverage) → C (vehicle + consent) → A (composer live + feed)**.

---

## Strateji kararı — Mock-live

**BE seed** (FE dev önerisi + PO onay):
- Pilot 10 mock servis backend'de `is_mock=true` flag'li gerçek `technician_profiles` satırı olarak oturur.
- FE hiç mock fixture tutmaz (çarşı feed, vehicle, case — tümü live endpoint).
- LIVE_ENABLED_ENVS guard'ı sadece altyapı katmanında kalır (harita WS, broadcaster).
- `is_mock` end-user'a sızmaz; sadece admin moderation panelinde görünür (Cleaner sohbeti Hat A kontrolü).
- Pilot sonrası cleanup: tek SQL (`UPDATE technician_profiles SET deleted_at=now() WHERE is_mock=true`).

**BE görevi (paralel):** seed script + `is_mock` kolonu + admin panel filtresi. BE sohbetine ayrı sync gider.

---

## Sıra + PR bölümleme

| PR | Kapsam | App | UC | Bağımlılık |
|---|---|---|---|---|
| PR-B | Onboarding coverage step | service-app | UC-2 matching | BE taxonomy ✅ |
| PR-C | VehicleAddScreen live + history_consent | customer-app | UC-2 + UC-3 | BE vehicles ✅ |
| PR-A1 | Composer → POST /cases (4 kind) | customer-app | UC-1 + UC-2 | PR-C |
| PR-A3 | Çarşı feed + teknisyen detay | customer-app | UC-2 | PR-A1 (içerik için) |

**A2 (vehicle CRUD)** PR-C'nin içinde birleşik — ayrı PR açma.

---

## PR-B — Usta onboarding coverage step

**Backend endpoint (shipped):**
- `GET /taxonomy/service-domains` — domain listesi
- `GET /taxonomy/procedures?domain=X` — domain'e göre işlem
- `GET /taxonomy/brands` — marka listesi
- `GET /taxonomy/drivetrains` — motor tipi
- `PATCH /technicians/me/capabilities` — coverage kaydet (body: array)

**UX yapısı:** Tek step, 4 bölümlü accordion. Onboarding'in **7. adımı** (service-area picker 6. adım idi — önüne değil, ardına).

```
┌─ Adım 7: Hizmet kapsamı ─────────────┐
│ [▼] Uzmanlık alanları (1/12 seçili)  │  ← domain (zorunlu, ≥1)
│     ◎ Bakım  ◯ Motor  ◯ Elektrik     │
│                                      │
│ [▼] İşlemler (0/28)                  │  ← procedures (zorunlu, ≥1)
│     seçilen domain'e göre otomatik   │
│     expand olur                      │
│                                      │
│ [▼] Marka kapsamı (0/42)             │  ← brand_coverage (zorunlu, ≥1)
│     [ ] Tüm markalar                 │
│     [ ] BMW  [ ] Mercedes  [ ] Ford  │
│                                      │
│ [▼] Motor tipi (default: hepsi)      │  ← drivetrain (default hepsi)
│     [x] Benzin  [x] Dizel  [x] Hibrit│
│                                      │
│              [Devam et]              │
└──────────────────────────────────────┘
```

**Zorunluluk:**
- ≥1 service_domain, ≥1 procedure (seçilen domain altında), ≥1 brand (veya "tüm markalar" opt-out), ≥1 drivetrain (default: 4'ü birden).
- "Daha sonra tamamla" skip **yok** — admission gate bu ekranı bekler, hesap onaysız kalır.

**Davranış notu:**
- Domain seçilince o domain'in procedures'ı **otomatik expand** (her domain ayrı request). Performans için `useQuery` cache by domainId.
- "Tüm markalar" seçilince brand liste disable, empty `brand_coverage=null` gönderilir (BE tarafı null'ı "hepsi" yorumlar).

**Parity schema:** `naro-service-app/src/features/onboarding/coverage-schema.ts` (Zod) ↔ `naro-backend/app/schemas/technician.py` (Pydantic).

---

## PR-C — VehicleAddScreen live + history_consent

**Backend endpoint (shipped):**
- `POST /vehicles` — araç oluştur (owner link otomatik)
- `GET /vehicles/me` — aktif araçlar
- `GET /vehicles/{id}` — detay
- `GET /vehicles/{id}/dossier` — case + warranty özet (VehicleDetailScreen için)
- `PATCH /vehicles/{id}` — güncelle
- `DELETE /vehicles/{id}` — sil
- `POST /vehicles/{id}/history_consent` — toggle

**Wire edilecek:**
- VehicleAddScreen (538 satır shell mevcut) mock submit → `POST /vehicles`
- Araç ekleme akışının **son adımı** `history_consent` ekranı (mevcut metin zaten yazılı)
  - Kabul → payload'a `history_consent_granted=true` gömülür (veya ayrı `POST /history_consent` toggle)
  - Reddet → araç yine eklenir, skor vurgusu UI'da düşer (bkz. `memory/vehicle_history_consent.md`)
- Vehicle listesinin Zustand kaynağı → TanStack Query (`useVehiclesQuery`)
- VehicleDetailScreen → `GET /vehicles/{id}/dossier`

**Parity schema:** `naro-app/src/features/vehicles/schema.ts` ↔ `naro-backend/app/schemas/vehicle.py`.

**Mock silinecek:** `naro-app/src/features/vehicles/fixtures.ts` (varsa) + useVehiclesStore mock submit.

---

## PR-A1 — Composer → POST /cases

**Backend endpoint (shipped):**
- `POST /cases` — vaka oluştur, kind-bazlı body (`tow` / `accident` / `breakdown` / `maintenance`)
- `GET /cases/me` — müşterinin vakaları
- `GET /cases/{id}` — detay
- `POST /cases/{id}/cancel` — iptal

**Mevcut durum (teyit edildi):** `naro-app/src/features/cases/api.ts:193-204` → `useSubmitCase` `useCasesStore.getState().submitDraft()` çağırıyor, Zustand'a yazıyor. Backend'e gitmiyor.

**Wire edilecek:**
- `useSubmitCase` → `apiClient.post('/cases', { kind, vehicle_id, ...body })` ile değiştir
- Kind-bazlı body validation (Zod schema 4 varyant: tow/accident/breakdown/maintenance)
- Response `ServiceCase` → Zustand'da cache'le ama **kaynak artık BE**
- Optimistic UI **YOK** — evidence akışı backend'de, beklemek zorunlu (evidence-first invariant)
- Attachment (medya) pipeline: composer `/media/uploads/intents` → `S3 PUT` → `POST /cases` body'de `media_ids[]` (mevcut pattern Faz 11'de yazıldı)

**Parity schema:** `naro-app/src/features/cases/schemas/{tow,accident,breakdown,maintenance}.ts`.

**Evidence invariant:** BE `POST /cases` evidence eksikse reject eder (I-6). FE side'da submit öncesi schema validation yap — BE 422 almayalım.

---

## PR-A3 — Çarşı feed + teknisyen detay

**Backend endpoint (shipped):**
- `GET /technicians/public/feed?domain=X&brand=Y&district=Z` — filtreli liste
- `GET /technicians/public/{id}` — detay (public view, maskelenmiş)

**Wire edilecek:**
- UstalarScreen (çarşı) → `useTechniciansFeed({ domain, brand, district })`
- Filter chips → query params
- Empty state: "Bu filtre için usta bulunamadı. Filtreleri genişletmeyi dene."
- Teknisyen detay screen → `useTechnicianPublic(id)`

**Parity schema:** `naro-app/src/features/technicians/schemas.ts` ↔ `naro-backend/app/schemas/technician_public.py`.

**Mock silinecek:** `naro-app/src/features/technicians/fixtures.ts` çarşı feed array'i.

**Pilot not:** 10 mock servis BE seed'inde hazır olacak; feed boş dönmez.

---

## Adapter pattern — Zod ↔ Pydantic parity

Her feature için:
```ts
// naro-app/src/features/<feature>/schema.ts
import { z } from 'zod';
export const CaseOutSchema = z.object({ /* ... */ });
export type CaseOut = z.infer<typeof CaseOutSchema>;

// naro-app/src/features/<feature>/api.ts
export const useCase = (id: string) =>
  useQuery({
    queryKey: ['cases', id],
    queryFn: async () => {
      const raw = await apiClient.get(`/cases/${id}`);
      return CaseOutSchema.parse(raw); // parity garantisi
    },
  });
```

**Parity test (opsiyonel ama önerilir):** `tests/parity/cases.test.ts` — BE fixture response → Zod parse success.

---

## LIVE_ENABLED_ENVS kararı

- **Altyapı (WS, broadcaster, realtime tow):** guard kalır (mevcut harita pattern).
- **REST CRUD (cases, vehicles, technicians/public):** guard **YOK** — her env live. Dev ortamında BE seed dönecek, test ortamında da aynı.
- **Rationale:** mock-live switch sürpriz yaratır; BE seed bunu çözer.

---

## PR disiplini (her PR description başlığında)

```
## UC bağlantısı
UC-1 Çekici / UC-2 Vaka / UC-3 Süreç / UC-4 Ödeme

## Endpoint listesi
- POST /cases
- GET /cases/{id}

## Zod schema
- naro-app/src/features/cases/schemas/tow.ts

## LIVE_ENABLED_ENVS
Guard YOK (REST CRUD) / VAR (WS altyapı)

## Mock temizliği
- Silindi: naro-app/src/features/cases/fixtures.ts
- Zustand submitDraft → apiClient.post

## Test plan
- [ ] Kind=tow composer → case görünür
- [ ] Kind=accident composer → evidence eksik → 422 reject
- [ ] Empty feed → empty state
```

---

## Kapsam dışı (pilot-sonrası)

- ~~WebSocket-lı case detail screen~~ (sonra)
- ~~Offline mode + local persistence reconciliation~~ (sonra)
- ~~Push notification'dan derin link~~ (sonra)
- ~~Pagination cursor optimistik update~~ (sonra)

---

## Kabul kriteri

- [ ] Usta onboarding'de coverage step olmadan bir sonraki ekrana geçilemez
- [ ] Müşteri araç ekledikten sonra history_consent kararı alınmış (accept/reject)
- [ ] Composer'dan submit edilen vaka `/cases/me` listesinde görünür (BE kaynağı)
- [ ] Çarşı feed'de 10 mock + gerçek ustalar karışık listelenir (pilot Kayseri seed sonrası)
- [ ] Composer mock fixture'ları repo'da kalmadı (`grep -r "submitDraft.*Zustand" naro-app` sonuç yok)
- [ ] Zod parity testleri geçiyor (opsiyonel ama güçlü öneri)
