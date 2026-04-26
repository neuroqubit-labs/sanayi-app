# Case Refactor FE Self-Audit — Faz 10 (Claude)

**Tarih:** 2026-04-26
**Yöntem:** Refactor zinciri (`b3aa0e8` → `26152e6`) sonrası FE perspektifinden vaka omurgasının kodda canonical olarak yaşadığını doğrulamak.
**Kapsam:** Codex'in [BE self-audit'i](2026-04-26-case-refactor-be-self-audit.md) backend tarafını kapatıyor; bu doküman frontend tarafını kapatır. İkisi birlikte refactor kapanışıdır.
**Karşı referanslar:** [naro-vaka-omurgasi.md](../naro-vaka-omurgasi.md), [naro-vaka-omurgasi-genisletilmis.md](../naro-vaka-omurgasi-genisletilmis.md), [naro-domain-glossary.md](../naro-domain-glossary.md), [case-dossier-contract-2026-04-26.md](../case-dossier-contract-2026-04-26.md), [omurga-drift-audit](2026-04-26-case-refactor-omurga-drift-audit.md).

---

## Executive Summary

FE açısından vaka omurgası canonical sözleşmeye bağlandı:
- `case_dossier` Zod kontratı ve `useCaseDossier` hook müşteri ve servis profil ekranlarını besliyor.
- Tracking engine workflow karar üretmeyi bıraktı; backend `workflow_blueprint` + `milestones`/`tasks` doğrudan presentation layer'a iniyor.
- Composer 4 akışı anlatı §2.2 ilkesine ("basitten zora, karardan açıklamaya") oturdu.
- 3 viewer profili (customer / pool_technician / assigned_technician) UI'da farklılaştı; PII redaction + competitor average + "Size bildirildi" rozeti UI'da görünür.
- Naming gate FE aktif yüzeylerde temiz; yalnız `direct_request` compat enum kalıntısı (sözlük §21 izinli).

**Sonuç:** FE de "ürün omurgası" yönünden doğru hatta. Kalan FE riskler **ikinci katman borçlar**: mock store kalıntısı (live route'lara karar üretmiyor), tow misc snapshot storage, eski customer/service profile ekran kalıntıları (legacy adapter `useCanonicalCase` deprecated marked).

### Codex düzeltme notu — matching CTA gerçek durumu

Bu audit ilk yazıldığında "Vakayı bildir" tarafı fazla iyimser kapanmıştı. Cihaz smoke sırasında şu drift görüldü: public usta profilinde FE, backend match sözleşmesi yerine gevşek profil/provider yorumuyla CTA gösterebiliyordu. Aşağıdaki düzeltmeler sonradan eklendi:

- `db4f370` — `case_dossier.matches[]` gerçek usta kartı alanları ve `can_notify / notify_state` taşır.
- `5ee2dd5` — `case_service_tags` + `technician_vehicle_kind_coverage` read-model eklendi; bakım/arıza typed seçimleri ve araç türü matching'in girdisi oldu.
- `d1adb97` — Customer case profile ve public usta preview, `Vakayı bildir` kararını yalnız dossier match üzerinden verir.
- `59465c2` — Bakım/arıza composer'da çekici sorusu explicit karar haline geldi; default `false` submit yolu kapandı.
- `d12d9ef` — Service pool kartı `has_offer_from_me` ile tekrar teklif CTA'sını kilitler.

Güncel sonuç: `Vakayı bildir` artık public profile'ın kendi tahminiyle değil, aktif vaka + backend match contract'ı ile çalışır. Kalan açık: customer home'daki genel "uygun usta" bandının hangi aktif vaka context'iyle besleneceği ayrıca cihaz smoke sonrası keskinleştirilmeli.

---

## 1. `case_dossier` Adapter Doğruluğu

| Kontrol | Kod kanıtı | Sonuç |
|---|---|---|
| Domain Zod 16 alan + 4 KindDetail discriminator + ViewerContext (3 ürün karar alanı: other_match_count + competitor_offer_average + competitor_offer_count) | `packages/domain/src/case_dossier.ts` 433 satır; `z.discriminatedUnion("kind", [...])` | ✅ |
| `useCaseDossier` hook (TanStack Query) | `packages/mobile-core/src/api/case_dossier.ts` | ✅ |
| Parse parity test (BE Pydantic → JSON → FE Zod round-trip) | `packages/mobile-core/src/api/case_dossier.test.ts` 171 satır | ✅ |
| `useCanonicalCase` legacy/deprecated marking | `naro-app/.../hooks/useCanonicalCase.ts:42 @deprecated V1.1 legacy adapter...` | ✅ |
| BE Pydantic `CaseDossierResponse` ↔ FE Zod alan eşleşmesi | shell + vehicle + kind_detail + matches + notifications + offers + appointment + assignment + approvals + payment_snapshot + tow_snapshot + milestones + tasks + timeline + viewer | ✅ |

**Sonuç:** Adapter katmanı canonical. Sözlük §1 `case_dossier` API ↔ `case_profile` UI ayrımı korunuyor.

---

## 2. 3 Viewer Profili UI Farklılaşması

Anlatı §2.1 + sözlük §1 + dossier contract §4 redaction matrisi.

| Alan | customer | pool_technician | assigned_technician | Kod kanıtı |
|---|---|---|---|---|
| `viewer.role` discriminator | ✅ | ✅ | ✅ | `naro-service-app/.../CaseProfileScreen.tsx:67 isAssigned`, `:114 + :358 + :466 pool_technician branch` |
| `vehicle.plate` (mask vs clear) | clear | mask `34*** 1234` | clear | BE redact + FE render |
| `offers[*].amount` (rakip mask) | tüm clear | yalnız kendi clear | tüm clear | BE redact + FE render |
| `competitor_offer_average` UI | gizli | "Rakip ortalaması ₺X" | gizli | `CaseProfileScreen.tsx:260 + :393` |
| `other_match_count` notu | yok | "+X uygun usta var" | yok | `CaseProfileScreen.tsx:381-383` |
| `is_notified_to_me` rozet | yok | "Size bildirildi" badge | yok | `PoolReelsCardLive.tsx:130-131` + `CaseProfileScreen.tsx:360-361` |
| `tasks` listesi | görünür | `[]` boş | görünür | BE redact tasks=[] (line 120) |
| `milestones` listesi | görünür | görünür | görünür | BE her zaman dolu |

**Sonuç:** 3 viewer profili UI'da farklılaşıyor. PII redaction + competitor average dossier kontratıyla birebir.

---

## 3. State Mapping (case.status / tow_stage / approval payment_state)

Sözlük §11 + §15-§15.2 — UI bu üç katmanı karıştırmamalı.

| Kontrol | Sonuç |
|---|---|
| `tow_stage` direkt enum render (case.status üzerinden tahmin yok) | ✅ `naro-app/.../tow/presentation.ts` `getTowStagePresentation(stage: TowDispatchStage)` |
| `tow_stage = no_candidate_found` UI'da "Aday çekici bulunamadı" + retry CTA | ✅ Faz 8 cf7a7f9'da customer + service tow ekranlarına eklendi |
| Approval `payment_state` ile `case.status=invoice_approval` ayrı katman | ✅ FE approval sheet `payment_state` enum'undan render |
| Tow snapshot pickup/dropoff district-level (pool view) | ✅ BE redact `mask_location_to_district` |

**Sonuç:** State katmanları UI'da karışmıyor. Sözlük §11 audit sorusu (Adım 2/10) kapanış sonrası FE de PASS.

---

## 4. Composer §2.2 Anlatı İlkesi

"Basitten zora, somuttan soyuta, karardan açıklamaya gidilir."

| Tip | İlk adım | Açıklama yeri | Adım sayısı | Kod kanıtı | Sonuç |
|---|---|---|---|---|---|
| **Accident** | emergency_panel(910) → accident_kind(919) → report(946) → photos(954) → documents(970) → insurance(978) → review(994) | Insurance step (Adım 6) | 7 | `AccidentFlow.tsx` line numaraları | ✅ Photos 2→4 reorder (Faz 8 cf7a7f9) |
| **Breakdown** | category → drivable → media → service+description → review | LogisticsStep (Adım 4) | 5 | `BreakdownFlow.tsx:144 VehicleStateStep` description input yok; `:400 LogisticsStep` description'ı taşıdı | ✅ |
| **Maintenance** | category (manuel ileri) → detail → media → logistics → review | Detail/notes adımı | 5 | `MaintenanceFlow.tsx` `goNext()` + `hideFooter` 0 grep hit | ✅ |
| **Towing** | location → drivable → timing → review | review öncesi | 4 | Anlatıya zaten uygundu | ✅ |

**Sonuç:** 4 composer akışı anlatı §2.2 ilkesine oturdu. OM-14 audit bulgusu kapandı.

---

## 5. Tracking Engine BE'ye İndirildi (F18 FE)

Sözlük §22 #3 + omurga-drift-audit OM-08.

| Kontrol | Kod kanıtı | Sonuç |
|---|---|---|
| `determineBlueprint()` FE karar üretiyor | grep `engine.ts` 0 hit | ✅ Silindi |
| `buildMilestones()` 4 hardcoded variant | grep 0 hit | ✅ Silindi |
| `buildTasks()` switch/case decision tree | grep 0 hit | ✅ Silindi |
| FE workflow → backend response presentation | `engine.ts` `caseItem.workflow_blueprint` + `caseItem.milestones`/`tasks` | ✅ |
| Service-app `workflowBlueprintFor()` | grep 0 hit | ✅ Silindi (Faz 9 632e09a — OM-09 kapandı) |

**Sonuç:** Tracking engine canonical karar üretmeyi bıraktı; BE source-of-truth presentation layer'da yorumlanıyor. OM-08 + OM-09 kapandı.

---

## 6. Naming Gate FE

Sözlük §0.2 + §21 yasak terim listesi.

```bash
rg -n "extra_payment|additional_payment|additional_amount|\bbid\b" \
   naro-app/src naro-service-app/src packages
```

**Sonuç:** 0 hit. `direct_request` compat enum yalnız mevcut iki noktada (sözlük §21 izinli):
- `naro-app/src/features/appointments/schemas.ts:28` — Zod compat
- `naro-backend/app/models/appointment.py:41` — Pydantic compat

Aktif customer/service yüzeyinde yasak terim yok.

---

## 7. Mock vs Live Ayrımı

Sözlük §14 + audit OM-04. 15 dosyada mock/fixture izi var; aktif route'larda canlı karar üretmedikleri kontrol edildi:

| Dosya | Tip | Aktif live route'ta karar üretiyor mu? |
|---|---|---|
| `naro-app/src/runtime.ts` + `naro-service-app/src/runtime.ts` | dev fallback | yalnız dev/test mode |
| `*/src/shared/lib/mock.ts` | helper | live import yok |
| `naro-service-app/src/features/jobs/api.mock.ts` | mock adapter | service-live-gate ile izole |
| `naro-app/src/features/ustalar/api.ts`, `search/SearchScreen.tsx`, `profile/Profile*.tsx` | seed data | UI fallback, live data öncelikli |
| `naro-service-app/src/features/technicians/profile-store.ts`, `notifications/api.ts`, `profile/ProfileManagementHub.tsx` | dev seeding | live data öncelikli |
| `naro-service-app/src/features/tow/screens/TowActiveJobScreen.tsx` | legacy demo | route'tan değil; `TowActiveJobScreenLive.tsx` aktif |

**Sonuç:** Mock/fixture kalıntıları **dev/seed seviyesinde**, live route karar üretmiyor. İkinci katman borç (V1.1 cleanup).

---

## 8. OM-01 → OM-18 FE Statü (özet)

Codex'in BE self-audit OM listesini FE perspektifinden yorumlama:

| OM | Konu | FE statüsü |
|---|---|---|
| OM-01 | request_draft matching | ✅ BE'de fix; FE etki yok |
| OM-02 | tow misc request_draft mutasyon | 🟡 V1.1 borç (kasko/rating typed tablo) |
| OM-03 | offer'sız appointment | ✅ BE 422 + FE CTA cleanup |
| OM-04 | direct_request compat | ✅ FE Zod compat izin |
| OM-05/06 | tow pool dışlama + saf dispatch | ✅ FE schema `no_candidate_found` + retry copy |
| OM-07 | tow offer endpoint | ✅ BE 422; FE'de tow offer composer zaten yok |
| OM-08 | tracking engine workflow | ✅ FE silinmiş, BE response'a bağlandı |
| OM-09 | service `workflowBlueprintFor` | ✅ Silindi (Faz 9) |
| OM-10 | dossier milestones/tasks | ✅ BE genişletme + FE Zod parse |
| OM-11 | profile ekranları dossier okuma | ✅ Customer + Service `useCaseDossier` (Faz 9) |
| OM-12 | notify match-less | ✅ BE fix; FE etki yok |
| OM-13 | customer showcase revoke | ✅ BE endpoint var; FE'de "geri çek" CTA → V1.1 (kapsam dışı) |
| OM-14 | composer §2.2 | ✅ 3 flow reorder (Faz 8) |
| OM-15 | naming gate | ✅ FE 0 hit |
| OM-16 | preferred/assigned semantik | 🟡 FE engine.ts genel akışı doğru ama eski yorumlar olabilir; V1.1 cleanup |
| OM-17 | match coverage kalitesi | 🟡 V1 temel düzeltildi: typed service tags + vehicle kind coverage var; gelişmiş skor/backfill V1.1 |
| OM-18 | baseline | ✅ |

---

## 9. Açık Tech Debt (V1.1 / Faz 11+)

FE perspektifinden:

1. **Customer showcase revoke UI** — BE endpoint hazır; FE'de "Bu işi vitrinden çıkar" aksiyonu eklenmeli (OM-13 FE kısmı)
2. **Eski profile ekran kalıntıları** — `useCanonicalCase` deprecated marked; tam sunset Faz 11
3. **Mock store kalıntıları** — dev/seed seviyesinde, V1.1 cleanup hedefi
4. **Tow misc snapshot storage** (kasko/rating) — typed tablolara taşıma (OM-02)
5. **FE preferred_technician_id semantik** — engine.ts tracking yorumu küçük cleanup (OM-16)
6. **Customer home uygun usta bandı** — case profile ve public sheet düzeldi; home bandı tek aktif vaka context'iyle canlı dossier/match verisine bağlanmalı.

---

## 10. Refactor Genel Sonuç (FE)

Frontend açısından vaka omurgası artık canonical olarak yaşıyor:

- Vaka profil sayfası `case_dossier` kontratını tek kaynak olarak okuyor (anlatı §2.1).
- 3 viewer profili (customer/pool/assigned) UI'da PII redaction + match badge + competitor average ile farklılaşıyor.
- Workflow blueprint + milestones/tasks BE source-of-truth; FE yalnız presentation üretiyor.
- Composer 4 akışı anlatı §2.2 "basitten zora" ilkesine oturdu.
- "Vakayı bildir" mekaniği `notify_case_to_technician` endpoint'ine bağlandı; bildirim + havuz paralel çalışıyor.
- Tow saf dispatch UX: 3 deneme sonu "Aday çekici bulunamadı" + retry CTA.
- Naming gate FE aktif yüzeyde temiz.
- 4 paket typecheck temiz, parse parity test PASS.

**Kapanış cümlesi:** Refactor BE + FE birlikte canonical sözleşmeye oturdu. Kalan riskler temel contract drift'i değil; yukarıdaki ikinci katman borçlar V1.1 sprint'ine alınır.

---

## 11. Bir Sonraki Adım

- ✅ BE self-audit (Codex, `26152e6`)
- ✅ FE self-audit (Claude, bu doküman)
- ⏳ Cihaz smoke 5 senaryo (PO + Claude manuel) — `case-refactor-smoke-runbook-2026-04-27.md`
- ⏳ `refactor/case-omurgasi` → main merge (smoke yeşil olduğunda)
