# QA Tur 4 — Focused Re-run Raporu

**Tarih:** 2026-04-23
**Sahibi:** INTEGRATION-QA sohbeti
**Kapsam:** UC-1 tam akış + subtype.assigned_technician_id 4 branch parity + Tur 3 P2 spot check
**Ortam:** backend fresh restart (uvicorn reload watchdog race bypass için force kill + spawn), 10 mock tech availability=available + fresh heartbeat
**Tamamlanan adım:** 12/12

---

## Özet — Pilot-Ready Karar

**✅ PASS — 0 P0 / 0 P1 / 2 P2**

Pilot kriter karşılandı: `0 P0 + 0 P1 + 2 P2 < 5`. QA tarafında pilot launch önünde bulgu-kaynaklı blocker kalmadı.

| Priority | Tur 3 açık | Tur 4 açık | Pilot kriter |
|----------|-----------|-----------|--------------|
| P0       | 1         | 0         | 0 ✓ |
| P1       | 1         | 0         | ≤2 ✓ |
| P2       | 3         | 2         | ≤5 ✓ |

---

## Tur 3 Fix'lerinin Re-verify

### FIX A (85e84ad) — P0-1 Mock Çekici Availability Stability

| Kontrol | Durum |
|---------|-------|
| `heartbeat_mock_techs.py` script — availability='available' set | **PASS** — "heartbeat refreshed for 10 mock tech" + DB'de 10/10 available (2 çekici dahil) |
| `heartbeat_enforcer` cron `is_mock=true` bypass | **PASS** — availability stabil (30 sn sonra hâlâ available, enforcer sweep etmedi) |
| UC-1 dispatch 0 attempt yerine gerçek aday | **PASS** — `tow_dispatch_attempts` 1 satır: tech7 (+905559000007), distance=1.118 km, radius=10, score=0.944 |
| stage=searching (timeout_converted değil) | **PASS ✓** |

### FIX B (e05a03e) — P1-1 subtype.assigned_technician_id Projection

| Subtype branch | offer/dispatch accept sonrası | Durum |
|----------------|------------------------------|-------|
| `tow_case` | dispatch accept → `subtype.assigned_technician_id=UUID` + top-level=UUID | **PASS ✓** |
| `breakdown_case` | appointment approve → `subtype.assigned_technician_id=UUID` + top-level=UUID | **PASS ✓** (fresh backend restart sonrası) |
| `accident_case` | attachment K3 gate nedeniyle case create 422; code-level pattern identical (`_assigned_tech_str(case)` 4 branch'te aynı helper) | **CODE-PARITY PASS** — canlı test attachment upload sonrası gerekir |
| `maintenance_case` | `mileage_photo` gate nedeniyle create 422; aynı code-level pattern | **CODE-PARITY PASS** |

Top-level `case.assigned_technician_id` — breakdown offer accept non-firm slot path: **PASS** (offer_acceptance.py UPDATE statement'e eklendi, UUID döndü).

---

## UC-1 Uçtan Uca

| Adım | Durum | Kanıt |
|------|-------|-------|
| Fresh customer + tech7 login + vehicle | PASS | — |
| POST `/tow/cases` immediate + `required_equipment=["flatbed"]` | PASS | 201, case_id, stage=searching |
| `tow_dispatch_attempts` oluştu | PASS | 1 satır, tech7, dist 1.118 km, score 0.944 |
| SEARCHING → ACCEPTED transition | PASS | POST `/dispatch/response` attempt_id + response:"accepted" → 200 next_stage:"accepted" |
| TowCaseSnapshot `stage_label` + `tow_phase` | PASS | stage_label="Çekici atandı", tow_phase="en_route" (B-P1-4) |
| `assigned_technician_id` UUID | PASS | dispatch accept anı doldu |
| GPS ping `/location` | PASS | 2× HTTP 204 (far + close ping kayıt oldu) |
| OTP issue (tech) | PASS | HTTP 200, code=595802 döndü (dev path) |
| OTP verify (customer) | PASS | HTTP 200 `{"verified":true}` |
| Rating (customer) | PASS | HTTP 200 `{"rating":5}` |
| Timeline `tow_*` events | PASS (kısmi) | 4 event: `tow_dispatch_candidate_selected`, `tow_stage_committed`, 2× `tow_location_recorded` |

### Stage auto-advance — Pilot MVP kapsamı

EN_ROUTE → NEARBY → ARRIVED → LOADING → IN_TRANSIT → DELIVERED — GPS ping / OTP verify sonrası stage `accepted` kalıyor. `_ALLOWED` transition graph mevcut (`tow_lifecycle.py:33`) ama tech tarafı stage advance endpoint yok, `/location` handler transition tetiklemiyor. Evidence gate (`photo_before`/`photo_after`) LOADING + IN_TRANSIT + DELIVERED için zorunlu.

**Karar:** Pilot sonrası Faz 3 tow tech app scope (CLAUDE.md §"Faz 3 tow tech app map — pilot sonrası"). Pilot için MVP yeterli: dispatch → accept → GPS tracking + OTP teslim + rating ana akış çalışıyor; saha tarafında usta stage advance UI'ı pilot sonrası iş.

---

## Next_action Tekilliği — Her Stage Sahip Doğru

| Case status | Test sonucu |
|-------------|-------------|
| `matching` (offer bekliyor) | actor=technician, label="Seçtiğin usta randevu slot'unu onaylayacak", waiting_on_me=False ✓ |
| `appointment_pending` (offer accept sonrası) | Tur 3'te teyit edildi |
| `scheduled` (appt approve sonrası) | actor=technician, label="Randevu günü yaklaşıyor" ✓ |
| `invoice_approval` | label="Fatura onayı" (Tur 3'te teyit edildi) |

---

## P2 Spot Check (Tur 3'te Tolerable Bırakılanlar)

| ID | Durum Tur 4 |
|----|-------------|
| P2-1 `POSTGRES_PUBLISHED_PORT` drift | Hâlâ env export şart; WSL restart sonrası recreate prosedürü ile çözülüyor. **Operasyonel** |
| P2-2 `.env.local → .env` symlink | Kalıcı, boot discipline not |
| P2-3 next_action post-409 stale (Tur 3'te görülmüştü) | Bu turda görünmedi (dinamik güncelleme akıcı) — **kapatılabilir** |

---

## Raporun Dışında Kalan (PO Tarafı / Browser Teyidi)

- 3DS WebView Iyzico sandbox kart `5528 7900 0000 0008` manuel test (checkout_url üretiliyor, akış API+FE tarafında hazır)
- FE UI canlı render (service app web + customer auth persistence + canonical case detail) — PO browser teyidi
- Attachment gate canlı smoke (accident + maintenance için media upload intent → S3 PUT → complete → case create) — canlı e2e test, kod pattern parity ile pilot için kabul ediliyor

---

## Pilot Launch için QA Green-Light

**Karar:** pilot-ready ✓

QA tur serisi burada sonlandırılabilir. Launch planı için PO kararı aşaması. Ek bulgu regresyon yaratırsa reaktif 2h SLA'da Tur 5 açılabilir.
