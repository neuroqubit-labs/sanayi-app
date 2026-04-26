# Naro Case Refactor — Backend Uygulama Planı

**Tarih:** 2026-04-26
**Çerçeve:** Backend (FastAPI + SQLAlchemy + Alembic + ARQ + Pydantic v2)
**Sahibi:** Claude (BE)
**Paralel:** Codex (FE)

---

## 0. Amaç

Bu doküman, [docs/case-refactor-plan-2026-04-26.md](case-refactor-plan-2026-04-26.md) içindeki refactor sıralamasının **backend tarafındaki somut uygulamasını** detaylar. Hangi faz, hangi dosyaları değiştirir, hangi testler kanıt olur, hangi commit ile kapanır.

Ana referanslar (sırayla):
1. [naro-vaka-omurgasi.md](naro-vaka-omurgasi.md) — ürün niyeti
2. [naro-vaka-omurgasi-genisletilmis.md](naro-vaka-omurgasi-genisletilmis.md) — sistem dili
3. [naro-domain-glossary.md](naro-domain-glossary.md) — naming
4. [audits/2026-04-26-vaka-omurgasi-fix-haritasi-revize.md](audits/2026-04-26-vaka-omurgasi-fix-haritasi-revize.md) — F1-F21 atomik haritası
5. [case-refactor-plan-2026-04-26.md](case-refactor-plan-2026-04-26.md) — refactor plan üst dokümanı

Kural: **Big-bang rename yok. Davranış guard'ları → read-model → endpoint → naming cleanup.**

---

## 1. Branch + Commit Stratejisi

- **Branch:** `refactor/case-backend` (Codex'in `refactor/case-frontend`'i ile paralel)
- **Commit ritmi:** her F maddesi veya R bölgesi ayrı commit; küçük seriler hâlinde
- **Contract önce:** schema/Pydantic değişikliği veya yeni endpoint'in payload tanımı **ayrı küçük commit** olarak FE'den önce push edilir; FE bu commit'e bağlanır
- **Test ritmi:** her commit kendi `*_pure.py` testiyle gelir; CI ruff + pytest yeşil
- **Yasaklar:** `--no-verify`, force-push to main, schema rename + behavior change tek commit

---

## 2. Faz 1 — Davranış Guard'ları

**Süre:** ~2.5-3 saat
**Hedef:** Ürünü bozan davranışları rename beklemeden kapatmak. Naming aynen kalır.

### F1 BE — Offer-zorunlu appointment (~30 dk)

**Dosya:** [naro-backend/app/api/v1/routes/appointments.py:87-157](../naro-backend/app/api/v1/routes/appointments.py#L87)

- `create_direct_request` endpoint'i içinde, ownership/vehicle check'lerin hemen sonrası:
  ```python
  if payload.offer_id is None and case.kind != ServiceRequestKind.TOWING:
      raise HTTPException(
          status_code=422,
          detail={"type": "appointment_requires_offer"},
      )
  ```
- (Çekici akışı `direct_request` source kullanmıyor; ama explicit kind kontrolü güvenlik için.)
- `source=direct_request` payload'u kalır — ileride compat amacıyla; ama bakım/arıza/hasar için 422.

**Test:** `naro-backend/tests/test_appointment_requires_offer_pure.py`
- Case A: kind=MAINTENANCE, offer_id=None → 422 `appointment_requires_offer`
- Case B: kind=BREAKDOWN, offer_id=valid_uuid → 201
- Case C: kind=ACCIDENT, offer_id=None → 422
- Case D: kind=TOWING (varsayımsal — direct_request kullanılmaz) → atlanır

**Komut:**
```bash
cd naro-backend && uv run pytest tests/test_appointment_requires_offer_pure.py -v
```

**Commit:** `feat(appointments): require offer for non-tow appointments`

---

### F21 — Approval terminal state guard (~35 dk)

**Dosya:** [naro-backend/app/api/v1/routes/approvals.py:183-233](../naro-backend/app/api/v1/routes/approvals.py#L183)

- `request_approval_endpoint` ownership check'inden sonra ekle:
  ```python
  from app.domain.terminal_states import CASE_TERMINAL, CASE_SINK
  if case.status in CASE_TERMINAL or case.status in CASE_SINK:
      raise HTTPException(
          status_code=422,
          detail={"type": "case_terminal", "status": case.status.value},
      )
  ```
- Mevcut [terminal_states.py:20-28](../naro-backend/app/domain/terminal_states.py#L20) constant'larını kullan; duplicate enum literal yok.

**Test:** `naro-backend/tests/test_approval_terminal_guard_pure.py`
- COMPLETED case → POST /approvals → 422
- CANCELLED case → 422
- ARCHIVED case → 422
- SERVICE_IN_PROGRESS case → 201

**Commit:** `feat(approvals): block approval creation on terminal cases`

---

### F14.1 — Offer terminal state guard (~30 dk)

**Dosya:** [naro-backend/app/api/v1/routes/offers.py](../naro-backend/app/api/v1/routes/offers.py) (POST endpoint'i — Codex revize haritası §F14.1'de path bilgisi var)

- Offer creation öncesi case.status terminal check
- Aynı `CASE_TERMINAL + CASE_SINK` kullan

**Test:** `naro-backend/tests/test_offer_terminal_guard_pure.py`

**Commit:** `feat(offers): block offer creation on terminal cases`

---

### F14.2 — `list_cases_for_vehicle` soft-delete (~20 dk)

**Dosya:** [naro-backend/app/repositories/case.py:228-236](../naro-backend/app/repositories/case.py#L228)

- `list_cases_for_vehicle` query'sine `.where(ServiceCase.deleted_at.is_(None))` ekle.
- (Diğer `list_*` fonksiyonlar zaten yapıyor — drift düzeltme.)

**Test:** Mevcut `test_case_repo_pure.py` veya yeni `test_list_cases_for_vehicle_excludes_deleted_pure.py`.

**Commit:** `fix(case-repo): exclude soft-deleted cases from vehicle history`

---

### F6 — Pool feed IMMEDIATE filter (~30 dk)

**Dosya:** [naro-backend/app/repositories/case.py:130-190](../naro-backend/app/repositories/case.py#L130) (`list_pool_cases`)

- TestClient ile doğrula: IMMEDIATE tow oluştur → `GET /pool/feed` (CEKICI rolü) → görünüyor mu?
- Eğer görünüyorsa: query'ye LEFT JOIN `tow_cases` + `WHERE tow_cases.tow_mode != 'immediate' OR tow_cases IS NULL`. Scheduled tow da pool'a düşmemeli — onu da filter'a ekle.

**Test:** `naro-backend/tests/test_pool_feed_excludes_tow_dispatch_pure.py`
- IMMEDIATE tow case → CEKICI feed'de YOK
- SCHEDULED tow case → CEKICI feed'de YOK
- Non-tow MAINTENANCE case → USTA feed'de VAR

**Commit:** `fix(pool): exclude tow dispatch cases from pool feed`

---

### F3 — Tow capture regression test (~15 dk)

**Dosya:** `naro-backend/tests/test_tow_delivered_triggers_capture_pure.py`

- DELIVERED transition → capture_final çağrılır (mevcut davranış)
- Çift transition idempotent
- preauth_id yoksa skip

(Behavior değişikliği yok; sadece regression koruma.)

**Commit:** `test(tow): regression test for delivered → capture hook`

---

### Faz 1 Çıkış Kriteri

- 6 commit, hepsi pure test ile yeşil
- Codex'e bildirilir: "Faz 1 BE merged; FE Faz 1 (CTA cleanup) başlayabilir"

---

## 3. Faz 2 — Read-Model + Bildirim Altyapısı

**Süre:** ~3-4 saat
**Hedef:** Eşleşme ürün değerini gerçek kayıt haline getirmek.

### R2 — `CaseTechnicianMatch` (~2 saat)

**Yeni dosyalar:**
- `naro-backend/app/models/case_technician_match.py` — model
- `naro-backend/alembic/versions/20260426_NNNN_case_technician_match.py` — migration
- `naro-backend/app/services/match_compute.py` — V1 sade scoring
- `naro-backend/app/repositories/case_technician_match.py` — read-model query

**Model alanları (sözlük §6 + plan §4.2):**
```python
class CaseTechnicianMatch(Base):
    __tablename__ = "case_technician_matches"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    case_id: Mapped[UUID] = mapped_column(ForeignKey("service_cases.id", ondelete="CASCADE"))
    technician_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    score: Mapped[Decimal]  # 0.00-1.00
    reason_codes: Mapped[list[str]] = mapped_column(JSONB)  # ["service_domain_match", "city_match", ...]
    reason_label: Mapped[str | None]  # "Bu vakaya uygun" UI rozeti
    visibility_state: Mapped[MatchVisibilityState]  # candidate / shown_to_customer / hidden
    source: Mapped[str]  # "auto_compute" V1
    computed_at: Mapped[datetime]
    invalidated_at: Mapped[datetime | None]

    __table_args__ = (UniqueConstraint("case_id", "technician_user_id"),)
```

**V1 scoring sinyalleri (sade, opak değil):**
- provider_type / service_domain uyumu
- procedure/tag uyumu (varsa)
- city/district/radius uyumu
- availability (`available` ise +)
- verified_level
- basic performance_snapshot (rating > 4 ise +)

**Tetikleme:** case create sonrası `match_compute.refresh_for_case(case_id)` çağrılır (sync veya ARQ task).

**Test:** `test_match_compute_pure.py`
- service_domain mismatch → match yok
- city match + service_domain match → match var, score > 0.5
- duplicate compute → invalidated_at güncellenir, çift kayıt yok

**Commit serisi:**
1. `feat(matching): add CaseTechnicianMatch model + migration`
2. `feat(matching): match compute service v1`
3. `feat(matching): refresh on case create`

---

### F5A — `CaseTechnicianNotification` (~1.5 saat)

**Yeni dosyalar:**
- `naro-backend/app/models/case_technician_notification.py`
- `naro-backend/alembic/versions/20260426_NNNN_case_technician_notification.py`

**Model alanları (plan §4.3):**
```python
class CaseTechnicianNotification(Base):
    __tablename__ = "case_technician_notifications"

    id: Mapped[UUID]
    case_id: Mapped[UUID] = mapped_column(ForeignKey("service_cases.id", ondelete="CASCADE"))
    technician_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    customer_user_id: Mapped[UUID]
    status: Mapped[NotificationStatus]  # sent / seen / dismissed / offer_created / expired
    match_id: Mapped[UUID | None] = mapped_column(ForeignKey("case_technician_matches.id"))
    created_at: Mapped[datetime]
    seen_at: Mapped[datetime | None]
    responded_at: Mapped[datetime | None]

    __table_args__ = (UniqueConstraint("case_id", "technician_user_id"),)
```

**Endpoint'ler:**
- `POST /cases/{case_id}/notify-technicians` body `{technician_user_ids: [UUID]}` — case ownership + technician active validation; idempotent (UNIQUE constraint)
- `GET /technicians/me/notifications` — usta tarafı feed (status filter, paginated)

**case_events:** `CASE_NOTIFICATION_SENT` event type (mevcut `CaseEventType` enum'una ekle)

**Test:** `test_notify_technicians_pure.py`
- ownership: kendi vakası değilse 403
- duplicate guard: aynı technician'a ikinci notify → idempotent (no-op veya 200)
- terminal case: COMPLETED/CANCELLED → 422

**Commit serisi:**
1. `feat(notifications): CaseTechnicianNotification model + migration`
2. `feat(notifications): POST /notify-technicians endpoint`
3. `feat(notifications): GET /technicians/me/notifications endpoint`

---

### Pool feed match/notification context (~30 dk)

**Dosya:** [naro-backend/app/api/v1/routes/pool.py](../naro-backend/app/api/v1/routes/pool.py) + [repositories/case.py:130-190](../naro-backend/app/repositories/case.py#L130)

`GET /pool/feed` response'a alanlar ekle:
- `is_matched_to_me: bool`
- `match_reason_label: str | None`
- `match_badge: str | None`  ("Bu vakaya uygun")
- `is_notified_to_me: bool`
- `has_offer_from_me: bool`

Query: subquery'ler ile match + notification + offer join (technician_user_id == current_user.id).

**Test:** `test_pool_feed_match_context_pure.py`
- match var, notification yok → flag'ler doğru
- notification var, offer yok → flag'ler doğru
- offer var → has_offer_from_me=true

**Commit:** `feat(pool): expose match/notification context in feed`

---

### Faz 2 Çıkış Kriteri

- Match + notification + pool feed context yeşil
- Codex'e: "Faz 2 BE merged; FE Faz 2 (uygun usta bandı + bildirim CTA + 'size bildirildi' rozet) başlayabilir"

---

## 4. Faz 3 — `case_dossier` API Contract

**Süre:** ~2 saat

**Endpoint:** `GET /cases/{case_id}/dossier` (yeni) veya mevcut detail response içinde `dossier` field (tercih: ayrı endpoint, role-safe redaction temiz olur).

**Response içeriği (plan §4.1):**
- case shell (id, kind, status, urgency, wait_state, origin)
- vehicle snapshot
- kind-specific subtype detail
- attachments / evidence / documents
- matches (list — `is_matched_to_me` perspektifiyle filtrelenir)
- notifications (list — sadece kendi notification'ları technician için)
- offers (list)
- appointment (varsa)
- assignment (varsa — assigned_technician_id set ise)
- approvals (list)
- payment snapshot
- tow snapshot (yalnız towing kind ise)
- timeline summary (son N event)

**Role-safe redaction:**
- Customer view: kendi vakası, full detail
- Technician pool view: PII-safe (plate/vin/açık adres yok), match context dahil
- Assigned technician view: genişletilmiş detail (vehicle full + customer iletişim — sözlük §13 PII kuralı saklı)

**Test:** `test_case_dossier_pure.py`
- customer kendi vakasının dossier'ını görür
- başka customer'ın vakasını göremez (404)
- pool'da gezen technician PII redacted dossier görür
- assigned technician genişletilmiş detail görür

**Dosya:**
- `naro-backend/app/api/v1/routes/case_dossier.py` (yeni)
- `naro-backend/app/schemas/case_dossier.py` (response model)

**Commit:** `feat(case): GET /cases/{id}/dossier role-safe contract`

---

## 5. Faz 4 — Workflow Source-of-Truth

**Süre:** ~1.5-2 saat

### F4 — 3 eksik blueprint seed

**Dosya:** [naro-backend/app/services/workflow_seed.py:62-151](../naro-backend/app/services/workflow_seed.py#L62)

3 template ekle (plan §5 Faz 4 + genişletilmiş §8.1 pattern'ları):

- **BREAKDOWN_STANDARD:** kabul → ön teşhis → kapsam netleşti → onarım → test edildi → teslim raporu (5-6 milestone) + 1 completion approval
- **TOWING_IMMEDIATE:** ödeme/preauth → searching → accepted → en_route → arrived → loading → in_transit → delivered (TowDispatchStage paralel) + 1 milestone (teslim_edildi) + 1 completion approval
- **TOWING_SCHEDULED:** scheduled_waiting → payment_window → payment_required → ... (immediate ile aynı dispatch) + 1 milestone + 1 completion

**Test:** `test_workflow_seed_pure.py`
- 4 olağan kind'ın seed'i çalışıyor (regression)
- 3 yeni kind seed'i çalışıyor
- `resolve_blueprint(BREAKDOWN_STANDARD)` `UnknownBlueprintError` raise etmiyor

**Commit:** `feat(workflow): seed BREAKDOWN_STANDARD + TOWING_IMMEDIATE/SCHEDULED templates`

### Tracking engine kontrolü

Frontend `mobile-core/tracking-engine` (varsa) BE blueprint çıktısını okumalı; canonical karar üretmemeli. Bu daha çok FE işi; BE tarafında resolver'ın tam dolu çıktığını test ederiz.

---

## 6. Faz 5 — Approval Dili + Description Validator

**Süre:** ~45 dk

### F2 BE — `description` zorunluluğu kind=PARTS_REQUEST/INVOICE

**Dosya:** [naro-backend/app/api/v1/routes/approvals.py:188 ApprovalRequestPayload](../naro-backend/app/api/v1/routes/approvals.py#L188)

```python
from pydantic import model_validator

class ApprovalRequestPayload(BaseModel):
    kind: CaseApprovalKind
    description: str | None = None
    # ...

    @model_validator(mode="after")
    def _require_description_for_scope_revision(self) -> "ApprovalRequestPayload":
        if self.kind in (CaseApprovalKind.PARTS_REQUEST, CaseApprovalKind.INVOICE):
            if not self.description or len(self.description.strip()) < 10:
                raise ValueError("description_required")
        return self
```

**Dosya:** [naro-backend/app/services/case_billing.py:333 handle_parts_approval](../naro-backend/app/services/case_billing.py#L333)
- Signature'a `reason: str` ekle (description'dan geçirilir); `request_payload`a kayıt yap
- Mevcut `additional_amount` field'ı **rename edilmez** — Faz 6'ya bırak

**Test:** `test_parts_approval_requires_description_pure.py`
- kind=PARTS_REQUEST + description=None → 422
- kind=PARTS_REQUEST + description="too short" (< 10 char) → 422
- kind=INVOICE + description="Detaylı kapsam değişikliği gerekçesi" → 201
- kind=COMPLETION + description=None → 201 (completion gerekçe gerektirmez)

**Commit:** `feat(approvals): require description for parts_request/invoice scope revisions`

---

## 7. Faz 6 — Naming Cleanup (DAVRANIŞ STABIL OLDUKTAN SONRA)

**Süre:** ~1 saat

**Önkoşul:** Faz 1-5 tüm pure testleri yeşil; smoke (Faz 7) yapıldı.

### `additional_amount` → `revision_amount` rename (BE)

- Alembic migration: column rename + index rename (varsa)
- Pydantic schema rename
- service layer rename
- Test fixtures update
- Compat: hiç kalan yok mu kontrol — `rg "additional_amount" naro-backend/app naro-backend/tests`

**Test:** mevcut `test_case_billing_pure.py` adapt + yeni `test_revision_amount_migration_pure.py`

**Commit:** `refactor(billing): rename additional_amount → revision_amount`

### `bid` kalıntıları temizlenir

```bash
rg "\\bbid\\b" naro-backend/app
```
Bulunursa `offer` ile değiştir veya yorum/test fixture olarak işaretle.

---

## 8. Faz 7 — Smoke + Audit

### Backend smoke (TestClient + DB)

```bash
cd naro-backend
uv run pytest tests/test_case_create_schema.py tests/test_case_create_service.py
uv run pytest tests/test_tow_dispatch.py tests/test_payment_core_pure.py
uv run pytest tests/  # tam suite
uv run ruff check app tests
```

### Naming uyum gate

```bash
rg -n "extra_payment|additional_payment" naro-backend/app  # boş olmalı
rg -n "additional_amount" naro-backend/app  # Faz 6 sonrası boş olmalı
rg -n "\\bbid\\b" naro-backend/app  # boş veya yorum/legacy
```

### Audit hazırlığı

Codex BE'yi inceleyecek; ben FE'yi inceleyeceğim. Audit dokümanı: `docs/audits/2026-04-2X-case-refactor-be-audit.md` (sonradan yazılır).

---

## 9. Codex ile Koordinasyon Noktaları

| Aşama | BE eylem | FE bekleme noktası |
|---|---|---|
| Faz 1 sonrası | F1+F21+F14.1+F14.2+F6 merged | FE Faz 1 (CTA cleanup) başlar |
| Faz 2 sonrası | match + notification + pool feed merged | FE Faz 2 (uygun usta bandı, bildir CTA, rozet) başlar |
| Faz 3 sonrası | `/dossier` endpoint live | FE Faz 3 (vaka profil sayfası) başlar |
| Faz 5 sonrası | description validator + approval dili contract | FE Faz 5 ("Kapsam onayı/Final fatura" copy) tamamlanır |
| Faz 7 öncesi | tüm BE merged + smoke yeşil | FE smoke başlar (cross-app) |

**Kontrat commit'leri (FE'den önce push):**
- ApprovalRequestPayload schema (Faz 5)
- POST /notify-technicians payload + response schema (Faz 2)
- GET /pool/feed yeni alanlar (Faz 2)
- GET /cases/{id}/dossier response model (Faz 3)

---

## 10. Süre Toplamı

| Faz | İş | Süre |
|---|---|---|
| 1 | Davranış guard'ları (F1+F21+F14.1+F14.2+F6+F3) | ~2.5-3 sa |
| 2 | Read-model + bildirim (R2 + F5A + pool context) | ~3-4 sa |
| 3 | case_dossier API | ~2 sa |
| 4 | Workflow blueprint seed (F4) | ~1.5 sa |
| 5 | Description validator (F2 BE) | ~45 dk |
| 6 | Naming cleanup (rename + bid) | ~1 sa |
| 7 | Smoke + audit hazırlık | ~30 dk |
| **Toplam** | | **~11-13 sa** |

Faz 1-3 öncelikli; Faz 4-7 sonrasında devam.

---

## 11. Doğrulama Özeti

Her faz sonunda kontrol:

```bash
# Test
cd naro-backend && uv run pytest tests/

# Lint
uv run ruff check app tests

# Migration sanity
uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head

# Naming gate (Faz 6+)
rg -n "extra_payment|additional_payment|additional_amount" app
```

Smoke (Faz 7):
- Customer akışı: vaka oluştur → uygun ustalar → bildir → teklif al → kabul → randevu → ödeme → süreç
- Servis akışı: notified/matched feed → teklif gönder → randevu onayla → süreç → completion
- Tow immediate: ödeme → dispatch → tracking → delivered → capture
- Tow scheduled: scheduled_waiting → payment window → payment → dispatch
