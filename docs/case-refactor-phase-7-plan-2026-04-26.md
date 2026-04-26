# Faz 7 — Yeşil Baseline ve Smoke Runbook Planı

Tarih: 2026-04-26

Referanslar:

- `docs/naro-vaka-omurgasi.md`
- `docs/naro-domain-glossary.md`
- `docs/case-refactor-plan-2026-04-26.md`
- `docs/case-refactor-backend-execution-2026-04-26.md`

## 1. Bağlam

Vaka omurgası refactor zinciri şu noktaya geldi:

- `b3aa0e8` — dokümantasyon preflight
- `0063895` — offer'sız randevu guard, direct request CTA temizliği, workflow/tow ilk düzeltmeler
- `96cb9a8` — `CaseTechnicianMatch` revizyonu
- `ff5dde8` — terminal guard'lar, soft-delete filtre, tow capture helper
- `34c3104` — role-safe `case_dossier` API
- `3b14bc8` — dossier audit boşlukları
- `a3c60b3` — approval description validator + reason
- `02a3589` — `additional_amount -> revision_amount`, legacy `bid` temizliği

Faz 7'nin amacı yeni ürün davranışı eklemek değil; backend test/lint baseline'ını yeşile çekmek ve manuel smoke doğrulaması için tek, tekrar edilebilir runbook üretmektir.

## 2. Failure Kök Nedenleri ve Fix Yaklaşımı

### F7.1 — PSP factory test ortamdan Iyzico okuyor

Trace:

```text
FAILED tests/test_billing_orchestrator_pure.py::test_get_psp_factory_switch
assert isinstance(psp, MockPsp)
E assert False
E where False = isinstance(<IyzicoPsp ...>, MockPsp)
```

İlgili yerler:

- `tests/test_billing_orchestrator_pure.py::test_get_psp_factory_switch`
- `app/api/v1/routes/billing.py::_get_psp`
- `app/core/config.py::Settings`

Kök neden:

- Test `PSP_PROVIDER` env'ini silerek mock path bekliyordu.
- `Settings` `.env` okumaya devam ettiği için lokal sandbox Iyzico değerleri teste sızıyordu.
- Sorun ürün kodu değil, test izolasyonuydu.

Fix:

- Mock branch'te env açıkça `PSP_PROVIDER=mock`, `IYZICO_API_KEY=""`, `IYZICO_SECRET_KEY=""` olarak set edilir.
- Iyzico branch'te test key'ler açıkça set edilerek gerçek factory switch korunur.
- Her branch öncesi `get_settings.cache_clear()` çalışır.

### F7.2 — Media smoke worker job enqueue ediyor ama worker koşmuyor

Trace:

```text
FAILED tests/test_media_smoke.py::test_media_worker_generates_preview_variants
assert stored_asset.status == MediaStatus.READY
E AssertionError: processing != ready
```

İlgili yerler:

- `tests/test_media_smoke.py`
- `app/services/media.py::_enqueue_processing_job`
- `app/workers/media.py::process_media_asset`

Kök neden:

- Upload sonrası image asset Redis/ARQ job olarak enqueue ediliyor.
- Test ortamında gerçek worker process çalışmadığı için asset `PROCESSING` durumunda kalıyordu.
- Worker inline çağrıldığında ayrıca gerçek bir bug ortaya çıktı: worker preview/thumb yazıyor ama DB transaction commit etmediği için `READY` state rollback oluyordu.

Fix:

- Smoke test worker fonksiyonunu deterministik şekilde `process_media_asset({}, asset_id)` ile çağırır.
- Worker success ve failure state update'lerinden sonra session commit eder.
- Böylece hem test deterministik olur hem gerçek background worker DB state'i kalıcı yazar.

### F7.3 — Public showcase full-suite order dependent görünüyor

Trace:

```text
FAILED tests/test_case_public_showcases_integration.py::test_completion_showcase_publishes_after_dual_consent
RuntimeError: Task ... got Future ... attached to a different loop
RuntimeError: Event loop is closed
```

Ek doğrulama:

```text
uv run pytest tests/test_case_public_showcases_integration.py::test_completion_showcase_publishes_after_dual_consent -q
1 passed
```

İlgili yerler:

- `tests/test_case_public_showcases_integration.py`
- `tests/conftest.py`
- `app/db/session.py`
- `pyproject.toml`

Kök neden:

- `pytest-asyncio` test loop scope'u function olarak çalışıyordu.
- Global SQLAlchemy async engine / asyncpg pool farklı test event loop'ları arasında taşınınca full-suite cross-loop hatası oluşuyordu.
- Showcase testi izole geçtiği için ürün assertion'ı değil, test loop lifecycle sorunu olduğu doğrulandı.

Fix:

- `pyproject.toml` altında async fixture ve test loop scope'u session olarak sabitlendi:

```toml
asyncio_default_fixture_loop_scope = "session"
asyncio_default_test_loop_scope = "session"
```

## 3. Yeşil Baseline Kuralı

Faz 7 kabul kuralı:

- Backend full test suite yeşil.
- Ruff temiz.
- Naming gate temiz.
- Vaka omurgası davranışları geri alınmaz:
  - offer'sız appointment yok,
  - immediate/scheduled tow pool/offer sistemine sızmaz,
  - `additional_amount` / `bid` / `extra_payment` dili aktif yüzeye dönmez.

Çalıştırılacak gate'ler:

```bash
cd naro-backend
uv run ruff check app tests
uv run pytest tests/ -v --tb=short
```

Repo kökünden naming gate:

```bash
rg -n "extra_payment|additional_payment|additional_amount|\\bbid\\b" \
  naro-app/src naro-service-app/src naro-backend/app
```

İsteğe bağlı cross-app typecheck:

```bash
pnpm --filter naro-app exec tsc --noEmit --pretty false
pnpm --filter naro-service-app exec tsc --noEmit --pretty false
```

Faz 7 sonunda doğrulanan backend sonuç:

```text
468 passed, 18 skipped, 1 warning
All checks passed!
```

## 4. Smoke Runbook

Manuel smoke doğrulaması ayrı dosyada tutulur:

- `docs/case-refactor-smoke-runbook-2026-04-27.md`

Runbook beş ana senaryoyu kapsar:

1. Customer case -> uygun usta -> vakayı bildir -> teklif
2. Offer accept -> appointment -> service process
3. Immediate tow
4. Scheduled tow payment window
5. Ek ödeme yokluğu / kapsam-fatura onayı

Her senaryo şu formatta yazılır:

- setup,
- kullanıcı adımları,
- beklenen state geçişi,
- DB kanıtı,
- fail sayılacak belirtiler.

## 5. Commit Dilimi

Önerilen ayrım:

1. `chore(backend): restore ruff baseline`
   - yalnız import order / unused import.
2. `fix(test): restore green backend baseline`
   - PSP test izolasyonu,
   - media worker commit + deterministic smoke,
   - pytest async loop scope.
3. `docs(case): add phase-7 smoke runbook`
   - Faz 7 planı ve smoke runbook.

Pratikte küçük repo akışı için bunlar tek commit altında da toplanabilir:

```text
fix(case): restore phase-7 backend baseline
```

Tek commit seçilirse commit body içinde test sonucu mutlaka yazılmalıdır.

## 6. Açık Karar Noktaları

PO kararı gerektiren yeni ürün konusu yoktur.

Varsayımlar:

- PSP smoke dev'de mock/sandbox ile koşar; gerçek prod ödeme testi bu fazda yoktur.
- Media smoke gerçek worker process başlatmaz; worker fonksiyonu test içinde deterministik çağrılır.
- Showcase ürün assertion'ı değiştirilmez; sadece async test lifecycle stabilize edilir.
- Manuel smoke mevcut Android cihaz ve seeded dev kullanıcıları ile yapılır.
