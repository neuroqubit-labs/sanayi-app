# Veri Modeli Denetim — Karar Log

Her eksen incelendikçe alınan kararlar buraya düşer. Format:

```
- [eksen-id / konu] karar: keep | fix-now | defer-v2 | skip
  gerekçe: <cümle>
  aksiyon: <migration no / tablo / alan / öncelik — fix-now ise>
```

**Öncelik skalası:** P0 (data integrity / güvenlik) → P1 (use-case engelleyici) → P2 (nice-to-have / ergonomics).

Plan referansı: `~/.claude/plans/g-zel-ama-ok-kar-k-woolly-hamming.md`

---

## Faz 8 Execution Durumu (2026-04-21)

**Kapsam**: Sigorta hasar dosyası (`insurance_claims`) — migration 0014; tablo 30.

**Uygulanan ürün kararları:**

- ✅ **[K1]** Drafted state backend'de YOK — taslak mobil client-side (Zustand + AsyncStorage). Backend `submit_claim()` direkt `submitted` insert eder. Her küçük değişiklikte backend yükü yok.
- ✅ **[K2]** Submit sonrası düzenleme yok — revize yolu kaldırıldı; taahhüt.
- ✅ **[K3]** Reject sonrası yeni dosya açılabilir — partial unique `uq_active_insurance_claim_per_case WHERE status IN ('submitted','accepted','paid')` ile aktif claim case başına 1; rejected audit'te kalır.
- ✅ **[K4]** Status 4 değer: `submitted → accepted → paid` + `rejected`. Terminal: paid, rejected.

**State machine** ([insurance_claim_flow.py](naro-backend/app/services/insurance_claim_flow.py)):
```
submitted ──┬─→ accepted ──┬─→ paid (terminal)
            │              └─→ rejected
            └─→ rejected
```
Her transition → `case_events` INSERT + `case_notification_intents` INSERT.

**Yeni enum'lar:**
- `insurance_claim_status` (4): submitted | accepted | paid | rejected
- `insurance_coverage_kind` (2): kasko | trafik
- `case_event_type` ADD VALUE ×4: `insurance_claim_submitted/accepted/paid/rejected` (tek yönlü)

**Doğrulama:**
- Ruff + mypy strict temiz
- Migration up/down/up yeşil
- **Smoke**: partial unique duplicate reject ✓; reject sonrası yeni açılım ✓
- Health regression ✓
- Tablo: 29 → **30**

**V2'ye devir** (Faz 10+): `insurance_providers` catalog, sigortacı API entegrasyonu, `payment_intents` + ledger, mobil engine refactor.

---

## Faz 7 Execution Durumu (2026-04-21)

**Kapsam**: Case process 14 tablo (4 alt faz). Migration 0010-0013; tablo 29.

- ✅ **7a** core: `case_milestones` + `case_tasks` + `case_approvals` + `case_approval_line_items` + `workflow_seed` (4 blueprint template) + `approval_flow` (SCHEDULED→SERVICE_IN_PROGRESS auto-start hook)
- ✅ **7b** artifacts: `case_evidence_items` + `case_documents` + `case_attachments` + 2 M:N link + `evidence` service
- ✅ **7c** communication: `case_threads` + `case_messages` + `case_message_attachments` + `messaging` service (unread counter + preview)
- ✅ **7d** audit+notif: `case_events` (append-only, 27 event type) + `case_notification_intents` + `case_events` service
- ✅ Event emission hook'ları 7 service'te: case_lifecycle, offer_acceptance, appointment_flow, approval_flow, evidence, messaging
- ✅ [07-case-process.md](docs/veri-modeli/07-case-process.md)

---

## Faz 6 Execution Durumu (2026-04-21)

**Uygulanan kararlar (bu fazda execute edildi):**

- ✅ **[12a]** Partial unique `uq_users_phone/email` — migration 0007; [user.py](naro-backend/app/models/user.py) `__table_args__`
- ✅ **[8a]** Commit disiplini — [user.py:36](naro-backend/app/repositories/user.py), [media.py:18+33](naro-backend/app/repositories/media.py) commit kaldırıldı; [auth.py::verify_otp](naro-backend/app/api/v1/routes/auth.py), [media.py route](naro-backend/app/api/v1/routes/media.py) write endpoint'lerde commit eklendi
- ✅ **[10c]** Pydantic `ServiceRequestDraftCreate` — yeni [schemas/service_request.py](naro-backend/app/schemas/service_request.py); [ServiceCaseCreate.request_draft](naro-backend/app/schemas/case.py) tipli + `schema_version: Literal["v1"]` zorunlu + 7 Python StrEnum
- ✅ **[7b, 11b]** `user_lifecycle.soft_delete_user` — yeni [services/user_lifecycle.py](naro-backend/app/services/user_lifecycle.py); [auth.py::revoke_all_sessions_for_user](naro-backend/app/repositories/auth.py) helper eklendi
- ✅ **Akış revize** (selectOffer mismatch [Eksen 1+13]) — 5 kuralın tamamı backend'e alındı:
  - `case_offers.slot_proposal JSONB + slot_is_firm BOOL + CHECK` (migration 0008)
  - `appointments.source + counter_proposal + counter_proposal_by_user_id + CHECK` (migration 0009)
  - `appointment_status` PG enum'a `counter_pending` ADD VALUE
  - [offer_acceptance.py::accept_offer](naro-backend/app/services/offer_acceptance.py) dallanmalı: firm slot → direct scheduled, non-firm → appointment_pending
  - [appointment_flow.py](naro-backend/app/services/appointment_flow.py) `counter_propose_slot / confirm_counter / decline_counter` eklendi
  - `AppointmentSource` StrEnum + `AppointmentStatus.COUNTER_PENDING`

**Dokümantasyon güncellemeleri:**
- ✅ [05-offer.md](docs/veri-modeli/05-offer.md) — DDL + state diagram + `accept_offer` revize
- ✅ [06-appointment.md](docs/veri-modeli/06-appointment.md) — DDL + source kuralları + state diagram + counter flow

**Migration sırası (Faz 6 sonu):**
- `20260421_0007_users_partial_unique` — H1
- `20260421_0008_offer_slot_proposal` — H3a
- `20260421_0009_appointment_counter` — H3b (tek yönlü: `counter_pending` enum değeri DROP edilemez)

**V1 artı Faz 6 tablo sayısı:** 15 tablo (değişmedi; yalnızca alanlar + index'ler genişledi).

---

## Faz 7 — Sinyal Hiyerarşisi Mimarisi (2026-04-21)

**Tetikleyici:** PM sohbetinde matching algoritması için sinyal modeli tartışması; 5-boyutlu hiyerarşi → 7-boyutlu pro versiyona çıkarıldı; plan `~/.claude/plans/5-boyutlu-yap-g-zel-bright-umbrella.md`.

**Tamamlanan çıktılar:**

- ✅ **[Doc-Mimari]** [docs/sinyal-hiyerarsi-mimari.md](docs/sinyal-hiyerarsi-mimari.md) — 7-boyutlu sinyal hiyerarşisi (NE / HANGİ / NEREDE / NASIL / KİM / EKONOMİ / TRUST-LEDGER); matching tekniği per katman (hard filter / soft score / embedding); müşteri minimum-info + usta minimum-friction UX stratejisi; taksonomi sahipliği ve UX compromise tablosu
- ✅ **[Doc-Backend]** [docs/veri-modeli/16-technician-sinyal-modeli.md](docs/veri-modeli/16-technician-sinyal-modeli.md) — 02-technician V2 uzantısı: 6 master taxonomy tablosu + 9 usta sinyal tablosu + 1 performance snapshot tablosu; admission gate güncellendi (6 zorunlu); API uç noktaları (coverage/service-area/schedule/capacity + taxonomy endpoints); ARQ performance snapshot job tasarımı; migration stratejisi (V1 serbest metin alanları deprecated, taşınmaz)
- ✅ **[Shared contract]** `packages/domain/src/taxonomy/` paketi — `service-domain.ts` (12 enum + meta), `procedure.ts` (60 procedure × domain × typical_labor_hours), `brand.ts` (40 brand + tier map), `drivetrain.ts` (9 enum), `district.ts` (81 il + 50 ilçe + haversine helper + suggestDistrictsInRadius); `packages/domain/src/technician.ts` (Zod: TechnicianCoverage, ServiceArea, WeeklySchedule, StaffCapacity, PerformanceSnapshot + LatLng + ScheduleSlot + EMPTY_* defaults)
- ✅ **[Kontrat köprüsü minimal patch]** `naro-service-app/src/features/technicians/types.ts` — TechnicianProfileState'e V2 alanları eklendi (service_domains, procedures, procedure_tags, brand_coverage, drivetrain_coverage, service_area, working_schedule, capacity, latest_performance); legacy specialties/expertise/working_hours/area_label deprecated JSDoc ile korundu (UI kırmayı önle)
- ✅ **[Fixture]** `data/fixtures.ts` — AutoPro Servis BMW-motor seed'i V2 alanlarla dolduruldu; `profile-store.ts` + `onboarding/store.ts` V2 setter'lar (toggleServiceDomain, toggleProcedure, toggleBrand, toggleDrivetrain, updateServiceArea, setSchedule, updateCapacity) eklendi
- ✅ **[Provider meta]** `technicians/provider-type.ts` — `recommendedDomains` + `recommendedBrandTiers` preset'leri (onboarding coverage adımında preset önerisi için)

**Backend kapsamında execute edilmesi gereken (bu fazda DEĞİL):**

- ⬜ Alembic migration `0010_taxonomy_master` — 6 master tablo + seed (~200 satır taxonomi seed)
- ⬜ Alembic migration `0011_technician_signal_v2` — 9 usta sinyal tablosu + 1 performance snapshot
- ⬜ SQLAlchemy model + repository + service (`app/models/technician_signal.py`, `app/services/technician_signal.py`)
- ⬜ Pydantic schema (`app/schemas/technician.py`)
- ⬜ FastAPI router (`app/api/v1/routes/technician_profile.py` — /me/coverage, /me/service-area, /me/schedule, /me/capacity; `technician_taxonomy.py` — read endpoints with 1h cache)
- ⬜ Admission gate service layer (6 zorunlu alan kontrolü, availability force)
- ⬜ ARQ cron: `recompute_performance_snapshots` (günde 1x, 4 pencere)
- ⬜ GIST circle index (`technician_service_area`) için pgvector veya PostGIS değerlendirmesi

**Frontend kapsamında kalan (frontend dev'in işi — bu sohbet dokunmadı):**

- ⬜ Onboarding 5→7 adım: `app/(onboarding)/coverage.tsx` (YENİ) + `service-area.tsx` (YENİ); `capabilities.tsx` + `certificates.tsx` adım sayacı güncelleme (3/5→5/7, 4/5→6/7); `review.tsx` yeni alan özetleri
- ⬜ ProfileScreen V2 seksiyonlar: "Uzmanlık & hizmetler" (service_domains + procedures + brand + drivetrain chip'leri), "Çalışma saatleri" (compact schedule grid), "Hizmet bölgesi" (map pin preview), yeni "Ekip & kapasite" seksiyonu; legacy specialties/expertise chip'leri kaldırılacak
- ⬜ Yeni shared componentler: `CoverageEditSheet.tsx`, `ServiceAreaPicker.tsx` (map + radius slider + district chip), `ScheduleGrid.tsx` (7-gün open/close), `CapacityEditor.tsx`, `BrandMultiSelect.tsx` (40 marka search)

**Scope boundary gerekçesi:** Frontend UI (yeni ekranlar + yeni componentler) rol memory `role_backend_db_engineer.md` uyarınca frontend dev'in sorumluluğunda. Backend tarafı shared contract (`@naro/domain`) + kontrat köprüsü state layer kırılmayacak şekilde additive eklendi; frontend dev `V2` alanlarını çıkış yolu belli olduğu için UI katmanına serbestçe bağlayabilir.

**Doğrulama:** `pnpm -C packages/domain typecheck` ✓ · `pnpm -C naro-service-app typecheck` ✓ · `pnpm -C naro-service-app lint` ✓ (2 önceden mevcut warning, yeni regresyon yok).

**Kritik gözlem (matching motoru etkisi):** Mevcut `isAvailableInPool` sadece `kind ↔ provider_type` filtresi yapıyor; 7-boyutlu hiyerarşiyi uygulayacak skor fonksiyonu backend'de henüz yok. Bu Faz 8 (matching motoru implementasyonu) için ön-koşul: sinyal tabloları hazır olunca skor fonksiyonu input'a sahip olur.

---

## Doğrulama sonuçları (kapsamlı check)

**Metod**: 3 cepheden doğrulama
- Backend: 21 iddia (kod + canlı DB)
- Mobil: 35 iddia (engine.ts + service-case.ts + transfer grep)
- Migration smoke: up → downgrade base → upgrade head

**Sonuçlar:**
- Migration smoke: ✓ 3 adım yeşil; 15 tablo + 22 FK + ~41 non-PK index korundu
- Backend doğrulama: **17/21** (%81) doğru; 4 düzeltme + 1 ajan-hatalı
- Mobil doğrulama: **33/35** (%94) doğru; 2 düzeltme + 1 **yeni kritik bulgu**
- Toplam: 50/56 (%89) doğru; 5 düzeltme + 1 kritik + 1 ajan yanlış doğrulaması

### Düzeltmeler (karar log metnindeki yanlışlar)

- **[2d düzeltme]** Doc formülasyonu doğru: `02-technician.md:258` tam yazı "`has_identity AND has_tax AND has_trade AND has_insurance AND approved ≥ 5`" — **has_technical YOK**. Kod `technician_kyc.py:33-40` **has_technical de istiyor**. Yani mismatch gerçek ama yön ters: **doc`'ta 4 zorunlu cert** + count=5, **kod'da 5 zorunlu cert** + count=5. Karar "doc'u koda hizala" doğru; metin düzeltildi.

- **[4a/f düzeltme]** `CaseTaskKindSchema` **17 enum** (18 değil): refresh_matching, review_offers, confirm_appointment, review_progress, approve_parts, approve_invoice, confirm_completion, message_service, upload_intake_proof, upload_progress_proof, share_status_update, request_parts_approval, share_invoice, upload_delivery_proof, mark_ready_for_delivery, start_similar_request, open_documents.

- **[8a düzeltme]** `session.commit()` **3 yerde** (sadece 1 değil): `user.py:36` + `media.py:18` + `media.py:33`. Commit disiplini fix kapsamı — 3 noktadan da kaldır, endpoint'e taşı.

- **[12a teyit]** `ix_users_phone` tam unique (partial DEĞİL) — pg_indexes output'u `CREATE UNIQUE INDEX ix_users_phone ON public.users USING btree (phone)` (WHERE yok). Karar log iddiası doğru; doğrulama ajanı hatalı "partial" dedi. Fix-now hotfix kararı geçerli.

- **[11 teyit]** 22 FK ✓ doğrulandı; 41 non-PK index vs toplam 55 (PK+alembic dahil) — hepsi canlı DB'den beklenen.

### 🚨 Yeni kritik bulgu — Mobil ↔ Backend selectOffer semantik mismatch

**[Eksen 1 ek bulgu / Eksen 13 ek bulgu]** karar: fix-now (Faz 7 entegrasyonu öncesi karar ver)

- **Mobil** [engine.ts:2299-2345](packages/mobile-core/src/tracking/engine.ts#L2299) — `selectOfferForCase`:
  - `case.status = "scheduled"` (direkt)
  - `assigned_technician_id = acceptedOffer.technician_id`
  - System message: **"Teklif kabul edildi. Pickup ve ilk kabul hazirliklari icin randevu sahnesine gecildi."**
- **Backend** [services/offer_acceptance.py:49-51](naro-backend/app/services/offer_acceptance.py) — `accept_offer`:
  - `case.status = "appointment_pending"` (randevu talebini bekler)
  - `assigned_technician_id` **set edilmez** (randevu onaylanınca set)

**Etki:** Backend'e bağlandığında mobil UX kırılır — müşteri teklif seçer, "randevu talebi bekliyor" durumunda takılı kalır; mobil engine "scheduled" bekliyor. İki seçenek:

1. **Backend mobile'a uysun**: `accept_offer` içinde otomatik appointment create + approve (slot = offer.available_at_label?) → case.status='scheduled'. Offer içinde slot bilgisi eklenir.
2. **Mobil backend'e uysun**: `selectOfferForCase` `status='appointment_pending'` yapsın; ayrı bir screen'de "randevu talep et" akışı açılsın (müşteri slot seçsin).

Tavsiye: **Seçenek 2** (backend mantığı doğru; müşterinin slot seçme hakkı olmalı). Mobil UX akışı güncellenir.

**Aksiyon:** Faz 7 öncesi ürün kararı + mobil engine refactor; öncelik P0.

### Ajan doğrulama hataları (not)

- Backend ajanı #3 `update_certificate_status` recompute çağırıyor mu? dedi — ajan "çağırıyor" dedi ama gerçek kod çağrı yok → **benim karar log iddiam doğru, ajan hata**. Bu iddia için herhangi bir değişiklik gerekmiyor.
- Backend ajanı #19 partial index tartışmasında yanılmış — benim iddiam doğru, fix-now geçerli.

---

## Eksen 1 — End-to-end case flow

**Bulgular:**
- 18 adımlık kaza-tamamlama senaryosunun **8 adımı** (1-8) backend'de çalışıyor (case + offer + appointment flow)
- **10 adım** (9-18) tamamen mobilde mock — backend'de **14 tablo yok** (milestones/tasks/approvals/line_items/evidence/documents/attachments/threads/messages/message_attachments/events/notification_intents + 2 M:N link)
- Cross-actor sync kırık: usta `addTechnicianEvidenceToCase` yapınca müşteri app'inde `case.evidence_feed[]` mobil state'te; backend'de yok → başka cihazdan görünmez, restart'ta uçar
- Fatura tutarı mobil'de hardcoded mock (`case.total_label`); backend `service_cases.total_amount` kolonu mevcut ama invoice flow'unda hiç güncellenmez
- `case.events[]` mobil engine `appendEvent()` helper'ı ile yazılır; backend'de `case_events` tablosu yok → audit trail server-side yok, KVKK ve ihtilaf için risk

**Kararlar:**

- [1a / Faz 7 bölünmesi] karar: fix-now (planlama)
  gerekçe: Tek-bang V2 hem test hem review için ağır; 4 alt faz (7a core, 7b artifacts, 7c communication, 7d audit+notif) FK bağımlılığı + mantık koheransına uyuyor
  aksiyon: Faz 7a/7b/7c/7d detay plan dosyası — denetim bitince; öncelik P0

- [1b / Mobil tracking engine kalacak mı] karar: keep
  gerekçe: Offline + optimistic UI + transient draft için mobil engine vazgeçilmez; server authoritative olunca engine mutation'ları API call + local merge'e dönüşür, kaldırılmaz
  aksiyon: Refactor Faz 7 sonrası (V2 cleanup); öncelik P2

- [1c / Workflow blueprint DB'de mi] karar: keep (code-only)
  gerekçe: 4 blueprint sabit; DB tablosu overhead; mobil engine + backend `workflow_seed.py` aynı constant'tan okur. Admin panel ile custom blueprint ihtiyacı yok (şu anki scope)
  aksiyon: Faz 7a içinde `app/services/workflow_seed.py` yaz; öncelik P0

- [1d / Fatura total_amount authoritative kaynağı] karar: fix-now
  gerekçe: Şu an mobil hardcoded; fatura paylaşıldığında `case_approvals` insert + `service_cases.total_amount` update atomic olmalı
  aksiyon: Faz 7a `approve_invoice` service'inde `ServiceCase.total_amount = sum(approval.line_items.value)`; öncelik P0

- [1e / Cross-actor sync için event-driven update] karar: defer-v2
  gerekçe: Faz 7 backend tabloları + API eklendiğinde mobil sadece fetch/poll ile senkronize olur; WebSocket/SSE push V2-sonrası
  aksiyon: Faz 7 API endpoint'leri + mobil API integration; öncelik P1 (Faz 7 tüm alt-fazlarında gerekli)

**Ek gap (Eksen 18):**
- **Review/rating domain yok** — mobilde screen de yok, şema da yok. `reviews` tablosu + `ReviewSchema` ayrı V2 faz (Faz 10 — review+campaign).

---

## Eksen 2 — Usta onboarding + KYC

**Bulgular:**
- **Doc ↔ kod premium kuralı uyumsuz**: [02-technician.md:258](docs/veri-modeli/02-technician.md) `has_insurance + count≥5` yeter; [technician_kyc.py:33-40](naro-backend/app/services/technician_kyc.py) hem `has_insurance` hem `has_technical` şart + `count≥5`. Kod daha sıkı — doc'u hizala.
- **`recompute_verified_level` otomatik trigger yok**: [technician.py `update_certificate_status`](naro-backend/app/repositories/technician.py) status set ediyor ama recompute çağırmıyor → admin endpoint eklenince explicit call şart.
- **Availability state machine kod enforce etmiyor**: [02-technician.md:235-240](docs/veri-modeli/02-technician.md) state diagram var, [technician.py `update_availability`](naro-backend/app/repositories/technician.py) direkt `.values(availability=X)` — invalid transition (örn. `busy → available` sırasında iş varken) DB'de geçer. Şu an mobil UI geçersiz seçenek sunmuyor; DB invariant açık.
- **Sertifika expire cron eksik**: [technician.py `list_expiring_certificates`](naro-backend/app/repositories/technician.py) helper var, ARQ worker'da task yok.
- **owner_ref sertifika pattern'i yok**: `technician_certificates.media_asset_id` doğrudan FK; `media_assets.owner_ref` sertifika için set edilmeksizin boş — bu Eksen 6'nın somut örneği (polymorphic owner gereksiz, her domain FK tutuyor zaten).
- **Onboarding → availability bridging**: `create_profile` default `offline`; KYC approved olunca availability otomatik `available` açılmıyor — usta manuel bastığında aktif olur.

**Kararlar:**

- [2a / Availability toggle otomatik mi manuel mi] karar: keep (manuel)
  gerekçe: Usta kontrol sahibi; KYC geçse bile "şu an müsait değilim" hakkı olmalı. Otomatik açmak baştan çevrimiçi görünme zorunluluğu yaratır.
  aksiyon: Admin approve endpoint'inde availability değişmez, sadece `users.approval_status = active` + `approval_status=active` check eklenir; öncelik P2

- [2b / recompute_verified_level trigger stratejisi] karar: fix-now
  gerekçe: Admin approve/reject/expire sonrası verified_level güncellenmezse havuz görünürlüğü yanlışlanır. Explicit call service katmanında (SQLAlchemy event listener implicit ve test edilmesi zor).
  aksiyon: Faz 7 içinde admin-approval endpoint + service `approve_certificate()` → `update_certificate_status()` + `recompute_verified_level()` tek transaction; öncelik P0

- [2c / Cert expire cron] karar: defer-v2
  gerekçe: Helper hazır; cron worker Faz 8 (ARQ tasks domain'i) ile birlikte; şu an manual test yeterli.
  aksiyon: ARQ worker'ında `expire_approved_certificates` daily task (03:00 UTC) + recompute; öncelik P2

- [2d / Doc ↔ kod premium kuralı hizalama] karar: fix-now
  gerekçe: Kod daha sıkı; üretimde kullanılacak kural bu. Doc uzun vadede kaynak referans; karışıklık önlensin.
  aksiyon: [02-technician.md:258-263](docs/veri-modeli/02-technician.md) düzelt — "has_identity AND has_tax AND has_trade AND has_insurance AND has_technical AND approved ≥ 5"; öncelik P1

- [2e / Availability state machine enforce] karar: defer-v2
  gerekçe: Mobil UI invalid transition sunmuyor; DB invariant açık ama pratik saldırı vektörü yok. V2'de service layer'da `set_availability(profile, new)` validate.
  aksiyon: Faz 8 (veya Faz 7a yan-task) `app/services/technician_state.py`; öncelik P2

- [2f / owner_ref sertifika için] karar: skip (Eksen 6'ya devir)
  gerekçe: Sertifika zaten `media_asset_id` FK ile bağlı; owner_ref kullanılmıyor. Tüm polymorphic owner tasarımı Eksen 6'da toplu değerlendirilecek.
  aksiyon: Eksen 6 kararına bağlı; öncelik P1

---

## Eksen 3 — Araç + sahiplik transferi

**Bulgular:**
- [transfer_ownership](naro-backend/app/repositories/vehicle.py#L180-L210): UPDATE eski link `ownership_to=NOW()` + INSERT yeni owner — aynı async session içinde sıralı; caller-scoped transaction ile atomic. Partial unique `uq_active_owner_per_vehicle` concurrent transfer'leri serialize ediyor.
- **Mobil'de transfer/family/driver UI yok** — `naro-app` içinde grep `transfer|ownership|family|driver` boş. `user_vehicle_links.role` CHECK constraint (`owner|driver|family`) kodda duruyor ama fiilen her zaman `owner` kullanılıyor.
- `vehicle.py` repo'da `add_family_driver()` helper var, hiçbir ekran çağırmıyor.
- `service_cases.customer_user_id` RESTRICT doğru — vaka geçmişi korunur. KVKK sil isteği için 30 gün soft grace zinciri V2'de.
- `vehicles.deleted_at` aktif case varsa: FK RESTRICT IntegrityError atar; mobilde soft delete akışı şu an yok (grep `soft.*delete|delete_vehicle` yok).

**Kararlar:**

- [3a / Araç sahipliği transferi ekranı] karar: defer-v2
  gerekçe: `transfer_ownership` helper hazır; use-case şu an müşteri app'inde yok (aileden birine araç devretme). Admin panel V2 veya ileriki sprint.
  aksiyon: V2 Faz 9+ admin panel — transfer endpoint + UI; öncelik P2

- [3b / role='family'/'driver' kullanımı] karar: keep (dead-code olarak)
  gerekçe: DB CHECK + app-level enum var; mobil şu an kullanmıyor ama shared vehicle (aile aracı) use-case'i V2'de açılacak. Kolon silmeye değmez.
  aksiyon: Dokümantasyon notu — "V1: sadece `owner` yazılıyor; `driver/family` V2 bekliyor"; öncelik P2

- [3c / customer_user_id RESTRICT] karar: keep
  gerekçe: Vaka geçmişi korunur; KVKK zinciri 30 gün grace ile (Faz 9/15) çözülecek — o zaman soft delete cascade bir order'la çalışır.
  aksiyon: Eksen 7 (soft delete) + Faz 15 KVKK ile birlikte; öncelik P1

- [3d / vehicles.deleted_at + aktif case UX] karar: defer-v2
  gerekçe: FK RESTRICT DB'de doğru; mobilde soft delete akışı yok zaten. UX: "Bu aracın aktif vakası var, silemezsin" mesajı — ekran yokken anlamsız.
  aksiyon: Mobilde sil akışı eklenirken 409 handler; öncelik P2

- [3e / Plate temporal vs tek satır] karar: keep
  gerekçe: Araç geçmişi (vaka, servis) tek `vehicles.id` üzerinde konsolide edilsin; `user_vehicle_links` sahiplik zamansal ayrı tutuyor.
  aksiyon: —; öncelik n/a

---

## Eksen 4 — Case process katmanı (14 eksik tablo)

**Bulgular:**
- Eksen 1 tablosu 14 tabloyu listeliyor: milestones, tasks, approvals, approval_line_items, evidence_items, documents, attachments, threads, messages, message_attachments, events, notification_intents + 2 M:N (approval_evidence_links, task_evidence_links).
- Hiçbir tablo backend'de yok; mobil şemalar ([packages/domain/src/service-case.ts](packages/domain/src/service-case.ts)) ve engine blueprint'leri ([packages/mobile-core/src/tracking/engine.ts](packages/mobile-core/src/tracking/engine.ts) `buildMilestones/buildTasks`) hazır.
- Workflow blueprint sabit 4 template (damage_insured, damage_uninsured, maintenance_standard, maintenance_major); her biri 5 milestone + status-bağlı task set'i.
- `CaseEvidenceRequirement` task içinde yaşıyor (task.evidence_requirements[] — 5 alan), sorgulanmıyor.
- `CaseThread` 1:1 case; V2'de admin-customer ayrı thread potansiyeli.
- `CaseEvent` append-only audit; mobil type enum 8 değer (submitted, offer_received, technician_selected, status_update, parts_requested, invoice_shared, message, completed).

**Kararlar:**

- [4a / 14 tabloyu 4 alt faza bölme] karar: fix-now (planlama)
  gerekçe: FK bağımlılık + semantik koherans; 7a/7b/7c/7d paralel dev olabilir (sadece 7b, 7a'daki task/approval FK'sına bağlı).
  aksiyon: **Faz 7a** (core): case_milestones + case_tasks + case_approvals + case_approval_line_items + workflow_seed service + blueprint constants; **Faz 7b** (artifacts): case_evidence_items + case_documents + case_attachments + 2 M:N link + media FK wiring; **Faz 7c** (communication): case_threads + case_messages + case_message_attachments; **Faz 7d** (audit+notif): case_events + case_notification_intents + event emission wiring in services. Öncelik P0

- [4b / FK cascade matrisi — case_process] karar: fix-now
  aksiyon: Faz 7 migration'larında şu matris:
  ```
  service_cases → case_milestones           CASCADE
  service_cases → case_tasks                CASCADE
  case_milestones → case_tasks.milestone_id CASCADE (orphan task olmaz)
  service_cases → case_approvals            CASCADE
  case_approvals → case_approval_line_items CASCADE
  users (requested_by) → case_approvals     SET NULL (usta anonymize)
  service_cases → case_evidence_items       CASCADE
  case_tasks → case_evidence_items.task_id  SET NULL (task silinse kanıt kalır)
  case_milestones → case_evidence_items.milestone_id SET NULL
  media_assets → case_evidence_items.media_asset_id  SET NULL (dosya gitse kayıt kalır)
  service_cases → case_documents            CASCADE
  media_assets → case_documents.media_asset_id       SET NULL
  service_cases → case_attachments          CASCADE
  media_assets → case_attachments.media_asset_id     SET NULL
  service_cases → case_threads              CASCADE
  case_threads → case_messages              CASCADE
  users → case_messages.author_user_id      SET NULL (sistem / silinen user)
  case_messages → case_message_attachments  CASCADE
  media_assets → case_message_attachments.media_asset_id CASCADE (ek gitse mesaj da gitsin)
  service_cases → case_events               CASCADE (V2 soft delete + anonymize alternatifi Faz 15)
  users → case_events.actor_user_id         SET NULL
  service_cases → case_notification_intents CASCADE
  case_tasks → case_notification_intents.task_id SET NULL
  case_approvals ↔ case_evidence_items M:N via case_approval_evidence_links — CASCADE her iki taraf
  case_tasks ↔ case_evidence_items M:N via case_task_evidence_links — CASCADE her iki taraf
  ```
  öncelik P0

- [4c / Workflow blueprint seed mechanism] karar: fix-now
  gerekçe: Case create'de milestone+task default'ları otomatik insert olmalı; mobil engine'deki `buildMilestones/buildTasks` template'leri ile birebir.
  aksiyon: **Faz 7a** içinde:
  - `app/services/workflow_seed.py::seed_blueprint(session, case_id, blueprint)` — 4 blueprint için milestone+task constant'larından insert
  - `BLUEPRINT_TEMPLATES: dict[str, BlueprintDef]` — Python constant (code-only, DB tablosu yok [Karar 1c ile tutarlı])
  - `create_case()` sonrası inline call: `await seed_blueprint(session, case.id, case.workflow_blueprint)`
  - Test: her blueprint için 5 milestone + ~10 task insert edildiğini verify et
  öncelik P0

- [4d / evidence_requirements JSONB vs ayrı tablo] karar: keep (JSONB)
  gerekçe: Sadece UI render; sorgu yok. Ayrı tablo overhead. Evidence_requirements list'i task create'de set edilir, task active olunca mobil UI render eder.
  aksiyon: `case_tasks.evidence_requirements JSONB DEFAULT '[]'` — 5 alan ({id, title, kind, required, hint}). Pydantic model tanımla (`CaseEvidenceRequirement`). Öncelik P0

- [4e / case_threads 1:1 vs N:1] karar: keep (1:1 şimdi, N:1 hazır)
  gerekçe: Şu an 1 thread/case yeter; V2'de admin-customer thread eklenirse migration `kind` kolonu ekler + unique `(case_id, kind)` olur.
  aksiyon: **Faz 7c** migration: `case_threads (id, case_id UNIQUE, preview, unread_customer, unread_technician, ...)`. İleride ALTER TABLE drop unique + add kind + add new composite unique. Öncelik P1

- [4f / case_events type enum genişletme] karar: fix-now
  gerekçe: Mobil 8 enum yeterli değil; audit trail 16 event tipi bekliyor (plan eksen 5'e bağlı).
  aksiyon: **Faz 7d** içinde PG enum `case_event_type`:
  ```
  submitted, offer_received, offer_accepted, offer_rejected, offer_withdrawn,
  appointment_requested, appointment_approved, appointment_declined, appointment_cancelled, appointment_expired,
  technician_selected, technician_unassigned,
  status_update, parts_requested, parts_approved, parts_rejected,
  invoice_shared, invoice_approved,
  evidence_added, document_added, message, wait_state_changed,
  completed, cancelled, archived, soft_deleted
  ```
  (26 değer; PG enum ADD VALUE forward-compat). Öncelik P0

- [4g / case_attachments — request_draft'tan normalize stratejisi] karar: fix-now
  gerekçe: Mobil `ServiceRequestDraft.attachments[]` JSONB olarak `request_draft` içinde. Ayrı `case_attachments` tablosu olunca tek kanal (search/filter/media FK).
  aksiyon: Faz 7b'de `create_case()` → `request_draft.attachments` JSONB'den `case_attachments` tablosuna migrate insert. `request_draft` içinde attachments array kalır **read-only snapshot** (immutable tarih). Yeni attachment'lar sadece `case_attachments`'e gider. Öncelik P1

- [4h / case_approvals.requested_by nullable] karar: fix-now
  gerekçe: Usta hesabı silinse (V2 soft delete zinciri) approval kaydı kalmalı; SET NULL lazım. Şu an mobilde `requested_by` string (usta adı) — UUID FK'sıyla değiştir.
  aksiyon: Faz 7a migration: `requested_by UUID REFERENCES users(id) ON DELETE SET NULL` + `requested_by_snapshot_name VARCHAR(255)` (anonymize sonrası gösterim için). Öncelik P1

- [4i / case_events soft-delete vs append-only + retention] karar: keep (append-only)
  gerekçe: Audit trail UPDATE/DELETE'e kapalı; sadece retention cron (Faz 15 KVKK) 2 yıl sonra hard delete.
  aksiyon: Tablo `created_at` dışında hiçbir update sütunu yok; service layer sadece INSERT. Retention job Faz 15. Öncelik P0

---

## Eksen 5 — `case_events` audit tablosu

**Bulgular (Eksen 1 + 4 ile birleşik):**
- Şu an hiçbir service event yazmıyor; mobil `buildNextActionFields + appendEvent()` ile compute.
- `case_events` tablosu tasarımı Eksen 4 [4b + 4f + 4i]'de kararlaştırıldı (append-only, 26 enum type, context JSONB, CASCADE from service_cases, SET NULL from users.actor).
- Event yazma stratejisi kararı [5a] Eksen 4 kapsamında açık: **explicit service call**.

**Kararlar:**

- [5a / Event yazma stratejisi — explicit call] karar: fix-now
  gerekçe: SQLAlchemy `after_update` listener implicit ve test edilmesi zor; outbox pattern overkill. Her service fonksiyonu mutation sonunda `append_event()` çağırır.
  aksiyon: **Faz 7d** içinde:
  ```python
  # app/services/case_events.py
  async def append_event(
      session: AsyncSession,
      case_id: UUID,
      event_type: CaseEventType,
      title: str,
      *,
      body: str | None = None,
      tone: CaseTone = CaseTone.NEUTRAL,
      actor_user_id: UUID | None = None,
      context: dict[str, object] | None = None,
  ) -> CaseEvent
  ```
  Caller örneği:
  ```python
  # case_lifecycle.py::transition_case_status sonunda
  await append_event(session, case_id, CaseEventType.STATUS_UPDATE,
                     f"Durum: {old.value} → {new.value}",
                     actor_user_id=actor, context={"old": old.value, "new": new.value})
  ```
  Öncelik P0

- [5b / context JSONB alanı] karar: fix-now
  gerekçe: old_value/new_value/metadata gibi ek bilgi UI timeline'da "Durum X → Y" render için; sorgulanmaz (UI only).
  aksiyon: `case_events.context JSONB NOT NULL DEFAULT '{}'` — Faz 7d migration; öncelik P0

- [5c / Event retention 2 yıl] karar: defer-v2 (Faz 15)
  gerekçe: KVKK retention policy'siyle birlikte; 2 yıl sonra hard delete (S3 arşiv opsiyonel).
  aksiyon: Faz 15 `kvkk_cleanup.py::delete_old_events` cron; öncelik P2

- [5d / Mobil `case.events[]` ↔ backend sync] karar: fix-now (Faz 7d sonrası)
  gerekçe: Backend case_events tablosu çalışır hale gelince, mobil engine `appendEvent()` mock'u **kalacak** (optimistic UI) ama API fetch event listesini authoritative olarak çeker — merge logic engine içine eklenir.
  aksiyon: Mobil `packages/mobile-core/src/tracking/engine.ts` refactor (V2 cleanup) — backend events API'yi merge eder; öncelik P1

---

## Eksen 6 — MediaAsset polymorphic owner integrity

**Kritik bulgu (plan'da yanlış okunmuş):**
- [media.py:279-296](naro-backend/app/services/media.py#L279) — `owner_ref` **S3 object key türetmek için kullanılıyor**:
  ```
  private/cases/{owner_ref}/{asset_id}/original.{ext}
  private/technicians/{owner_ref}/certificates/{asset_id}/original.{ext}
  public/technicians/{owner_ref}/gallery/{asset_id}/original.{ext}
  public/users/{owner_ref}/avatar/{asset_id}/original.{ext}
  ```
- Yani `owner_ref` DB tarafında FK/integrity için **değil** — S3 layout hierarchy için. `owner_ref` index'i de scan için (bir user/case/technician'a ait asset'leri bul).
- Plan'daki Seçenek D (junction tables) aslında zaten büyük oranda **mevcut yapı**: her domain (`technician_certificates`, `technician_gallery_items`, `technician_profiles.avatar_asset_id/promo_video_asset_id`) kendi `media_asset_id` FK'sını tutuyor. Faz 7b eklenen tablolar (case_evidence_items, case_documents, case_attachments, case_message_attachments) da kendi FK'sını tutacak.
- **Referential integrity:**
  - Var (domain tarafında): FK cascade + SET NULL kuralları ile orphan azaltılıyor
  - Yok (MediaAsset tarafında): bir asset'in "hiçbir domain'e referans edilmediği" garantisi yok → orphan risk (nadiren: create order fail edip domain row yazılmasa)

**Kararlar:**

- [6a / owner_ref kalsın mı] karar: keep
  gerekçe: S3 object key generation için kritik utility; bucket listeleme + prefix-based ACL mantığı owner_ref'e dayanıyor. DB-tarafında integrity zaten her domain'de FK ile sağlanıyor.
  aksiyon: —; öncelik n/a

- [6b / Orphan asset cleanup job] karar: defer-v2
  gerekçe: Nadiren olabilir (fail-partial create); cleanup job riskli veri kaybetmeden grace period ile bulur.
  aksiyon: **Faz 15** (KVKK/retention) içinde weekly cron:
  ```sql
  -- Orphan detect (domain FK'larının hiçbirinde geçmeyen asset)
  SELECT ma.id FROM media_assets ma
  WHERE ma.status = 'ready' AND ma.deleted_at IS NULL
    AND ma.created_at < NOW() - INTERVAL '7 days'  -- grace period
    AND NOT EXISTS (SELECT 1 FROM technician_certificates WHERE media_asset_id = ma.id)
    AND NOT EXISTS (SELECT 1 FROM technician_gallery_items WHERE media_asset_id = ma.id)
    AND NOT EXISTS (SELECT 1 FROM technician_profiles WHERE avatar_asset_id = ma.id OR promo_video_asset_id = ma.id)
    AND NOT EXISTS (SELECT 1 FROM case_evidence_items WHERE media_asset_id = ma.id)
    AND NOT EXISTS (SELECT 1 FROM case_documents WHERE media_asset_id = ma.id)
    AND NOT EXISTS (SELECT 1 FROM case_attachments WHERE media_asset_id = ma.id)
    AND NOT EXISTS (SELECT 1 FROM case_message_attachments WHERE media_asset_id = ma.id);
  -- İşlem: deleted_at = NOW(); 30 gün sonra S3 delete + DB hard delete ikinci cron
  ```
  Öncelik P2

- [6c / owner_ref parse tutarlılığı] karar: keep (uniform)
  gerekçe: Tüm purpose'larda `owner_ref` = ilgili entity'nin UUID string'i (case_id, technician profile_id/user_id, kullanıcı user_id). Kod zaten `_sanitize_path_segment` ile temizliyor.
  aksiyon: Dokümantasyon notu — `09-media-asset.md` yazıldığında "owner_ref = ilgili domain entity UUID" açıkla; öncelik P1 (doc)

- [6d / MediaAsset polymorphic tasarım revizyonu yanlış prem] karar: skip
  gerekçe: Plan'da "owner_ref kırık, redesign şart" yazılmıştı; denetim gösterdi ki owner_ref S3 utility, FK'sız tasarım doğru. Redesign gereksiz.
  aksiyon: Plan dosyasında bu yanlış prem'i düzelt (notka); öncelik P1

---

## Eksen 7 — Soft delete tutarlılığı + KVKK

**Bulgular:**
- **Soft delete sütunu olanlar (deleted_at)**: users, technician_profiles, vehicles, service_cases, media_assets
- **Hard delete (soft yok)**: auth_sessions, otp_codes, technician_capabilities, technician_specialties, technician_certificates, technician_gallery_items, case_offers, appointments, user_vehicle_links
- **Kritik cascade-soft mismatch**: Eksen 11 doğrulamasıyla — `CASCADE user → auth_sessions/technician_profiles/media_assets` var ama user soft delete'te CASCADE trigger'lanmaz (DB hard delete'e bağlı); explicit revoke service şart.
- **KVKK chain yeni bug** (Eksen 11 sonrası): `user_vehicle_links.user_id CASCADE` → user hard delete olunca **araç sahiplik geçmişi uçar**; vehicle geride orphan kalır. Araç başkasına aitse bile tarihsel izler gider. Fix: SET NULL + `user_snapshot_name`.
- `user_vehicle_links`'te `ownership_to` **temporal** zaten — soft delete gereksiz, SET NULL'la yeter.
- Mobil'de "hesabımı sil" akışı **yok** (grep ile doğrulanabilir) — KVKK şu an teorik.

**Kararlar:**

- [7a / Soft delete matrisi standart] karar: keep (mevcut pattern)
  gerekçe: Ana entity soft, alt kayıt hard — doğru. certificates/gallery/specialties hard delete OK (profile soft olunca zaten görünmez; KVKK hard delete job tümünü siler).
  aksiyon: —; öncelik n/a

- [7b / user soft delete → explicit revoke service] karar: fix-now
  gerekçe: CASCADE soft delete'te tetiklenmez; auth_session aktif kalır (güvenlik hatası), technician_profile görünür kalır.
  aksiyon: Faz 7+ **`app/services/user_lifecycle.py`**:
  ```python
  async def soft_delete_user(session, user_id: UUID, reason: str) -> None:
      # 1. users.deleted_at = NOW()
      # 2. Tüm aktif auth_sessions revoke (revoked_at=NOW())
      # 3. varsa technician_profiles.deleted_at = NOW()
      # 4. varsa user.email/phone anonymize (hash+UUID ekle) - unique constraint serbest bırakmak için
      # 5. case_events INSERT (type='soft_deleted')
  ```
  Öncelik P0

- [7c / user_vehicle_links.user_id CASCADE → SET NULL + snapshot] karar: fix-now (KVKK öncesi zorunlu)
  gerekçe: Araç sahiplik geçmişi silinmesin; user hard delete olunca link satırı kalsın ama user_id NULL olsun, snapshot_name audit için görünsün.
  aksiyon: **Faz 15 KVKK** migration:
  ```sql
  ALTER TABLE user_vehicle_links DROP CONSTRAINT user_vehicle_links_user_id_fkey;
  ALTER TABLE user_vehicle_links ALTER COLUMN user_id DROP NOT NULL;
  ALTER TABLE user_vehicle_links ADD CONSTRAINT user_vehicle_links_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE user_vehicle_links ADD COLUMN user_snapshot_name VARCHAR(255);
  ```
  Öncelik P1 (KVKK ile zaman-uyumlu)

- [7d / KVKK hard delete cron] karar: defer-v2
  gerekçe: 30 gün grace sonrası hard delete job; case geçmişi korunur (service_cases.customer_user_id RESTRICT), diğerleri anonymize + hard delete zinciri.
  aksiyon: Faz 15 `app/workers/kvkk_cleanup.py` günlük cron:
  - `users WHERE deleted_at < NOW() - INTERVAL '30 days'` hard delete (CASCADE + SET NULL'lar çalışır)
  - `media_assets WHERE status='deleted' AND deleted_at < NOW() - INTERVAL '30 days'` S3 + DB hard delete
  - `otp_codes WHERE created_at < NOW() - INTERVAL '30 days'` hard delete (zaten plan'da)
  - `auth_sessions WHERE revoked_at < NOW() - INTERVAL '30 days' OR expires_at < NOW() - INTERVAL '30 days'` hard delete
  - `case_events WHERE created_at < NOW() - INTERVAL '2 years'` hard delete (audit retention)
  Öncelik P2

- [7e / Test cascade zinciri] karar: fix-now (V2 başında)
  gerekçe: KVKK silme zinciri test edilmeli; invariant: user soft delete sonrası aktif session yok, profile görünmez, vaka geçmişi duruyor.
  aksiyon: `tests/test_kvkk_cascade.py` — happy path + edge (teknisyen olan user, aktif case'li customer); öncelik P1

---

## Eksen 8 — State machine & atomic transition

**Bulgular:**
- **Commit pattern tutarsız** (P0): [user.py](naro-backend/app/repositories/user.py) class-based, repo içinde `self._db.commit()`. Faz 2-5 repo'ları ([technician/vehicle/case/offer/appointment.py](naro-backend/app/repositories/)) async function + `session.flush()` only; caller commits. Endpoint yazıldığında disiplin kritik.
- [get_db](naro-backend/app/db/session.py#L23) dependency `yield session` — `__aexit__`'te **autocommit yok**; endpoint `await db.commit()` unutursa tüm mutation rollback. `session.commit()` grep tüm kod tabanında **sadece user.py'de** (1 yer).
- [accept_offer](naro-backend/app/services/offer_acceptance.py): `get_offer` + `mark_accepted` + `list_siblings` + `reject_offer` (N kez) + `transition_case_status` → tümü aynı session; atomic. Status check (`offer.status.name not in ("PENDING", "SHORTLISTED")`) → idempotent (ikinci çağrı raise eder).
- [approve_appointment](naro-backend/app/services/appointment_flow.py): `mark_approved` + `ServiceCase.assigned_technician_id` update + `transition_case_status(SCHEDULED)` → atomic; `_get_pending()` PENDING değilse raise → idempotent.
- [case_lifecycle.py::transition_case_status](naro-backend/app/services/case_lifecycle.py): `TERMINAL_STATES = {COMPLETED, CANCELLED}` — ARCHIVED dahil değil → `closed_at` sadece ilk terminal'da set, archive'da dondurur. Plan [8c] ✓.
- Partial unique `uq_active_offer_per_tech_case` (status IN pending/shortlisted/accepted) + `uq_active_appointment_per_case` (status=pending) → concurrent race DB-level serialized.
- **Idempotency-Key header yok** — mobil network retry'da 400/409 atar; mobil client soft-handle etmeli.

**Kararlar:**

- [8a / Commit disiplini: repo mı endpoint mi] karar: fix-now
  gerekçe: `user.py` repo içinde commit, diğerleri endpoint'te — karışıklık. Tercih: **endpoint commits**, repo/service sadece `flush()`. Test edilebilir (test fixture savepoint rollback) + FastAPI dependency idiom.
  aksiyon:
  1. [user.py::UserRepository.create](naro-backend/app/repositories/user.py#L37) içindeki `await self._db.commit()` sil → `await self._db.flush()` + `await self._db.refresh(user)`
  2. Auth endpoint [routes/auth.py::verify_otp](naro-backend/app/api/v1/routes/auth.py#L42) → user create sonrası `await db.commit()` ekle
  3. Faz 7 router yazılırken her write endpoint sonunda `await db.commit()` — test'lerde enforce et
  Öncelik P0

- [8b / Idempotency-Key header] karar: defer-v2
  gerekçe: Şu an mobil retry 400 atar, UI mesajıyla handle edilebilir. Idempotency-Key + Redis cache (24 saat) V2 (API hardening fazında).
  aksiyon: Faz 8+ altyapı (request dedup middleware); öncelik P2

- [8c / closed_at TERMINAL_STATES'e ARCHIVED ekleme] karar: keep (mevcut doğru)
  gerekçe: ARCHIVED dondurulmuş haliyle görünür; closed_at COMPLETED'taki tarih kalır (arşive alınma tarihi ayrı — ihtiyaç olursa `archived_at` kolon eklenir).
  aksiyon: —; öncelik n/a

- [8d / Atomic transaction test harness] karar: fix-now
  gerekçe: offer_acceptance + appointment_flow mevcut kod test edilmemiş (bu fazda test yazılmadı). V2'den önce smoke test zorunlu; partial failure = corrupt state.
  aksiyon: `tests/test_offer_acceptance.py` + `tests/test_appointment_flow.py` — happy + partial exception rollback test'i. Öncelik P0

- [8e / Service exception hierarchy] karar: defer-v2
  gerekçe: `OfferNotFoundError`, `OfferNotAcceptableError`, `AppointmentNotPendingError`, `InvalidTransitionError` ayrı sınıflar — FastAPI exception handler yok (endpoint yazılmadı). Eklenirken 400/409/404 mapping gerekli.
  aksiyon: Faz 7 router yazımında `app/api/errors.py` — domain exception → HTTP response mapping; öncelik P1

- [8f / Partial unique race simulation] karar: defer-v2 (test)
  gerekçe: Konseptten DB-level doğru; ama concurrent retry'ı test edecek pytest harness V2'de.
  aksiyon: `tests/test_concurrency.py` (gevent/thread pool); öncelik P2

---

## Eksen 9 — Pool query + KIND_PROVIDER_MAP

**Bulgular:**
- [list_pool_cases](naro-backend/app/repositories/case.py#L75-L96) filter: `status IN ('matching','offers_ready') AND kind IN (kinds_for_provider(ptype)) AND deleted_at IS NULL`. Sort: `urgency DESC, created_at DESC`. Limit 50.
- **`viewer_user_id` parametresi yok** → assigned_technician_id exclude yok; "zaten teklif vermiş usta" exclude yok.
- Status filter pratik olarak bunu sağlıyor: scheduled+ case'ler assigned_technician_id ile pool dışında; matching/offers_ready'de assigned_technician_id null zaten.
- PG enum ordering (insertion order `'planned','today','urgent'`) → `urgency DESC` → urgent üstte. ✓
- Partial index `ix_cases_pool_feed (status, kind, urgency, created_at DESC) WHERE deleted_at IS NULL AND status IN ('matching','offers_ready')` query predicate'iyle birebir eşleşir. ✓
- `kinds_for_provider(ptype)` ([pool_matching.py](naro-backend/app/services/pool_matching.py)) `KIND_PROVIDER_MAP` tersini hesaplıyor — her provider_type için görülebilecek case kinds.
- **Primary + secondary provider_type birleşimi pool query'sine dahil değil**: teknisyenin `secondary_provider_types[]` array'i provider_type filter'ını genişletmiyor; sadece `primary provider_type`'a göre havuz. Ama Eksen 2'deki `list_active_technicians_for_pool` (teknisyen açısından) secondary'yi `overlap` ile alıyordu — **asimetrik**.

**Kararlar:**

- [9a / assigned_technician_id IS NULL predicate — güvenlik kuşağı] karar: defer-v2
  gerekçe: Status filter pratikte zaten sağlıyor; extra predicate partial index'i bozar. Paranoid güvenlik için V2.
  aksiyon: —; öncelik P2

- [9b / exclude_offered_by opsiyonel parametre] karar: defer-v2
  gerekçe: Mobil UI "zaten teklif verdim" badge — backend join gereksiz yük.
  aksiyon: İhtiyaç gelince `list_pool_cases(..., exclude_offered_by: UUID | None = None)` + LEFT JOIN; öncelik P2

- [9c / Primary + secondary provider_type asimetrisi] karar: fix-now
  gerekçe: Usta "çekici de olabilirim" derse (`secondary_provider_types` array) havuzda çekici case'leri görmeli. Şu an sadece primary ile match — fırsat kaybı.
  aksiyon: `list_pool_cases` imzasını değiştir: `provider_type` tek yerine `list[ProviderType]` al; endpoint'te teknisyen profilinden `[primary] + secondary_provider_types` birleştirip geçir. Test: usta secondary=[cekici] ile towing vakası görür. Öncelik P1

- [9d / urgency enum ordering + partial index eşleşmesi] karar: keep
  gerekçe: PG enum insertion order + partial index match doğru; benchmark V2.
  aksiyon: —; öncelik n/a

---

## Eksen 10 — request_draft JSONB versioning + lift stratejisi

**Bulgular:**
- Mobil `ServiceRequestDraftSchema` (packages/domain/src/service-case.ts:193-227) 30+ alan: kind, vehicle_id, urgency, summary, location_label, dropoff_label, notes, attachments[], symptoms[], maintenance_items[], preferred_window, vehicle_drivable, towing_required, pickup_preference, mileage_km, preferred_technician_id, counterparty_note/vehicle_count, damage_area, valet_requested, report_method, kasko_selected/brand, sigorta_selected/brand, ambulance_contacted, emergency_acknowledged, breakdown_category, on_site_repair, price_preference, maintenance_category, maintenance_tier.
- Backend Pydantic [schemas/case.py::ServiceCaseCreate](naro-backend/app/schemas/case.py) `request_draft: dict[str, object]` — **validate yok**, mobil şemasını mirror etmiyor.
- `ix_cases_request_gin` GIN `jsonb_path_ops` index aktif — `@>` containment sorguları performanslı.
- Top-level zaten olan alanlar: `kind`, `urgency`, `vehicle_id` (snapshot duplicate), `title`, `subtitle`, `summary`, `location_label`, `preferred_technician_id`, `workflow_blueprint`.
- JSONB içinde kalması gereken: snapshot-only alanlar (attachments raw — ama Eksen 4 [4g] ile `case_attachments` tablosuna migrate), kind-spesifik kurucu alanlar (damage_area, counterparty_*, kasko_*, vs.)

**Kararlar:**

- [10a / schema_version field] karar: fix-now
  gerekçe: Forward-compat garantisi — mobil yeni alan eklediğinde backend bilir; migration helper eski sürümü yeni'ye çevirir (lossy olmaz).
  aksiyon: `request_draft.schema_version: "v1"` zorunlu alan; Pydantic model `schema_version: Literal["v1"]` (ileride v2); öncelik P1

- [10b / Top-level'a lift edilecek alanlar] karar: fix-now (Faz 7a sonrası)
  gerekçe: Sık filtrelenen alanlar top-level olarak + partial index; JSONB GIN sorgu OK ama tip güvenliği + Pydantic validation için üstün.
  aksiyon: **Faz 7+ yan migration**:
  ```sql
  ALTER TABLE service_cases
    ADD COLUMN breakdown_category VARCHAR(32),  -- enum veya text (CHECK)
    ADD COLUMN maintenance_category VARCHAR(32),
    ADD COLUMN kasko_selected BOOLEAN DEFAULT FALSE,
    ADD COLUMN towing_required BOOLEAN DEFAULT FALSE,
    ADD COLUMN on_site_repair BOOLEAN DEFAULT FALSE;

  -- Data migration: JSONB'den kopyala
  UPDATE service_cases SET
    breakdown_category = request_draft->>'breakdown_category',
    maintenance_category = request_draft->>'maintenance_category',
    kasko_selected = COALESCE((request_draft->>'kasko_selected')::boolean, FALSE),
    towing_required = COALESCE((request_draft->>'towing_required')::boolean, FALSE),
    on_site_repair = COALESCE((request_draft->>'on_site_repair')::boolean, FALSE);

  -- Index
  CREATE INDEX ix_cases_kasko ON service_cases (kasko_selected) WHERE kasko_selected = TRUE;
  CREATE INDEX ix_cases_on_site ON service_cases (on_site_repair) WHERE on_site_repair = TRUE;
  CREATE INDEX ix_cases_breakdown_cat ON service_cases (breakdown_category) WHERE breakdown_category IS NOT NULL;
  CREATE INDEX ix_cases_maintenance_cat ON service_cases (maintenance_category) WHERE maintenance_category IS NOT NULL;
  ```
  Backend Pydantic `ServiceCaseCreate`'te top-level alanlar da alınır; create'te hem lift kolon hem JSONB'e yazılır (kaynak-ortak). Öncelik P1

- [10c / Pydantic ServiceRequestDraftCreate modeli] karar: fix-now
  gerekçe: `dict[str, object]` güvensiz; backend şu anda `mileage_km: "on bin"` string'i kabul eder. Mobil şemadan 1:1 türet.
  aksiyon: **`app/schemas/service_request.py`** (veya `schemas/case.py`'e ek) — tüm 30+ alan Pydantic model'i; `ServiceCaseCreate.request_draft: ServiceRequestDraftCreate`. Mobil Zod'tan type-codegen otomasyonu Faz 9+. Öncelik P0

- [10d / Backward-compat veri migration] karar: fix-now (lift migration ile birlikte)
  aksiyon: [10b]'deki migration içinde eski satırlar COALESCE + UPDATE ile doldurulur; yeni satırlar Pydantic validate + hem lift kolon hem JSONB'e yazılır (create'te sync). Öncelik P1

- [10e / request_draft.attachments ↔ case_attachments redundancy] karar: fix-now (Eksen 4 [4g] ile tutarlı)
  gerekçe: Eksen 4'te kararlaştırıldı — Faz 7b'de `create_case()` JSONB attachments'ı `case_attachments` tablosuna migrate eder; JSONB içindeki kalır **read-only initial snapshot** olarak.
  aksiyon: Faz 7b; öncelik P1

- [10f / request_draft.vehicle_id duplicate] karar: keep (snapshot)
  gerekçe: Mobil immutable talep snapshot'ı — vehicle_id tarihsel referans olarak kalsın; `service_cases.vehicle_id` mevcut durum.
  aksiyon: —; öncelik n/a

---

## Eksen 11 — FK cascade matrisi

**Bulgular (canlı DB `pg_constraint` sorgu):**
- **22 FK constraint** doğrulandı; hepsi plan matrisiyle birebir uyumlu. Liste:
  ```
  appointments.case_id          → service_cases   CASCADE
  appointments.offer_id         → case_offers     SET NULL
  appointments.technician_id    → users           RESTRICT
  auth_sessions.user_id         → users           CASCADE
  case_offers.case_id           → service_cases   CASCADE
  case_offers.technician_id     → users           CASCADE         ← [11a]
  media_assets.uploaded_by_user_id → users        CASCADE
  service_cases.assigned_technician_id  → users   SET NULL
  service_cases.customer_user_id       → users   RESTRICT
  service_cases.preferred_technician_id → users   SET NULL
  service_cases.vehicle_id             → vehicles RESTRICT
  technician_capabilities.profile_id   → technician_profiles CASCADE
  technician_certificates.media_asset_id → media_assets SET NULL
  technician_certificates.profile_id → technician_profiles   CASCADE
  technician_gallery_items.media_asset_id → media_assets CASCADE
  technician_gallery_items.profile_id     → technician_profiles CASCADE
  technician_profiles.avatar_asset_id     → media_assets SET NULL
  technician_profiles.promo_video_asset_id → media_assets SET NULL
  technician_profiles.user_id             → users CASCADE
  technician_specialties.profile_id       → technician_profiles CASCADE
  user_vehicle_links.user_id              → users CASCADE
  user_vehicle_links.vehicle_id           → vehicles CASCADE
  ```
- Plan'daki `?` işaretli 3 satır (auth_sessions/technician_profiles soft-hard mismatch + case_offers.technician_id) doğrulandı.

**Kararlar:**

- [11a / case_offers.technician_id CASCADE] karar: fix-now
  gerekçe: Usta hard delete path'i V2'de açılırsa (KVKK), teklif kayıtları silinir → vaka tarihi bütünlüğü bozulur. SET NULL + snapshot name audit için yeterli.
  aksiyon: Faz 15 KVKK migration: `ALTER TABLE case_offers DROP CONSTRAINT case_offers_technician_id_fkey, ADD CONSTRAINT ... FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL`; `ADD COLUMN technician_snapshot_name VARCHAR(255)` — user soft delete hook'ta anonymize. Öncelik P1

- [11b / auth_sessions + technician_profiles CASCADE ↔ user soft delete mismatch] karar: fix-now (Eksen 7 [7b] ile birlikte)
  gerekçe: User soft delete olunca CASCADE trigger'lanmaz (DB-level hard delete'e bağlı). Explicit service: `soft_delete_user()` → revoke tüm auth_sessions + soft delete technician_profile. Bkz [7b].
  aksiyon: Faz 7 içinde `app/services/user_lifecycle.py::soft_delete_user(user_id)` — sessions revoke + profile soft delete zinciri; öncelik P0

- [11c / V2 case_process FK matris] karar: fix-now (Faz 7 migration'larında)
  aksiyon: Eksen 4 [4b] matrisi referans; öncelik P0

- [11d / Migration smoke test] karar: fix-now
  gerekçe: FK matris denetim bitti; `alembic upgrade head && downgrade base && upgrade head` bir kez daha çalıştır ki baseline sağlam.
  aksiyon: Denetim sonunda verification smoke; öncelik P0 (execution)

---

## Eksen 12 — Index + query performansı

**Bulgular (canlı DB `pg_indexes`):**
- 41 index (btree 29, GIN 5, diğer uniqueler) — tüm hot path'ler karşılanıyor:
  - Pool feed: `ix_cases_pool_feed` partial ✓
  - Ustanın işleri: `ix_cases_assigned_tech` + `ix_cases_preferred_tech` partial ✓
  - Müşteri geçmişi: `ix_cases_customer` partial ✓
  - Plaka: `ix_vehicles_plate_trgm` GIN + `ix_vehicles_vin` partial ✓
  - OTP rate limit: `ix_otp_codes_phone_created` composite ✓
  - Active session: `uq_auth_sessions_refresh_token_hash` + `ix_auth_sessions_expires_at_active` partial ✓
  - JSONB filter: `ix_cases_request_gin` GIN jsonb_path_ops ✓

**Bug 1 (P0) — `ix_users_phone` + `ix_users_email` partial değil:**
- Mevcut DB: `CREATE UNIQUE INDEX ix_users_phone ON public.users USING btree (phone)` — **tam unique**
- Doc ([01-identity.md:31](docs/veri-modeli/01-identity.md)): `CREATE UNIQUE INDEX uq_users_phone ON users (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL` — **partial**
- Etki: KVKK soft delete sonrası aynı numarayla yeniden kayıt `IntegrityError`; doc-kod mismatch.

**Bug 2 (P2) — `ix_users_role_status` eksik:**
- Admin panel "aktif teknisyenler listesi" sorgusu full table scan yapar.
- Doc [01-identity.md:33](docs/veri-modeli/01-identity.md) ve 200 satırında "Aktif teknisyenler listesi" query reference var.

**Kararlar:**

- [12a / Partial unique `ix_users_phone/email` fix] karar: fix-now
  gerekçe: KVKK senaryosu broken; user soft delete sonrası rekod'un geri dönememesi ciddi bug.
  aksiyon: **Yeni migration** (Faz 7 ile veya ayrı hotfix):
  ```sql
  DROP INDEX ix_users_phone;
  CREATE UNIQUE INDEX uq_users_phone ON users (phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;
  DROP INDEX ix_users_email;
  CREATE UNIQUE INDEX uq_users_email ON users (email)
    WHERE email IS NOT NULL AND deleted_at IS NULL;
  ```
  Model tarafı SQLAlchemy `unique=True` yerine explicit `__table_args__ = (Index('uq_users_phone', 'phone', unique=True, postgresql_where=...))`.
  Öncelik P0 (data integrity)

- [12b / `ix_users_role_status` ekle] karar: fix-now
  aksiyon: `CREATE INDEX ix_users_role_status ON users (role, status) WHERE deleted_at IS NULL;` — admin teknisyen listesi için. Öncelik P2 (kullanıcı sayısı büyüyünce kritik)

- [12c / Composite GIN `(kind, request_draft->'breakdown_category')`] karar: defer-v2
  gerekçe: Şu an JSONB GIN yeterli; kind-spesifik kombine sorgu sıklığı düşük. Benchmark sonrası karar.
  aksiyon: Faz 10+ analytics pipeline sırasında; öncelik P2

- [12d / EXPLAIN ANALYZE benchmark harness] karar: defer-v2
  gerekçe: Mock data'yla şu an anlamsız; production-scale veri yüklendikten sonra (V2'nin başlarında).
  aksiyon: `tests/test_query_performance.py` — hot path EXPLAIN beklenen scan tipini assert eder; öncelik P2

---

## Eksen 13 — Mobil ↔ Backend kontrat (computed vs authoritative)

**Bulgular:**
- **Authoritative (backend kaynak)**: status, enum değerleri, UUID'ler, Decimal (amount, total_amount, estimate_amount, eta_minutes), timestamp (UTC), FK.
- **Computed (mobil sadece)**: `next_action_title/description/primary_label/secondary_label`, `allowed_actions[]`, `created_at_label`, `updated_at_label`, `price_label`, `eta_label`, `total_label`, `estimate_label`, `wait_state.label/description` (wait_state.actor authoritative ama label mobil format eder).
- Backend Pydantic response şemaları (örn. [ServiceCaseResponse](naro-backend/app/schemas/case.py)) sadece authoritative alanları döner — label yok. ✓ Doğru.
- Timezone: backend `DateTime(timezone=True)` UTC stored; mobil `toLocaleDateString("tr-TR")` render. ✓

**Kararlar:**

- [13a / API response = sadece authoritative] karar: keep
  gerekçe: Mevcut Pydantic response schema'lar zaten computed alan döndürmüyor; mobil i18n + locale kendi işler.
  aksiyon: —; öncelik n/a

- [13b / allowed_actions mobil-only] karar: keep
  gerekçe: Mobil [`allowedActionsForStatus`](packages/mobile-core/src/tracking/engine.ts) ile status + context'ten türet; backend `case_lifecycle.ALLOWED_TRANSITIONS` status→status transition için (audit), action UI mapping değil.
  aksiyon: —; öncelik n/a

- [13c / Timezone backend UTC + mobil TR] karar: keep
  aksiyon: `docs/mobil-kontrat.md`'de (yeni dosya) not düş; öncelik P2

- [13d / docs/mobil-kontrat.md dokümanı] karar: fix-now
  gerekçe: Yeni developer'ın "hangi alan kimin?" sorusuna yanıt; backend-mobil senkron yanlış-anlamalarının önünde bariyer.
  aksiyon: **`docs/mobil-kontrat.md`** iskeleti — bölümler:
  - `## Authoritative (backend kaynak)` — liste
  - `## Computed (mobil türev)` — liste + nerede compute
  - `## Immutable snapshot (JSONB)` — request_draft yapısı
  - `## API response conventions` — Decimal döner, label dönmez; TZ UTC; currency ISO code
  - `## Version compatibility` — schema_version; graceful degrade
  Öncelik P1

- [13e / Engine tracking refactor (post V2)] karar: defer-v2
  gerekçe: Eksen 1 [1b]'de keep karar alındı; backend Faz 7 bitince engine mutation'lar API çağrıları + local merge'e dönüşür.
  aksiyon: Faz 10+ mobil refactor; öncelik P2

---

## Özet — Gap backlog (öncelik sıralı)

### P0 — Data integrity / güvenlik (hotfix veya Faz 7 başı)

| # | Karar | Eksen | Tablo/alan | Etki |
|---|---|---|---|---|
| 1 | `ix_users_phone/email` tam unique → **partial unique** (WHERE deleted_at IS NULL) | 12a | users | KVKK soft delete sonrası aynı numarayla kayıt IntegrityError atıyor — bug |
| 2 | `user_lifecycle.py::soft_delete_user` service yaz | 7b / 11b | auth_sessions revoke + technician_profiles soft | User soft delete'te oturum açık kalmıyor artık |
| 3 | Commit disiplini: repo flush-only, endpoint commit; `user.py::create` içindeki commit kaldır | 8a | user.py + auth.py route | Faz 7 endpoint'leri yazıldığında write mutation'ları rollback olmasın |
| 4 | Atomic transition test harness (offer_acceptance + appointment_flow) | 8d | tests/ | Partial failure = corrupt state riskinin önünde güvence |
| 5 | `recompute_verified_level` admin approve endpoint'inde inline çağır | 2b | technician_kyc + admin endpoint | KYC sertifika approve sonrası verified_level yanlış kalmaz |
| 6 | Pydantic `ServiceRequestDraftCreate` modeli — dict yerine tipli | 10c | schemas/service_request.py | request_draft'ta `mileage_km="on bin"` gibi hatalı veri reddedilir |
| 7 | Faz 7a/7b/7c/7d case_process 14 tablo + workflow_seed + append_event | 1a, 4a-i, 5a-b | Yeni tablolar | Vaka süreci evrakları DB'de tutulur — uçtan uca çözüm |

### P1 — Use-case engelleyici (Faz 7-8)

| # | Karar | Eksen | Tablo/alan |
|---|---|---|---|
| 8 | `list_pool_cases` primary+secondary provider_type birleşimi | 9c | repositories/case.py |
| 9 | Doc `02-technician.md` premium kuralı koda hizala (has_technical zorunlu) | 2d | docs/veri-modeli/02-technician.md |
| 10 | Fatura total_amount = sum(line_items) authoritative backend | 1d | approve_invoice service |
| 11 | `schema_version` alanı + top-level lift (breakdown_category, maintenance_category, kasko_selected, towing_required, on_site_repair) | 10a, 10b | service_cases + migration |
| 12 | `request_draft.attachments` → `case_attachments` tablosuna migrate (create'te) | 4g, 10e | Faz 7b |
| 13 | `docs/mobil-kontrat.md` yaz (authoritative vs computed) | 13d | docs/ |
| 14 | Service exception → HTTP error mapping `app/api/errors.py` | 8e | api layer |
| 15 | KVKK cascade test harness | 7e | tests/test_kvkk_cascade.py |

### P2 — Nice-to-have (V2 Faz 8+)

| # | Karar | Eksen |
|---|---|---|
| 16 | Availability state machine service enforce | 2e |
| 17 | Cert expire daily ARQ cron | 2c |
| 18 | `ix_users_role_status` partial composite | 12b |
| 19 | Idempotency-Key header + Redis cache | 8b |
| 20 | Araç transfer admin panel | 3a |
| 21 | MediaAsset orphan cleanup cron (weekly) | 6b |
| 22 | KVKK hard delete cron (users 30 gün, events 2 yıl) | 7d |
| 23 | `user_vehicle_links.user_id` SET NULL + snapshot | 7c (Faz 15) |
| 24 | `case_offers.technician_id` SET NULL + snapshot | 11a (Faz 15) |
| 25 | `list_pool_cases` `assigned_technician_id IS NULL` güvenlik kuşağı | 9a |
| 26 | `exclude_offered_by` pool opt-in parametre | 9b |
| 27 | JSONB kind-spesifik composite GIN | 10c |
| 28 | EXPLAIN ANALYZE benchmark harness | 12d |
| 29 | Idempotency: mobil retry race tests | 8f |
| 30 | Engine tracking refactor (backend authoritative sonrası) | 13e, 1b |

### Defer kararları — Faz sırası

- **Faz 7a (core)**: backlog #7 (milestones, tasks, approvals, line_items, workflow_seed) + #1 (partial unique hotfix) + #3 (commit disiplini) + #4 (test harness) + #5 (KYC recompute endpoint) + #6 (Pydantic validate) = **7 P0 bulgusu kapatılır**
- **Faz 7b (artifacts)**: evidence + document + attachment + media FK wiring + #12 migration
- **Faz 7c (communication)**: thread + messages + message_attachments
- **Faz 7d (audit+notif)**: case_events + notification_intents + #2 user_lifecycle + #14 api errors
- **Faz 8 (admin + search)**: #8 pool secondary + #9 doc hizala + #10 invoice authoritative + #11 lift migration + #13 mobil-kontrat.md + #15 KVKK test
- **Faz 15 (KVKK + retention)**: #22 hard delete cron + #23 SET NULL vehicle links + #24 SET NULL offers + #21 media cleanup

## Denetim sonu smoke (verification)

Komut: `alembic upgrade head && alembic downgrade base && alembic upgrade head`
Beklenen: 3 adım da yeşil; 15 tablo + 41 index baseline korunuyor.

Kullanıcının asıl sorusunun cevabı:

> **"Bir kullanıcının aracının bir vakasına atanmış bir usta ile süreç başladıktan sonra oluşan evraklar nasıl tutuluyor?"**
>
> **Şu an**: 18 adımlık akışın **9-18 arası (kanıt/belge/onay/mesaj/fatura/audit/yorum)** backend'de **hiç tutulmuyor** — mobil tracking engine memory'de compute ediyor ve app restart'ta uçuyor. Cross-actor senkron yok.
>
> **Çözüm**: Faz 7a/7b/7c/7d (14 tablo + 2 M:N) ile case_process katmanı kurulur. Sonra mobil engine API sync + optimistic merge'e dönüşür. Denetim bittiğinde Faz 7 implementation planı için tüm tasarım kararları (tablo şeması, FK cascade, enum'lar, workflow seed, event emission, schema validation) hazır.
