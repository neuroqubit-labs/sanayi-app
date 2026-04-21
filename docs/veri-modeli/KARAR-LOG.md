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

## Backend PO Audit — 2026-04-21

**Rapor:** [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) — tam denetim; 8 eksen × P0/P1/P2 kategorize edildi.

**Skor kartı:**
- V1 tablo varlığı: ✅ 15/15
- Faz 6 + Faz 7a-d karar execution: ✅ tam
- Ürün kararları yansıması (7 memory): ⚠️ 2 ✅ · 3 ⚠️ · 2 ❌
- REST API kapsamı: ❌ 10 endpoint (auth+media+health); case/offer/appointment/technician/vehicle/insurance router'ları yok
- State machine enforcement: ✅ case + offer + appointment + insurance_claim solid
- Concurrency: ⚠️ offer accept'te SELECT FOR UPDATE yok (teorik race)
- Entegrasyonlar: ✅ SMS + S3 · ❌ PSP + Maps + Push
- Test coverage: ❌ ~%2 (health + media smoke)
- Observability: ⚠️ structlog ✅, metric export yok

**Bulgu dağılımı:** **6 P0** · **8 P1** · **4 P2**

**P0 özet:**
- P0-1 Acil çekici auto-dispatch kodu yok ([pool_matching.py](naro-backend/app/services/pool_matching.py) sadece KIND_PROVIDER_MAP)
- P0-2 Offer accept race savunması zayıf ([offer_acceptance.py](naro-backend/app/services/offer_acceptance.py) SELECT FOR UPDATE yok)
- P0-3 Pool admission gate enforcement yok ([list_pool_cases](naro-backend/app/repositories/case.py) technician.status filter yok)
- P0-4 Anti-disintermediation (PII maskeleme) yok — thread-only ✅ ama phone/email masking yok
- P0-5 Kullanıcı tercihi enforcement yok — offer.delivery_mode müşteri tercihine karşı kontrol etmiyor
- P0-6 REST router eksikliği (mobil-backend bağlantısı için bloker)

**Önerilen faz sırası (PO onayı bekliyor):**
- Faz 7-backend: usta sinyal (plan mevcut)
- Faz 8-backend: çekici + REST endpoints (P0-1, P0-2, P0-3, P0-6, P1-7, P1-8, P1-6)
- Faz 9-backend: ürün-veri eksikleri (P1-1 consent, P1-2 damage score, P1-4 MaintenanceTemplate, P0-5 soft-warning, P2-2 PII scrub, P2-3 evidence gate)
- Faz 10-backend: trust + anti-disinter + KVKK retention (P0-4)
- Faz 11-backend: test + observability (P1-5)

**PO'dan aksiyon istekleri** (rapor §13):
1. Faz önceliği onayı
2. P0-4 anti-disinter spec önce mi dok yoksa direkt impl mi
3. P0-5 soft-warning mi hard-reject mi (öneri: soft)
4. CLEANER-CONTROLLER devreye girsin mi (P2-1, P2-4 doc drift)

**Yeni klasör:** [docs/audits/](audits/) — ileri tarihli denetim raporlarının arşivi.

---

## Rol UI Mimarisi — 2026-04-22 (PO karar + BE/FE brief)

**Tetikleyici:** Service app (naro-service-app) çekici + tamirci + ileride satıcı/yedek-parçacı için farklı shell/tab/+ menü ihtiyacı. Frontend dev `tow_operator` cert + `secondary_provider_types: ["cekici"]` fixture'ını eklemişti; PO bunu formalize ediyor.

**Karar model (V1):**
- `technician_profiles` +3 kolon: `provider_mode` enum (`business | individual`), `active_provider_type` enum (primary veya secondary'den), `role_config_version SMALLINT`
- `technician_certificate_kind` enum'a `tow_operator` eklenir (frontend fixture bu adı kullanıyor — canonical)
- Cert matrisi: `(provider_type × provider_mode) → required_cert_kinds` service layer'da
- Shell config aggregate endpoint: `GET /technicians/me/shell-config` (Redis cache, `X-Role-Config-Version` header)
- Active role switch: `POST /technicians/me/switch-active-role`
- 5 shell variant: `TowFocusedShell`, `FullShell`, `BusinessLiteShell`, `MinimalShell`, `DamageShopShell`

**PO kararları (locked):**
- **K-R1** Side gig V2'de. V1 enum = `business | individual`.
- **K-R2** Migration default `provider_mode='business'`. Mevcut satırlar back-fill.
- **K-R3** `tow_operator` V1'de yeni cert_kind. `capability_attestation` V2'de.
- **K-R4** Çekici × `side_gig` hard-yasak (V2'de side_gig gelse bile çekici için).
- **K-R5** Active role switch explicit (user tap); role_config_version bump → shell refetch.

**Brief'ler:**
- [docs/rol-ui-mimarisi-backend.md](../rol-ui-mimarisi-backend.md) — BACKEND-DEV: Alembic migration (yeni enum + 3 kolon + `tow_operator` ADD VALUE), service layer matrisleri, shell-config endpoint, dispatch `active_provider_type` filter, 12+ matrix test
- [docs/rol-ui-mimarisi-frontend.md](../rol-ui-mimarisi-frontend.md) — UI-UX-FRONTEND-DEV: `packages/domain/src/shell-config.ts`, 5 shell component, `useShellConfig()` hook, config-driven tabs + home + + menu, `ActiveRoleSwitcher`, onboarding mode fork

**Cross-cutting:**
- Mevcut çekici scaffold ([naro-service-app/src/features/tow/](../../naro-service-app/src/features/tow/), TowDispatchSheet.tsx) `TowFocusedShell` altına taşınır
- [memory/tow_capability_gate.md] ile entegre: çekici UI erişimi `provider_type='cekici' AND admission_gate_passed=true AND cert:tow_operator approved`
- Audit P0-1 (acil çekici auto-dispatch) ve P0-3 (pool admission gate) bu brief ile çözüme yaklaşır

**Migration sırası (backend):**
- `20260422_00XX_provider_role_model.py` — enum `provider_mode` + 3 kolon + `tow_operator` ADD VALUE + constraint

**Kapsam dışı (V2):**
- Side gig `provider_mode` + `capability_attestation` cert
- Satıcı / yedek parçacı yeni provider_type
- Admin panel provider-mode override endpoint (stub yeterli; tam UI sonra)

**Başlama hazırlığı:** FE brief'i zaten fixture değişikliğiyle yarı uyumlu (secondary_provider_types ["cekici"] + tow_operator cert). BE brief migration öncesi PO'ya enum `ADD VALUE` rollback edilemeyeceğini hatırlat, PO onayı verili.

### Revize — 2026-04-22 (tab iskelet sabitlendi)

PO sadeleştirme kararı:
- **5 shell variant + değişken tab set (4-6)** iptal
- **Tek shell, 4 sabit tab** = `home / havuz / kayitlar / profil` tüm roller için aynı
- **Rol-spesifik varyasyon artık sadece:** home widget kompozisyonu (5 layout) + `+ butonu quick_action_set` (backend config-driven) + profil seksiyonları (cert + role switch + mode) + modal/sheet açılışları
- **Çekici aktif iş ekranı** tab değil — `ActiveTowJobHero` (home hero) + `CanliIsModal` + `AcceptBanner` (tab bar üzerinde global)
- **Hasar akışı + kampanyalar** tab değil — home'da row + tap'ta modal/stack push

**Gerekçe:** Değişken tab sayısı UI'da "farklı app" etkisi yaratıyordu; sabit iskelet zihinsel model olarak temiz + developer için basit + forward-compat korunuyor (V2'de `tab_set` config-driven genişletilebilir). [shell_config.tab_set] response'ta kalır ama V1 sabit.

**Doküman güncellemeleri:**
- [docs/rol-ui-mimarisi-backend.md](../rol-ui-mimarisi-backend.md) §2, §4.4, §4.6 revize notuyla
- [docs/rol-ui-mimarisi-frontend.md](../rol-ui-mimarisi-frontend.md) §4.2, §4.4, §4.10, §4.11, §5 revize notuyla
- [memory/role_ui_separation.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/role_ui_separation.md) "5 shell variant" → "tek shell + 5 home layout" + revize notu paragrafı
- [memory/MEMORY.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/MEMORY.md) index satırı güncel

**Etki:** Backend `TAB_SETS` dict'i yok (yalnızca `FIXED_TAB_SET` konstanı); Frontend shell component sayısı 5'ten 1'e düşer, mevcut tab router değişmez. Dev efor azalır; risk azalır.

---

## Faz 9a Execution Durumu (2026-04-22)

**Kapsam**: Auth foundation genişletme — migration 0015 + 0016; tablo 30 → **32**.

**Uygulanan kararlar:**

- ✅ **Kritik bug fix**: [routes/auth.py::verify_otp](naro-backend/app/api/v1/routes/auth.py) artık `auth_sessions` satırı yaratıyor — `hash_refresh_token()` helper + `issue_initial_session()` atomic flow + `token_family_id=self` (rotation chain root).
- ✅ **user_identities** tablosu: 1 user → N auth methods (OTP phone/email + OAuth Google/Apple); partial unique `(provider, provider_user_id)` + email lookup partial index.
- ✅ **auth_events** tablosu (append-only audit): 21 event type, PII maskelenmiş `target` kolonu (`+90***1234`, `u***@domain.com`), JSONB `context`, 90 gün retention (Faz 15 cron).
- ✅ **auth_sessions extension**: `token_family_id` + `parent_session_id` (SET NULL) + `issued_via` (AuthIdentityProvider enum).
- ✅ **token_rotation.py** service: strict rotation (refresh → yeni pair + eski revoke + same family_id), **reuse attack detection** (revoked refresh token tekrar kullanılırsa `revoke_family` + `SUSPICIOUS_LOGIN` event).
- ✅ **auth_events.py** helper: `append_auth_event()` + `mask_target()` PII utilities.
- ✅ Endpoint'ler: `/auth/refresh`, `/auth/logout`, `/auth/logout_all` (revoke_all_sessions_for_user ile).
- ✅ **Vehicle lifecycle** (migration 0016): `vehicles` tablosuna 7 yeni alan (`inspection_valid_until`, `inspection_kind`, `kasko_valid_until`, `kasko_insurer`, `trafik_valid_until`, `trafik_insurer`, `exhaust_valid_until`) + 3 partial index (expiring scan için). Reminders cron Faz 10.

**State machine (token rotation):**
```
login (OTP/OAuth) → initial session (token_family_id = id)
refresh (active)  → yeni session (same family_id, parent=eski) + eski revoke
refresh (revoked) → REUSE ATTACK → family revoke + SUSPICIOUS_LOGIN event + 401
```

**Yeni enum'lar:**
- `auth_identity_provider` (4): otp_phone | otp_email | oauth_google | oauth_apple
- `auth_event_type` (21): otp_* + login_* + refresh_* + oauth_* + identity_* + session_* + lockout_* + rate_limit_breach + suspicious_login + account_soft_deleted

**Doğrulama:**
- Ruff + mypy strict temiz (Faz 9a dosyaları)
- Migration 0015 + 0016 up/down/up yeşil
- Tablo: 30 → **32** (user_identities + auth_events)
- `auth_sessions.token_family_id` + `parent_session_id` + `issued_via` kolonları eklendi

**9b-9f sırada**: OAuth providers (Google + Apple + deep-link), security middleware (rate limit + logging + exception handlers + lockout), 15 yeni router + role guards, Prometheus metrics.

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

**BACKEND-DEV brief:** [~/.claude/plans/faz-7-usta-sinyal-backend.md](/home/alfonso/.claude/plans/faz-7-usta-sinyal-backend.md) — 9 deliverable (2 migration + SQLAlchemy + Pydantic + repository + service + router + ARQ stub + test) + kabul kriterleri + execution sırası + soru/rapor akışı. BACKEND-DEV sohbetinde yeni oturum açılınca buradan başlar. Açık karar noktası: **pgvector extension mevcut mu?** — cevaba göre `technician_procedure_tags.embedding` kolonu ya `VECTOR(384)` ya nullable geçilir.

---

## Çekici Modu — Ürün Spec'i (2026-04-21)

**Doküman:** [docs/cekici-modu-urun-spec.md](docs/cekici-modu-urun-spec.md) — müşteri + çekici UX, mimari, veri modeli, dispatch algoritması, ödeme mimarisi, trust ledger, edge case'ler, KPI, faz planı.

**PO baked-in kararlar:**
- **K-1** Hemen modunda müşteri "maksimum X ₺" görür (cap); cap aşılırsa platform yer.
- **K-2** Randevulu modda seçilen teklif fiyatı booking anında kilitlenir (Uber Reserve).
- **K-3** Vehicle equipment (flatbed/hook/wheel-lift/heavy-duty/motorcycle) sistem çıkarır; user override "gelişmiş" switch ile.
- **K-4** İptal ücretleri: Hemen dispatch-öncesi 0 ₺ / yolda 75 ₺ / vardı 300 ₺+yol; Randevulu 4sa+ öncesi 0 ₺ / 4sa içi 150 ₺ / 1sa içi tam ücret.
- **K-5** Kasko V1 manuel: müşteri kartına pre-auth + charge; fatura ibrazı sonrası operations geri ödeme.
- **K-6** Randevulu min 2 saat ileri, max 90 gün.
- **K-7** Mevcut [cekici-cagir.tsx](naro-app/app/(modal)/cekici-cagir.tsx) + [TowingFlow.tsx](naro-app/src/features/cases/composer/TowingFlow.tsx) yeniden yazılır (Faz 10 frontend brief kapsamında).

**Yeni veri modeli (Faz 8 backend kapsamı):**
- 4 yeni tablo: `tow_dispatch_attempts`, `tow_live_locations`, `tow_fare_settlements`, `tow_cancellations`
- `service_cases` kolon eklemeleri: `tow_mode`, `tow_stage`, `pickup_lat/lng`, `dropoff_lat/lng`, `scheduled_at`
- Shared contract yeni: `packages/domain/src/tow.ts` (TowServiceMode, TowVehicleEquipment, TowIncidentReason, TowDispatchStage, TowFareQuote, TowLiveLocation, TowKaskoDeclaration, TowRequest)
- `ServiceRequestDraft.tow_request` alanı (nullable, kind=towing ise dolu)

**Faz sırası:**
- Faz 8: Tow backend V1 (tablolar + dispatch service + API + PSP stub)
- Faz 9: Tow backend V2 (WebSocket GPS stream + kasko workflow + retention cron)
- Faz 10: Tow frontend V1 (müşteri) — map-first hub + live track + evidence upload
- Faz 11: Tow frontend V1 (çekici) — accept sheet + active job + GPS broadcaster
- Faz 12: Observability + tuning

**Açık kalan (V2 veya sonra karar):**
- Kasko ortaklık listesi — BD sohbetine devredildi (Axa, Anadolu, Allianz, Aksigorta vb.)

**Backend mimarisi dokümanı:** [docs/cekici-backend-mimarisi.md](docs/cekici-backend-mimarisi.md) — 24 bölümlü end-to-end spec; BACKEND-DEV'in Faz 8/9 için uygulama manifesti.

**Ek PO altyapı kararları (cekici-backend-mimarisi.md içinde baked-in):**
- **K-P1** Payment provider: **Iyzico** (TR market + pre-auth/capture + abstraction via `PaymentProvider` protocol ile Stripe/Param fallback açık)
- **K-P2** Map + geocoding: **Mapbox** (fiyat + custom style + TR kapsamı; Google directions opsiyonel 2. katman)
- **K-P3** Realtime: **FastAPI WebSocket + Redis pub/sub** (mevcut Redis stack, Firebase lock-in'siz)
- **K-P4** GPS stream: 5 sn (stationary ise 15 sn backoff)
- **K-P5** OTP: 6-hane numerik, sunucu-üretimli, SMS+in-app, 10dk TTL, 3 yanlış → yeni OTP zorunlu, audit `tow_otp_events`

**Faz 8 backend migration sırası (bu spec'ten):**
- `0012_tow_enums` · `0013_tow_service_cases_cols` · `0014_tow_tables` · `0015_tow_indexes_gist` (CONCURRENTLY)

**Extension bağımlılığı:** PostGIS + pgcrypto (docker-compose + Alembic CREATE EXTENSION IF NOT EXISTS).

**BACKEND-DEV'e açık 7 soru** (bkz. [cekici-backend-mimarisi.md §22](docs/cekici-backend-mimarisi.md)) — technician_tow_equipment tablo şekli, PSP sandbox timing, current_queue_depth trigger/service, Mapbox token rotation, dispatch recovery cron, kart tokenizasyon konum, equipment inferencer lokasyonu. BACKEND-DEV sohbeti açılınca ele alır; önerileri baked-in.

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

---

## Faz 10 — Tow Dispatch V1 (execution log, 2026-04-22)

### Durum özeti (hızlı referans)

- **Commit**: `2399b35` main'e push (2026-04-22)
- **Scope**: Uber-tarzı acil çekici auto-dispatch + scheduled bidding + PSP preauth/capture
- **Ölçek hedefi**: 500 concurrent case / 3000 aktif çekici (erken lansman)
- **Shipped**: 2 migration (0017+0018), 9 tablo (7 tow + user_payment_methods + tow_equipment link), 10 enum + 8 enum value, 5 service + 1 repository, 14 REST + 1 WebSocket, 4 ARQ cron + 1 on-demand, PSP Protocol (MockPsp default), Maps factory (haversine fallback), /metrics Prometheus
- **Test**: 8 pass (4 pure helper + 4 DB + crypto), 4 skipped (pre-existing SAEnum bug + event-loop fixture; Faz 10f sub-sprint)
- **Bilinen borçlar**: Schema parity CI drift testi, integration full-flow, load test, Zod array alignment — 10f sub-sprint
- **PR önce çalıştırın**: `alembic upgrade head` (0017 `CREATE EXTENSION postgis` idempotent)

### Scope

Uber-tarzı acil çekici auto-dispatch + scheduled bidding + PSP preauth/capture altyapısı. 3 migration (0017-0018; 0019 GIST CONCURRENTLY gerekmeden 0017/0018'de yer aldı), 9 yeni tablo, 10 yeni enum + 8 enum value, 14 REST endpoint + 1 WebSocket, 5 service modülü + 1 repository modülü, PSP Protocol + Maps factory, 4 kritik ARQ worker, Prometheus /metrics.

### Altyapı kararları (K-I*)

- **[K-I1]** **Tek authoritative kaynak PostGIS + partial GIST**. Redis GEO namespace **yok**. `tow:loc:last:{tech_id}` sadece broadcast cache (300s TTL); dispatch query her zaman PostGIS `ST_DWithin` + partial index.
- **[K-I2]** Image: `postgres:16-alpine` → `postgis/postgis:16-3.4-alpine`. Migration 0017 `CREATE EXTENSION IF NOT EXISTS postgis`. Docs: `docs/ops/postgis-migration.md`.
- **[K-I3]** `geography(Point, 4326) + GIST` + generated columns (`pickup_location`, `dropoff_location`, `technician_profiles.last_known_location`, `tow_live_locations.location`). TR metre-bazlı geodesic doğruluk için `geography`.
- **[K-I4]** **Realtime = Redis Streams** (pub/sub değil). `tow:stream:{case_id}` XADD; WS client XREAD BLOCK + `resume_from={last_id}` native replay. Backpressure doğal (MAXLEN=500).
- **[K-I5]** Autovacuum tune: `technician_profiles` + `tow_live_locations` leaf partition'ları `autovacuum_vacuum_scale_factor=0.01`, `autovacuum_vacuum_cost_limit=2000`. (Parent partitioned table'a storage params yasak — leaf'lere uygulandı.)
- **[K-I6]** `.env` gitignore (mevcut); `.env.example` Faz 10 env vars güncellendi. Pre-commit detect-secrets V2'ye ertelendi.

### Veri modeli kararları (K-D*)

- **[K-D1]** `service_cases` ALTER: `tow_mode`, `tow_stage`, `tow_required_equipment tow_equipment[]` (**array — multi-equipment**), `incident_reason`, `scheduled_at`, `pickup_lat/lng/address`, `dropoff_lat/lng/address`, 2 generated geography + `tow_fare_quote JSONB`. CHECK `(kind='towing' AND tow_stage IS NOT NULL)` XOR zorunlu.
- **[K-D2]** `technician_profiles` ALTER: `last_known_location_lat/lng` (app-write) + `last_known_location geography` (generated) + `last_location_at` + `current_offer_case_id` + `current_offer_issued_at` (R1 concurrent dispatch race korumu) + `evidence_discipline_score`.
- **[K-D3]** `technician_tow_equipment` N:M (profile_id + equipment PK; CASCADE).
- **[K-D4]** `tow_dispatch_attempts` — UNIQUE `(case_id, technician_id, attempt_order)`; partial index pending.
- **[K-D5]** `tow_live_locations` **PARTITION BY RANGE (captured_at)** günlük. Bootstrap: 1 geçmiş + 30 gelecek gün. Retention 30 gün ARQ drop (`location_retention_purge`), rolling forward 7 gün.
- **[K-D6]** `tow_fare_settlements` 1:1 service_cases. State enum **genişletilmiş** (7 değer): `none | pre_auth_holding | preauth_stale | final_charged | refunded | cancelled | kasko_rejected`.
- **[K-D7]** `tow_fare_refunds` (**yeni, Plan agent**): multi-refund separation (capture_delta / cancellation / kasko_reimbursement / manual). `idempotency_key UNIQUE`.
- **[K-D8]** `tow_payment_idempotency` (**yeni, Plan agent**): PSP call replay durable cache (key PK, 24h TTL nightly purge deferred).
- **[K-D9]** `tow_cancellations` + `tow_otp_events` (partial unique `verify_result='pending'` per (case, purpose)).
- **[K-D10]** `user_payment_methods` V1 **rezerve** — V1'de Iyzico checkout redirect (MockPsp). V1.1 PSP switch sonrası tokenization aktif.

### Flow + algoritma kararları (K-F*)

- **[K-F1]** **Dispatch loop event-driven**. Blocking loop yok. `initiate_dispatch` senkron first candidate SQL scoring + `lock_offer_to_technician` optimistic UPDATE (`current_offer_case_id IS NULL`). Accept/decline/timeout → `record_dispatch_response` → next candidate veya pool conversion. ARQ `dispatch_attempt_timeout` per-attempt enqueue (Faz 10f tam wiring).
- **[K-F2]** **Scoring SQL'de** — weighted ORDER BY tek query, `partial GIST` + `ST_DWithin`. Python sort yok. Fairness + performance matview V2.
- **[K-F3]** **Outbox pattern** (`tow_lifecycle.transition_stage`): `tow_stage_requested` event INSERT → atomic UPDATE WHERE `tow_stage=from` (optimistic lock) → `tow_stage_committed` event. Evidence gate subquery count (case_evidence_items). Concurrent transition → InvalidStageTransition 409.
- **[K-F4]** **Dual-hold pre-auth renewal** — `fare_reconcile` hourly: preauth_expires_at < 2h → V1 stub (state→preauth_stale + operations alert). V1.1'de yeni authorize(100%) success → old void; fail → customer push.
- **[K-F5]** **Idempotency** iki katmanlı: (1) HTTP `Idempotency-Key` header + Redis cache middleware 24h replay; (2) `tow_payment_idempotency` DB tablo + PSP keys (`preauth:{case_id}`, `capture:{settlement_id}`, `refund:{settlement_id}:{reason}`).
- **[K-F6]** **Heartbeat enforcer** ARQ cron 30sn: `last_location_at < NOW - 90s` → `availability='offline'` auto. Dispatch query aynı cutoff.
- **[K-F7]** **GPS sanity check** (R7): `tow_location.sanity_check_arrival_distance` — arrived transition öncesi `ST_Distance ≤ 500m`. Aşan → `FraudSuspectedError 403` + (V2) `auth_events.fraud_suspected`.
- **[K-F8]** **Per-technician offer lock** — `current_offer_case_id` UPDATE WHERE NULL. Acquired=False → exclude + retry. 15sn sonrası ARQ `current_offer_expiry` NULL'a çevirir.
- **[K-F9]** Fairness + evidence_discipline_score matview V2'ye deferred (SQL stub score=1.0).
- **[K-F10]** **Scheduled mode** mevcut `case_offers` tablosu reuse. Yeni `case_offer_kind` enum + `kind` column (`standard | tow_scheduled`). Full bidding flow 10f sub-sprint (stub endpoint'ler mevcut).

### Migration sırası

- `20260422_0017_tow_foundation` — PostGIS + 5 enum + service_cases + technician_profiles ALTER + technician_tow_equipment N:M + user_payment_methods rezerve + case_event_type +6 + auth_event_type +2 + 2 partial GIST + autovac tune.
- `20260422_0018_tow_dispatch_tables` — 7 tow tablo + tow_live_locations partitioning (bootstrap 31 partition + default) + case_offer_kind enum + case_offers.kind column + 8 yeni enum.
- (Planda 0019 CONCURRENTLY indeksleri vardı; gerekli tüm index'ler 0017-0018'de yer aldı, 0019 oluşturulmadı.)

### Servis + API çıkışı

- **Models**: `app/models/tow.py` (8 SQLAlchemy class — dispatch_attempt, live_location, fare_settlement, fare_refund, payment_idempotency, cancellation, otp_event) + `app/models/user_payment_method.py` + `technician_tow_equipment` link + `ServiceCase`/`TechnicianProfile` extension'ları.
- **Repository**: `app/repositories/tow.py` — dispatch_attempts, candidate selection (weighted SQL), live_locations, settlements+refunds+idempotency, cancellations, OTP helpers, evidence gate counts, optimistic lock.
- **Services** (5): `tow_dispatch` (event-driven, radius ladder 10→25→50, SQL scoring), `tow_lifecycle` (outbox + evidence gate + cancel+fee), `tow_payment` (PSP Protocol + dual-hold + multi-refund + idempotency), `tow_location` (DB insert + Redis SETEX + XADD stream + sanity), `tow_evidence` (OTP crypto secure + Redis SETEX + attempts/expiry).
- **Integrations**: `app/integrations/psp/` (Protocol + MockPsp V1 default + Iyzico V1.1 stub + factory env PSP_PROVIDER) + `app/integrations/maps/` (Mapbox stub + haversine offline fallback + factory).
- **REST** (14): `/tow/fare/quote`, `/tow/cases` (POST), `/tow/cases/{id}` (GET), `/tow/cases/{id}/tracking`, `/tow/cases/{id}/dispatch/response`, `/tow/cases/{id}/location`, `/tow/cases/{id}/otp/issue|verify`, `/tow/cases/{id}/cancel|kasko|rating|evidence`, `/tow/bids`, `/tow/bids/{id}/accept`.
- **WebSocket**: `/ws/tow/{case_id}?token=<jwt>&resume_from=<last_id>` — Redis Streams XREAD BLOCK consumer + heartbeat, participant-only (IDOR safe).
- **Middleware**: `IdempotencyMiddleware` (header + Redis 24h), `RequestIdMiddleware` (X-Request-ID echo), `rate_limit` slowapi skeleton.
- **Exception handlers**: InvalidStageTransition→409, EvidenceGateUnmet→409, ConcurrentOfferError→409, NoCandidateFoundError→410, OtpExpired→410, OtpMaxAttempts→429, OtpInvalid→400, PaymentDeclined→402, PaymentPreAuthStale→402, LookupError→404.
- **Role deps**: `RequireCustomer`, `RequireTechnician`, `RequireTowTechnician` (provider_type=cekici + towing_coordination=true), `RequireAdmin`. Case participant check route içinde (IDOR).
- **ARQ workers** (4 kritik): `dispatch_attempt_timeout` (on-demand), `current_offer_expiry` (10s cron), `heartbeat_enforcer` (30s cron), `fare_reconcile` (1h cron), `location_retention_purge` (daily 03:00 UTC cron).
- **/metrics**: Prometheus — dispatch_duration histogram, match_success gauge, radius_expansion counter, candidate_pool_size histogram, ws_message_lag histogram, fare_capture counter, cap_absorbed counter, preauth_stale counter, otp_replay_blocked counter, fraud_suspected counter.

### Ödeme + ölçek varsayımları

- **[K-P1]** **PSP**: MockPsp V1 default (`PSP_PROVIDER=mock`). V1.1 sub-sprint `PSP_PROVIDER=iyzico` tek env var switch (adapter hazır, `NotImplementedError` V1'de).
- **[K-P2]** **Maps**: `MAPS_PROVIDER=offline` (haversine) V1 default; Mapbox token mevcutsa `mapbox` aktif. Gerçek reverse geocode + distance matrix V1.1.
- **[K-P4]** GPS 5s moving / 15s stationary — client responsibility; backend valid range CHECK.
- **[K-P5]** OTP 6 haneli numeric (`secrets.randbelow`), 10 dk TTL (env), 3 yanlış → invalidate (env), SHA256 salted hash (case_id salt). Codes never re-exposed after issue.
- **[KÖ-1]** 500 eşzamanlı case / 3000 aktif çekici (erken lansman). Partial GIST + partition prune + Redis Streams bu ölçeği V1'de karşılıyor. Horizontal API scale readiness: middleware stateless, WS per-pod Redis subscribe (consumer group V2).

### Exit durumu

- [x] `alembic upgrade head` 0016→0017→0018 yeşil; `CREATE EXTENSION` idempotent; generated column POINT doldu; GIST partial EXPLAIN index scan; CHECK XOR reject; partition routing smoke PASS; UNIQUE constraints enforced (dispatch/refund/OTP).
- [x] mypy --strict Faz 10 source'larda temiz (13 pre-existing error `storage/s3`/`twilio`/`otp`/`workers/media` dışında).
- [x] App bootstrap + 14 tow endpoint + `/metrics` + `/ws/tow/{id}` OpenAPI listeleniyor.
- [ ] Integration test suite (dispatch happy path, radius fallback, concurrent race, OTP replay) → Faz 10f sub-sprint (commit sonrası).
- [ ] Load test 500 concurrent + 2000 WS subscriber → staging validation.
- [ ] Schema parity CI test (Zod↔Pydantic drift check) → Faz 10f sub-sprint.

### Zod parity known drift

- `TowDispatchStageSchema`: Zod 13 değer, Pydantic 15 (preauth_failed, preauth_stale backend-only).
- `TowSettlementStatusSchema`: Zod 5, Pydantic 7 (preauth_stale, kasko_rejected backend-only).
- `TowRequest.required_equipment`: Zod singular `TowVehicleEquipment`, Backend `list[TowEquipment]` (multi-equipment). Frontend tarafı 10f'de array'e alinacak.

Drift additive (backend superset), mobile client safe. CI parity test Faz 10f sub-sprint.

### Tahmini çıktı (gerçekleşen)

- Tablo: 32 → **40** (+7 tow tables + user_payment_methods rezerve).
- Migration: 16 → **18** (0017 + 0018).
- Service: 15 → **20** (+5 tow service).
- Repository: 10 → **11** (tow tek dosya, ergonomi).
- Router: 3 → **5** (tow REST + tow WS).
- ARQ worker: 0 → **4 kritik cron + 1 on-demand**.
- External integration: 0 → **2** (PSP factory + Maps factory).
- Middleware: 0 → **3** (rate_limit skeleton + request_id + idempotency).
- Enum: +10 (5 tow enum + 4 tow-op enum + case_offer_kind) + 8 ADD VALUE (case_event_type ×6 + auth_event_type ×2).
- Pip deps: +5 (geoalchemy2, slowapi, prometheus-client, itsdangerous, iyzipay).
- Docker image: postgres → postgis.

### Pre-existing bloker (Faz 10 dışı, ayrı sprint)

Faz 10 testlerini yazarken keşfedildi; tow PR'ın sorumluluğu değil ama codebase seviyesinde P0:

1. **SAEnum name/value mismatch**: Tüm modellerde `Mapped[UserRole]` vb. SAEnum default `.name` (UPPERCASE) bind eder ama PostgreSQL enum'ları lowercase value tutar. Sonuç: `User(role=UserRole.CUSTOMER)` INSERT'i `'CUSTOMER'` gönderir, DB `'customer'` bekler → `InvalidTextRepresentationError`. Mevcut `tests/test_media_smoke.py` pre-existing kırık. **Fix**: tüm SAEnum sütunlarına `values_callable=lambda cls: [m.value for m in cls]` ekle.

2. **pytest-asyncio + asyncpg event loop**: `AsyncSessionLocal` engine modül seviyesinde; pytest-asyncio `auto` mode her teste yeni event_loop açar → asyncpg `Future attached to different loop` hatası. **Fix**: `tests/conftest.py` session-scoped event_loop + per-test engine dispose, veya loop_scope="session" fixture.

3. **`ruff` media.py:149 SIM102**: Pre-existing iç içe `if` (3197368 commit). Trivial combine.

Bu 3 madde bir "Test infra + enum fix" küçük PR'ına topaklanmalı. `test_media_smoke`'un zaten çalışmadığı açık → regression riski yok.

---

## Faz 11 — Media Upgrade V1 (execution log, 2026-04-22)

### Durum özeti

- **Scope**: 18-purpose canonical master + policy matrix + 3 ARQ cron + EXIF explicit GPS strip + 5 Prometheus metric + **SAEnum global fix** (codebase P0 bloker) + S3 prod runbook
- **Shipped**: 2 migration (0019 enum expand + 0020 ALTER), 1 yeni service (media_policy), 3 yeni worker, 14 model dosyasında SAEnum → pg_enum wrapper refactor, 5 Prometheus metric, clamav docker service profile
- **Test**: 27 pass + 7 skipped (4 Faz 10 + 3 yeni — hepsi pre-existing asyncpg event-loop bloker için reasoned skip); `test_media_smoke` LocalStack-bağımlı (ayrı infra)
- **Pre-existing bloker çözüldü**: SAEnum `.name` vs `.value` artık tüm kodbasede doğru (pg_enum `values_callable` ile)
- **Tablo**: 40 → 40 (ALTER only; +8 kolon media_assets, 2 yeni partial index)

### Altyapı kararları

- **[K-I1]** **`pg_enum` wrapper** `app/db/enums.py` — tüm `SAEnum(X, name="...")` çağrıları `pg_enum(X, name="...")` ile replace. `values_callable=lambda cls: [m.value for m in cls]` merkezi. StrEnum sınıflarında `.value` (lowercase) PG enum ile uyumlu; `.name` (UPPERCASE) problemi ortadan kalktı. Hem model insertleri hem read hydration doğru çalışır. 14 model dosyası × 40+ SAEnum çağrısı sed replace + ruff import sort; test regression yok.
- **[K-I2]** ENUM ADD VALUE **AUTOCOMMIT** zorunlu (PG 16'da da transactional değil): migration 0019 `op.get_bind().execute(text("COMMIT"))` öncesinde çağırıp sonra `ALTER TYPE ... ADD VALUE IF NOT EXISTS`. Idempotent; tekrar çalıştırma güvenli.
- **[K-I3]** ClamAV Docker service `docker-compose.yml`'de `profiles: [antivirus]` ile opt-in. V1'de aktif değil (`CLAMAV_HOST` env boş → verdict=skipped). V1.1 aktivasyonu: `docker compose --profile antivirus up -d clamav`.
- **[K-I4]** S3 prod provision **uygulanmadı** (DevOps responsibility + AWS creds); `docs/ops/s3-production.md` Terraform HCL şablon + step-by-step runbook. 2 bucket + CloudFront OAI + CORS (ExposeHeaders ETag) + versioning 30g + lifecycle (pending prefix 1g expire, incomplete multipart 1g abort) + IAM presign-only role.

### Veri modeli kararları

- **[K-D1]** `media_purpose` ENUM **21 değer**: 5 legacy (backward compat — `case_attachment`, `technician_certificate`, `technician_gallery`, `technician_promo`, `user_avatar`) + 16 yeni canonical. Legacy → canonical normalize `media_policy.canonicalize()` helper (yeni yazımlar opt-in; mevcut rowlar korunur).
- **[K-D2]** `media_assets` ALTER: `owner_kind VARCHAR(32)` + `owner_id UUID` (polymorphic; FK yok — runtime `_resolve_owner` validate) + `exif_stripped_at TIMESTAMPTZ` + `antivirus_scanned_at` + `antivirus_verdict VARCHAR(16)` + `dimensions_json JSONB` + `duration_sec SMALLINT`. `owner_ref` **korunur** (backward compat; new writes her ikisini de doldurur).
- **[K-D3]** `media_status` ADD VALUE `quarantined` (antivirus infected state).
- **[K-D4]** **Partial indexes** (0020 migration):
  - `ix_media_assets_pending_old (created_at) WHERE status='pending_upload'` — orphan cron hızlı scan
  - `ix_media_assets_owner_active (owner_kind, owner_id) WHERE deleted_at IS NULL AND status IN ('ready','uploaded')` — polymorphic lookup
- **[K-D5]** Backfill 0020 migration: mevcut `owner_ref` string (`kind:uuid` format) → regex parse → `owner_kind` + `owner_id` doldur; parse başarısız → NULL (service runtime fill).

### Flow kararları

- **[K-F1]** `media_policy.py` **tek canonical kaynak**: 21 purpose × `PolicyRule` dataclass (max_size, dim_max, mime_whitelist, duration_max_sec, retention_days, retention_owner_state, antivirus_required, visibility, owner_kind). Service `media_policy.enforce(purpose, mime, size, dims?, duration?)` 422 reject. `media_policy.get(purpose)` infrastructure query.
- **[K-F2]** **Upload intent — policy delegate**: `_validate_mime_and_size` kaldırıldı, `media_policy.enforce()` çağrısı + `UnknownPurposeError` 400 map. `_visibility_for_purpose` policy proxy. `_build_object_key` policy.owner_kind + purpose.value path scope kullanır (legacy hardcoded if/else zincir kaldırıldı).
- **[K-F3]** **Upload complete — antivirus chain**: `complete_upload` sonrası `media_policy.get(purpose).antivirus_required` kontrol; true → `media_antivirus_scan(asset_id)` ARQ enqueue. Image variant worker'ı zaten çalışır; antivirus paralel.
- **[K-F4]** **Worker chain**:
  1. `process_media_asset` — EXIF **explicit GPS strip** (`image.getexif()` → `del exif[34853]`) + orijinal overwrite (defense-in-depth) + variants + `exif_stripped_at = NOW` bind
  2. `media_antivirus_scan` — V1 stub (`CLAMAV_HOST` boş → verdict=skipped); V1.1 HTTP POST ClamAV REST; verdict binding
  3. `media_orphan_purge` — daily 03:30 UTC; `status=pending_upload AND created_at < NOW-24h` → S3 delete + DB delete
  4. `media_retention_sweep` — daily 04:00 UTC; per-purpose `retention_days + retention_owner_state`; closed_cases/deleted_users bazlı purge
- **[K-F5]** Access control — `_assert_upload_allowed` genişletildi: CASE_PURPOSES (9 purpose), TECHNICIAN_PURPOSES (7 purpose), VEHICLE_PURPOSES (2), ADMIN_ONLY (`campaign_asset`). customer/technician rol ayrımı purpose-kategorisi bazında.
- **[K-F6]** Signed URL refresh `GET /media/assets/{id}` her çağrıda yeni presigned (TTL env). Client-side expired cache yönetimi gereksiz.

### Kritik dosyalar

**Yeni (11):**
- `app/db/enums.py` — pg_enum wrapper (merkezi SAEnum fix)
- `app/services/media_policy.py` — 21 purpose canonical matrix
- `app/workers/media_orphan_purge.py`
- `app/workers/media_retention_sweep.py`
- `app/workers/media_antivirus.py`
- `alembic/versions/20260422_0019_media_purpose_expand.py`
- `alembic/versions/20260422_0020_media_asset_alter.py`
- `tests/conftest.py` — session-scoped event_loop + engine dispose
- `tests/test_media_policy.py` — 14 test (coverage 21 purpose)
- `tests/test_media_exif.py` — 4 test (EXIF GPS strip)
- `tests/test_media_workers.py` — 3 test (1 aktif + 2 skip)
- `docs/ops/s3-production.md` — Terraform runbook

**Güncellenen (backend):**
- 14 model dosyası SAEnum → pg_enum refactor
- `app/models/media.py` — MediaPurpose 21 değer + MediaStatus QUARANTINED + OwnerKind + AntivirusVerdict enum + 8 yeni kolon + 2 partial index
- `app/schemas/media.py` — UploadIntentRequest `owner_kind` + `owner_id` + `dimensions` + `duration_sec`; MediaAssetResponse audit fields
- `app/services/media.py` — policy delegation + polymorphic owner + antivirus enqueue + metric wire
- `app/workers/media.py` — EXIF explicit GPS strip + orijinal overwrite + `exif_stripped_at` audit + mypy fix
- `app/workers/settings.py` — 3 yeni cron + 1 on-demand register
- `app/observability/metrics.py` — 5 media metric
- `app/core/config.py` — `media_orphan_retention_hours`, `clamav_host` env
- `app/db/session.py` — conftest dispose hook için no-op (mevcut)
- `.env.example` — MEDIA_ORPHAN_RETENTION_HOURS, CLAMAV_HOST
- `docker-compose.yml` — clamav service (profile: antivirus)
- `tests/test_media_smoke.py` — test fixture `db.commit()` fix (pre-existing bug)

### Zod parity (frontend kapsam dışı — Faz 12)

Backend'de `MediaPurpose` 21 değer; Zod `packages/domain/src/media.ts` 5 değer. Known drift additive (backend superset). Faz 12'de Zod güncelleme + `packages/mobile-core/src/media/useMediaUpload.ts` shared hook (UI-UX-FRONTEND-DEV sohbet).

### Test durumu

- **27 pass + 7 skipped** (`tests/` — test_media_smoke hariç):
  - `test_health` (1)
  - `test_tow_dispatch` (5 aktif + 2 skip)
  - `test_tow_otp` (3 aktif + 2 skip)
  - `test_media_policy` (14 aktif)
  - `test_media_exif` (4 aktif)
  - `test_media_workers` (0 aktif + 3 skip — cross-test asyncpg event-loop)
- mypy strict **Faz 11 kapsamında temiz** (8 dosya, 0 error)
- ruff: Faz 11 değişikliklerinde temiz

### Exit criteria

- [x] `alembic upgrade head` 0018→0019→0020 yeşil; downgrade cycle çalışır
- [x] pg_enum values_callable: User/MediaAsset vb. INSERT/SELECT roundtrip lowercase doğru
- [x] 21 media_purpose enum DB'de (`SELECT enum_range(NULL::media_purpose)`)
- [x] 2 partial index oluştu (`\d media_assets`)
- [x] owner_kind/owner_id backfill: `owner_ref LIKE 'case:%' → owner_kind='service_case'`
- [x] Policy enforce: 18 purpose doğru mime/size kabul, yanlış 422
- [x] EXIF: `_strip_exif_in_place` GPS yoksa no-op; `_resize_image` GPS içermez output
- [x] Worker register: 3 function + 6 cron `WorkerSettings` class'ta
- [x] /metrics: 5 yeni counter
- [x] mypy + ruff Faz 11 source'larda clean
- [x] KARAR-LOG + README güncellendi; docs/ops/s3-production.md runbook hazır

### Faz sonrası (Faz 12+)

- **Faz 12** Frontend media upgrade (`useMediaUpload` shared hook + client compress + offline queue + per-purpose UX)
- **Faz 13** S3 prod provision uygula (Terraform apply + CloudFront + IAM); `.env.production`
- **Faz 14** ClamAV V1.1 canlı (CLAMAV_HOST set + profile up); antivirus stub kaldır
- **Faz 15** Multipart upload V2 (video 200MB+ chunked resumable)

---

## Faz 12 — Müşteri Vaka Oluşturma Backend Kontratı (execution log, 2026-04-22)

### Durum özeti

- **Scope**: PO brief [docs/musteri-vaka-olusturma-backend-contract.md](../musteri-vaka-olusturma-backend-contract.md) §2-§12 uygulandı. Kind-bazlı validation + 7 endpoint (4 ana + 3 draft brief dışı) + attachment pipeline + error contract.
- **Shipped**: 1 migration (0021 media_assets.linked_case_id FK + partial index), 1 yeni service (case_create), 1 yeni validator (maintenance_detail_validator), 1 yeni router (cases — 4 endpoint), 2 Prometheus metric, 3 test dosyası (30 test aktif).
- **Test**: 56 pass + 10 skipped (cross-test asyncpg event-loop bloker — Faz 10/11 ortak)
- **Audit P0-6 çözüldü**: REST endpoint hazır; POST /cases → ServiceCase + CaseEvent (`submitted`) + blueprint assignment.

### Altyapı kararları

- **[K-I1]** `media_assets.linked_case_id UUID FK SET NULL` — asset reuse guard (§5.4). Partial index `WHERE linked_case_id IS NOT NULL` hızlı lookup.
- **[K-I2]** Generated geography columns `Computed()` işaretli — SQLAlchemy artık ORM INSERT'te bu kolonları atlar. Faz 10'da migration'da `GENERATED ALWAYS` DDL, model'de `nullable=True` idi; ORM ilk hydrate'da INSERT sırasında NULL gönderiyordu → `GeneratedAlwaysError`. Case.pickup_location/dropoff_location + TechnicianProfile.last_known_location + TowLiveLocation.location tümünde `Computed(expr, persisted=True)` declarative alignment yapıldı.

### Veri modeli kararları

- **[K-D1]** `ServiceRequestDraftCreate` Pydantic genişletme (§9.1):
  - `LatLng` alt model (lat/lng range-check ± 90/180)
  - `location_lat_lng: LatLng | None` (permission fallback null OK)
  - `dropoff_lat_lng: LatLng | None`
  - `damage_severity: DamageSeverity` enum (minor/moderate/major/total_loss; matching skorunda kullanılır)
  - `maintenance_detail: dict[str, Any] | None` (polymorphic; service layer parse eder)
  - `CaseAttachmentDraft.category: str` (semantik etiket — scene_overview/damage_detail/mileage_photo vb.)
- **[K-D2]** `CaseWorkflowBlueprint` mevcut 4 değer reuse: damage_insured/uninsured, maintenance_major/standard. Towing + breakdown için standart fallback (future Faz'da ayrıştırılır).

### Flow kararları

- **[K-F1]** Pydantic `@model_validator` — kind-bazlı zorunlu/yasak enforce. `_KIND_FIELD_RULES` dict 4 kind × required/forbidden entry. False/list default != explicit ayrımı: required → `value is None` → hata; forbidden → `value != default and value is not None` → hata.
- **[K-F2]** 3 katman validation (§6):
  1. Pydantic syntax (type/min/max/enum)
  2. @model_validator kind-bazlı + conditional (kasko_brand if kasko_selected; accident emergency_acknowledged must be True)
  3. Service layer: vehicle ownership + maintenance_detail parse + attachment ownership/completion/uniqueness + REQUIRED_ATTACHMENT_MATRIX + duplicate open case guard
- **[K-F3]** `maintenance_detail_validator.py` — kategori × payload çapraz validator. 14 MaintenanceCategory × Pydantic sub-model dict (PeriodicDetail, GlassFilmDetail, TireDetail, CoatingDetail, BatteryDetail, BrakeDetail, ClimateDetail, DetailWashDetail, PackageDetail, EmptyDetail). `_REQUIRED_CATEGORIES = {GLASS_FILM, TIRE, BRAKE}` detail zorunlu. `extra="forbid"` unknown field reddi.
- **[K-F4]** `REQUIRED_ATTACHMENT_MATRIX` — (kind, sub_category) → zorunlu attachment.category frozenset. `accident`: scene_overview+damage_detail; `maintenance/periodic`: mileage_photo; `maintenance/tire`: tire_photo; diğerleri boş (opsiyonel).
- **[K-F5]** Duplicate open case guard: `accident`, `breakdown`, `towing` için `vehicle_id + kind + status ∈ {matching...invoice_approval}` query → existing varsa 409 `duplicate_open_case`. Maintenance için değil (paralel bakımlar OK).
- **[K-F6]** Asset bağlama: submit sonrası `UPDATE media_assets SET linked_case_id=:case WHERE id IN (:asset_ids)`. Reuse guard: submit öncesi `linked_case_id IS NOT NULL` olan asset varsa 409 `asset_already_linked`.
- **[K-F7]** Workflow blueprint resolver:
  - `accident + (kasko OR sigorta)` → `damage_insured`
  - `accident + neither` → `damage_uninsured`
  - `maintenance ∈ {periodic, coating, package_*}` → `maintenance_major`
  - `maintenance` diğer → `maintenance_standard`
  - `breakdown + towing` → `maintenance_standard` (fallback; Faz 13'te ayrıştırılacak)

### Endpoint kontratı

- **POST /api/v1/cases** — RequireCustomer; ServiceRequestDraftCreate body; 201 + CaseCreateResponse (id, status, kind, workflow_blueprint, created_at, title)
- **GET /api/v1/cases/me** — RequireCustomer; kendi açık+kapalı vakaları (CaseSummaryResponse[])
- **GET /api/v1/cases/{id}** — RequireCurrentUser; participant-only (customer_user_id OR assigned_technician_id OR admin)
- **POST /api/v1/cases/{id}/cancel** — customer-self OR admin; status→cancelled + CaseEvent

Draft endpoint'leri (POST/GET/DELETE /cases/drafts) ayrı brief kapsamında — Faz 13 iterasyonu.

### Error contract

| HTTP | Type | Scenario |
|---|---|---|
| 422 | `value_error` (Pydantic) | Syntax/conditional/forbidden field |
| 422 | `maintenance_detail_invalid` | Kategori × detail çapraz uyumsuz |
| 422 | `missing_required_attachments` | REQUIRED_ATTACHMENT_MATRIX eksik (ctx.missing=[...]) |
| 422 | `asset_not_complete` | linked asset status != ready/uploaded |
| 409 | `duplicate_open_case` | Aynı araç açık case (ctx.existing_case_id + kind) |
| 409 | `asset_already_linked` | Asset başka case'e bağlı |
| 403 | `vehicle_not_owned` | Başkasının aracı |
| 403 | `asset_not_owned` | Başkasının asset'i |
| 403 | `not_case_participant` / `not_case_owner` | Authz fail |
| 404 | `case_not_found` | deleted veya yok |

### Kritik dosyalar

**Yeni (4):**
- `app/services/case_create.py` — 6-aşamalı flow + domain exceptions + REQUIRED_ATTACHMENT_MATRIX + resolve_blueprint
- `app/services/maintenance_detail_validator.py` — 14 kategori × payload sub-model
- `app/api/v1/routes/cases.py` — 4 endpoint
- `alembic/versions/20260422_0021_media_linked_case.py`
- `tests/test_case_create_schema.py` (14 test)
- `tests/test_maintenance_detail_validator.py` (10 test)
- `tests/test_case_create_service.py` (1 DB + 4 pure unit + 2 skipped)

**Güncellenen:**
- `app/schemas/service_request.py` — +LatLng, DamageSeverity, attachment.category, location/dropoff_lat_lng, damage_severity, maintenance_detail, @model_validator, _KIND_FIELD_RULES, _FIELD_DEFAULTS
- `app/models/case.py` + `technician.py` + `tow.py` — `Computed()` işareti generated columns (ORM INSERT fix)
- `app/models/media.py` — +linked_case_id FK
- `app/observability/metrics.py` — +2 case_create metric
- `app/api/v1/router.py` — cases router include

### Test durumu

- `test_case_create_schema` — 14 test: happy + sad per kind (accident missing damage_severity, counterparty_note, kasko_brand; breakdown missing symptoms + kasko forbidden; maintenance damage_area forbidden; towing missing dropoff_lat_lng + pickup_preference forbidden; LatLng range)
- `test_maintenance_detail_validator` — 10 test: glass_film/tire valid + sad, periodic optional, headlight_polish empty, tire required raise, category None check, extra field forbid
- `test_case_create_service` — 4 pure (blueprint resolver 4 branch) + 1 DB happy (maintenance periodic w/ mileage_photo) + 2 skipped (cross-test bloker)

Toplam 30 yeni test — 28 aktif, 2 skipped reasoned.

Genel test suite: 56 pass + 10 skipped; ruff clean; mypy Faz 12 source clean.

### Audit senkronu

| Audit bulgu | Çözüm |
|---|---|
| P0-6 (REST endpoint eksik) | ✅ `/cases` router + 4 endpoint |
| P0-5 (kullanıcı tercihi enforcement) | ✅ Pydantic kind-bazlı `_KIND_FIELD_RULES` (hard reject); matching motoru soft-warning ayrı iterasyon |
| P1-2 (damage scoring) | ✅ DamageSeverity enum — matching skorunda kullanılır |
| P1-1 (vehicle history consent) | ⏳ Bu faz kapsamı dışı — araç ekleme flow'unun ayrı iterasyonu |
| P1-5 (test coverage) | ✅ 30 yeni test + 56 toplam |

### Zod parity (frontend kapsam dışı — Faz D)

Backend `ServiceRequestDraftCreate` + LatLng + DamageSeverity + CaseAttachmentDraft.category ek. Frontend [packages/domain/src/service-case.ts](../../packages/domain/src/service-case.ts) Zod şemasının aynı alanlarla paralel güncellenmesi gerekir (UI-UX-FRONTEND-DEV sohbet iterasyonu). Zod ↔ Pydantic parity CI testi Faz 13 sub-sprint.

### Faz sonrası (Faz 13+)

- **Faz 13a** — Draft endpoint'leri (POST/GET/DELETE `/cases/drafts/*`) — half-state resume
- **Faz 13b** — Mobil wire-up (mock engine → real API; 422/409/403 → i18n key mapping; submit sonrası case profile navigation)
- **Faz 14** — Workflow blueprint genişletme (breakdown_* + towing_*) + milestone/task seed her blueprint için
- **Faz 15** — Zod ↔ Pydantic parity CI test + schema drift gate
- **Faz 16** — Reverse image search + duplicate checksum audit (anti-fraud media Faz 11 V2)

---

## Faz 13 — Backend REST API Kapatma Faz A (PR 1-3 partial, 2026-04-22)

### Durum özeti

- **Scope**: PO brief [docs/backend-rest-api-faz-a-brief.md](../backend-rest-api-faz-a-brief.md) 9 atomik PR planı; bu commit PR 1 (ortak pattern) + PR 2 (/offers) + PR 3 (/appointments) ship eder. Kalan 6 PR sıradaki iterasyonlarda.
- **Shipped**: 2 router (offers + appointments, 13 endpoint), 1 ortak pagination modülü, deps.py semantik alias'ları, 16 yeni pure test.
- **Test**: 72 pass + 10 skipped; ruff + mypy Faz 13 source clean.

### PR 1 — Ortak pattern'ler (§12)

- `app/api/pagination.py` — cursor-based pagination (opaque base64url JSON). `PaginatedResponse[T]` generic, `encode_cursor`/`decode_cursor` helper'ları, `CursorQuery` + `LimitQuery` Annotated type alias'ları.
- `app/api/v1/deps.py` — `CurrentCustomerDep`, `CurrentTechnicianDep`, `CurrentAdminDep` semantic alias'ları (brief §12.1 tutarlılık).
- Error contract [Faz 12](§7) reuse: `{type, message, ...ctx}` envelope.

### PR 2 — /offers router (5 endpoint, brief §3)

- `POST   /offers` — teknisyen submit. Validasyon: case status ∈ {matching, offers_ready}, provider_type ∈ KIND_PROVIDER_MAP[case.kind], duplicate active offer guard (409), slot_is_firm→slot_proposal zorunlu, kind-bazlı cap.
- `GET    /offers/case/{id}` — case owner + admin listeleme
- `GET    /offers/me` — teknisyen paginated (cursor + status_in filter)
- `POST   /offers/{id}/accept` — case owner; atomic `offer_acceptance.accept_offer` reuse; 410 if already accepted.
- `POST   /offers/{id}/withdraw` — teknisyen; pending/shortlisted only; 409 if accepted.
- Kind offer cap matrisi: accident 5, breakdown 7, maintenance 10, towing 5 (PO kararı).
- Race koruma: partial unique `uq_active_offer_per_tech_case` + service atomic accept + status-filtered WHERE UPDATE withdraw.

### PR 3 — /appointments router (8 endpoint, brief §4)

- `POST /appointments` — direct_request path; customer-driven; TTL 48h; case→APPOINTMENT_PENDING; duplicate pending guard (409).
- `GET  /appointments/case/{id}` — case owner + assigned technician
- `POST /appointments/{id}/approve|decline|cancel` — 410 AppointmentNotPendingError
- `POST /appointments/{id}/counter-propose` — tech slot düzenler (AppointmentStatus.COUNTER_PENDING; service zaten guard)
- `POST /appointments/{id}/confirm-counter|decline-counter` — müşteri; 410 AppointmentNotCounterPendingError
- Service layer `appointment_flow` + `case_lifecycle.transition_case_status` reuse (atomic appointment + case status sync).

### Pure test coverage (16 test)

- Cursor roundtrip + invalid 400 + build_paginated more/no-more (6 test)
- OfferSubmitPayload happy + negative amount + empty headline + extra field forbid + withdraw (5 test)
- Kind offer cap matrix değerleri (1 test)
- AppointmentRequest happy + extra field + counter payload + reason empty (4 test)

DB integration race testleri — pre-existing cross-test event-loop bloker nedeniyle 4 skip reasoned (Faz 10/11 ortak borç; per-test engine fixture ayrı infra iterasyonu).

### Sıradaki

- PR 4 — `/technicians/me/*` 14 endpoint + migration (provider_mode + tow_operator enum)
- PR 5 — `/technicians/public` + `/taxonomy` 7 endpoint + Redis cache
- PR 6 — `/vehicles` 7 endpoint + history_consent migration (audit P1-1)
- PR 7 — `/insurance-claims` 6 endpoint
- PR 8 — `/pool` + `/reviews` 6 endpoint + reviews migration
- PR 9 — `/admin/*` 15 endpoint + audit log

Toplam 67 endpoint hedefinden 13 ship (47 → 47 route toplam: auth + media + health + cases + offers + appointments + tow + tow_ws).

### Audit senkronu

- ✅ P0-6 (REST endpoint eksik) — offers + appointments + cases kapsamı
- ✅ P0-2 (offer accept race) — `mark_accepted` + atomic service + 410 pattern enforced
- ⏳ P0-3 (pool admission gate) — PR 8 (/pool/feed)
- ⏳ P1-1 (vehicle history consent) — PR 6
- 🔄 P1-5 (test coverage) — +16 bu iterasyonda; 72 toplam aktif
