# Backend İş Mantığı + Hiyerarşi — Canonical Reference

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef:** BACKEND-DEV + PRODUCT-OWNER + CLEANER-CONTROLLER — **tünel görüş kırıcı**
> **Niyet:** Dev tek fonksiyon yazarken doğru gözüken kararlar sistem geneli bakıldığında yanlış olabilir. Bu doc **big picture'ı** sabitler. Her PR'da PO şu soruya cevap arar: *"kod bu dokümandaki invariant'lara uyuyor mu?"*

---

## 0. Neden bu doc

Dev (ve Claude'un kendisi) **lokal doğru, global yanlış** kodu yazabilir. Örnekler gerçekte yaşadığımızdan:

- Offer submit validasyonu teklif alan case'in `status` kontrolünü yapıyor ama **case'in o teknisyenin provider_type'ıyla eşleşip eşleşmediğini** unutuyor → yanlış usta teklif verir
- `accept_offer` atomic ama sibling reject loop'u iki paralel accept'te çift çalışabilir → data integrity bozulur
- Teknisyen `approval_status=pending` iken `list_pool_cases` sorgu onun için de vaka döner → admission before distribution ihlali
- Bakım flow'u `maintenance_detail` eksik göndermesi 422 değil 500 döner → kullanıcı anlamsız hata görür
- `tow_dispatch` `active_provider_type='usta'` teknisyene çağrı atar → tow-fit dışı eşleme

**Hepsi "kod çalışıyor" testinden geçer ama ürün mantığını kırar.**

Bu doc **ürün invariant'larını** tek yerde toplar. Dev her PR'da buraya bakmak zorunda, PO da.

---

## 1. Aktörler ve yetki hiyerarşisi

```
USER (users.role enum)
├── customer          — vaka açar, teklif seçer, randevu onaylar, değerlendirir, öder
├── technician        — havuz görür, teklif verir, randevu yönetir, iş yürütür
│   ├── provider_type = cekici                       → TowShell UI, auto-dispatch havuzu
│   ├── provider_type = usta                         → FullShell / BusinessLite / Minimal UI
│   ├── provider_type = kaporta_boya                 → DamageShop UI
│   ├── provider_type = lastik / oto_elektrik / ...  → BusinessLite / Minimal UI
│   ├── secondary_provider_types[] — hibrit (usta+cekici gibi)
│   ├── provider_mode = business | individual        — KYC + cert matrisi
│   └── active_provider_type — multi-role kişi "şu an hangi rolde"
└── admin             — her şey (teknisyen onay, cert review, case override, audit)
```

**Yetki aksiyomları:**

1. **customer** sadece kendi vakalarına + kendi araçlarına + kendi ödemelerine erişir
2. **technician** sadece (a) assigned olduğu vakalara + (b) havuzda görme yetkisi olan case'lere + (c) kendi teklif/profil/cert'lerine erişir
3. **admin** her şeye erişir ama **her aksiyon audit log'a düşer**
4. Hiçbir aktör başka aktörün PII'ına (phone, email, legal_name, vergi no) **doğrudan** erişemez — maskelenir, sadece ilişki üzerinden (case/offer/appointment kurulmuşsa) kısıtlı gösterim

**Tünel görüş uyarısı:** Bir endpoint'te `current_user` check etmek yetmez. İlişki hiyerarşisini de kontrol etmek gerekir:
- `GET /cases/{id}` — user customer mı? case onun mu? veya assigned_technician mı? veya admin mi?
- `GET /offers/{id}` — technician'ın kendi offer'ı mı? veya case owner customer mı?
- `PATCH /technicians/me/*` — sadece kendi profili; başkasının profili = 403

---

## 2. Varlık hiyerarşisi

### 2.1 Core entity graph

```
USER ─┬─ owns ──────────→ VEHICLE ─── ait ──→ SERVICE_CASE
      │                                              ├── offers ───→ CASE_OFFER
      ├─ is ────────────→ TECHNICIAN_PROFILE         ├── appointment ──→ APPOINTMENT
      │                    ├─ certificates          ├── milestones + tasks
      │                    ├─ capabilities          ├── evidence
      │                    ├─ coverage              ├── messages
      │                    ├─ service_area          ├── documents
      │                    ├─ schedule              ├── approvals (parts/invoice)
      │                    ├─ capacity              ├── events (audit timeline)
      │                    └─ performance snapshot   ├── insurance_claim
      │                                              └── (if kind=towing) tow_* tables
      └─ auth_sessions, otp_codes, auth_events
```

**MediaAsset** polymorphic — `vehicles.*`, `service_cases.*`, `technician_profiles.*`, `insurance_claims.*`, `case_attachments.*`, `technician_certificates.*` hepsinde `asset_id` FK veya `attachment_category` ile bağlı.

### 2.2 Vaka (ServiceCase) — **merkez entity**

Vaka bir müşterinin talebiyle açılır, **havuzdan tamamlamaya kadar TEK satır yaşar** (`deleted_at` soft delete + `closed_at` terminal).

Bir vaka = bir hayat döngüsü. Bir araç için aynı anda açık **en fazla 1 aktif kaza veya arıza** olmalı (§9 duplicate guard). Birden çok bakım/çekici paralel olabilir.

### 2.3 Vaka içi alt-koleksiyonlar

| Koleksiyon | Yaşam döngüsü | Unique kuralı |
|---|---|---|
| `case_offers` | case başına N (cap'li) | 1 technician x 1 active offer per case |
| `appointments` | case başına N (yeni randevular önceki decline/cancel sonrası) | Aynı anda en fazla 1 aktif |
| `case_milestones` | workflow_blueprint seed | Fixed — blueprint'ten |
| `case_tasks` | milestone'a bağlı | Open-ended (yeni task eklenebilir) |
| `case_approvals` | manuel (parça/fatura) | 1 aktif parts_approval + 1 aktif invoice_approval max |
| `case_messages` | thread içinde N | Append-only |
| `case_events` | timeline | Append-only audit |
| `case_evidence` | stage'lere bağlı | Kanıt disiplini (evidence_discipline_score) |
| `insurance_claims` | case başına N; aktif 1 (partial unique) | `ClaimAlreadyActiveError` 409 |
| `tow_*` (dispatch_attempts, live_locations, fare_settlements, cancellations, otp_events) | sadece `kind=towing` vakada | Faz 10'da detaylı |

---

## 3. Vaka yaşam döngüsü — state machine

```
            MATCHING
              │
              ├─→ OFFERS_READY
              │     │
              │     ├─→ APPOINTMENT_PENDING
              │     │     │
              │     │     └─→ SCHEDULED ─→ SERVICE_IN_PROGRESS
              │     │                           │
              │     │                           ├─→ PARTS_APPROVAL ─→ SERVICE_IN_PROGRESS
              │     │                           ├─→ INVOICE_APPROVAL ─→ COMPLETED ─→ ARCHIVED
              │     │                           │                    
              │     │                           └─→ CANCELLED ─→ ARCHIVED
              │     │
              │     └─→ APPOINTMENT_PENDING (direkt customer request)
              │
              └─→ APPOINTMENT_PENDING (preferred_technician ile fast-track)
              
              (herhangi state) ─→ CANCELLED ─→ ARCHIVED
```

**Enforce:** [`app/services/case_lifecycle.py::ALLOWED_TRANSITIONS`](../naro-backend/app/services/case_lifecycle.py) — dict.

**Her transition:**
1. `FOR UPDATE` lock yok ama transaction isolation `READ COMMITTED` yeterli (küçük hotspot kontratı)
2. `ALLOWED_TRANSITIONS[current]` içinde yeni status var mı → yoksa `InvalidTransitionError`
3. Terminal state → `closed_at=NOW()`
4. **Event append** `case_events` tablosuna (audit)
5. Wait state güncelle (kim bekliyor?)
6. Opsiyonel: notification intent publish

**Tünel görüş uyarısı:** Transition sırasında:
- Çakışan action varsa (parça onayı + invoice onayı paralel) → birisi öncelik almalı; race koruması `_transition` guard
- Terminal state'ten geri dönüş yok — COMPLETED'den SERVICE_IN_PROGRESS'e transition YASAK (shape doğrulaması)
- CANCELLED her yerden erişilebilir ama `loading/in_transit` (tow) gibi noktalarda kapalı (araç yüklenmişken iptal etmek anlamsız)

---

## 4. Offer yaşam döngüsü

### 4.1 State machine
```
PENDING ──┬─→ SHORTLISTED (system/manual)
          ├─→ ACCEPTED (müşteri seçti; SIBLINGS auto-REJECTED)
          ├─→ REJECTED (müşteri seçti başka; otomatik)
          ├─→ WITHDRAWN (teknisyen geri aldı)
          └─→ EXPIRED (expires_at geçti; cron)
```

### 4.2 Atomic kabul akışı

[`app/services/offer_acceptance.py::accept_offer`](../naro-backend/app/services/offer_acceptance.py) — **canonical referans**:

1. `mark_accepted(offer_id)` — `UPDATE case_offers SET status='accepted', accepted_at=NOW() WHERE id=:id AND status IN ('pending','shortlisted') RETURNING` → etkilenen 0 satır → `OfferAlreadyAcceptedError` (race koruma)
2. `list_siblings_for_case` → hepsini `reject_offer`
3. `append_event(OFFER_ACCEPTED)`
4. Dallanma:
   - `slot_is_firm=True` → appointment auto-create (`source=offer_accept`, `status=approved`); case transition APPOINTMENT_PENDING → SCHEDULED; `assigned_technician_id` set
   - `slot_is_firm=False` → case transition → APPOINTMENT_PENDING (müşteri randevu talebi ayrı verecek)

### 4.3 Cap policy (kind-bazlı)

PO kararı — offer submit'te kind'a göre teklif adedi sınırı:
- `accident`: 5
- `breakdown`: 7
- `maintenance`: 10
- `towing` (scheduled): 5
- `towing` (immediate): 0 — auto-dispatch, offer yok

Cap dolduğunda **yeni offer reddedilmez** ama `status='pending'` olarak saklanır ve **shortlist dışı** bucket'a düşer. Müşteri "daha fazla göster" tap'liyince gelir.

**Tünel görüş uyarısı:**
- Cap sayacı "pending+shortlisted+accepted" toplamı DEĞİL — sadece **pending+shortlisted**. Çünkü accept sonrası cap anlamını kaybeder
- Withdraw edilmiş offer cap'ten düşer

---

## 5. Appointment yaşam döngüsü

### 5.1 State machine
```
PENDING ──┬─→ APPROVED (usta onayı; case → SCHEDULED)
          ├─→ DECLINED (usta red; case → OFFERS_READY)
          ├─→ CANCELLED (müşteri/admin; case reverted)
          ├─→ COUNTER_PENDING (usta counter slot)
          │     ├─→ APPROVED (müşteri counter'ı kabul; case → SCHEDULED)
          │     └─→ DECLINED (müşteri counter'ı red; case → OFFERS_READY)
          └─→ EXPIRED (TTL geçti; cron)
```

### 5.2 Source ayrımı

`appointments.source`:
- `offer_accept` — firm offer kabul edilince auto-create
- `direct_request` — müşteri `POST /appointments` ile doğrudan (offer'sız path)
- `counter` — usta counter_propose_slot sonrası

**Tünel görüş uyarısı:**
- Bir case için paralel **en fazla 1 aktif appointment** olmalı (pending veya counter_pending). Yeni appointment açılmadan önce kontrol → yoksa 409
- `source=offer_accept + slot_is_firm=true` → appointment zaten `approved`; usta onay adımı atlanır
- Counter flow'da slot güncellenirken `_parse_slot_kind` validate zorunlu

---

## 6. InsuranceClaim yaşam döngüsü

```
SUBMITTED ──┬─→ ACCEPTED ──→ PAID    (terminal)
            └─→ REJECTED            (terminal)
ACCEPTED ──→ REJECTED                (sigorta iptali)
PAID / REJECTED — terminal; yeni submit ayrı satır
```

**Kurallar ([insurance_claim_flow.py](../naro-backend/app/services/insurance_claim_flow.py)):**
- Drafted yok — submit doğrudan SUBMITTED
- Partial unique: case başına **1 aktif claim** (SUBMITTED/ACCEPTED/PAID) → `ClaimAlreadyActiveError` 409
- Reject sonrası yeni submit serbest (eski kayıt terminal)
- Admin endpoint'leri: accept (accepted_amount), reject (reason), mark_paid (paid_amount)

---

## 7. Çekici dispatch — özel rejim

[Faz 10 — docs/cekici-backend-mimarisi.md](cekici-backend-mimarisi.md) canonical. Özet:

### 7.1 İki akış

**Acil** (`urgency=urgent` + `kind=towing`):
- Auto-dispatch — pool feed'ine DÜŞMEZ
- `tow_dispatch_service` event-driven SQL scoring
- Radius ladder 10→25→50km
- Optimistic per-tech lock (`current_offer_case_id UPDATE WHERE NULL`)
- 3 deneme → `pool_offered` conversion

**Planlı** (`urgency=planned|today` + `kind=towing`):
- Pool'a düşer (diğerleri gibi bidding)
- Bu brief'in §4'teki offer pattern'i

### 7.2 Tow-özel admission gate (cap üstü)

Havuzdaki teknisyen şunları da karşılamalı:
- `provider_type = 'cekici'` OR `secondary_provider_types includes 'cekici'`
- `active_provider_type = 'cekici'` (şu an çekici modunda)
- `technician_certificates`: `tow_operator` + `vehicle_license` approved
- `technician_tow_equipment` ≥ 1 kayıt
- `service_area` mevcut + workshop_lat_lng dolu

Aksi halde **dispatch havuzuna katılamaz** — mevcut ustalar (çekici hizmeti vermiyor) yanlışlıkla seçilemez.

---

## 8. Matching + sinyal hiyerarşi (7 boyut)

[docs/sinyal-hiyerarsi-mimari.md](sinyal-hiyerarsi-mimari.md) — tam detay. PO katlamalı referans:

| Boyut | Ne | Kullanım |
|---|---|---|
| 1. Ne yapıyorum / ne oldu | `provider_type × service_domain × procedure` ↔ `kind × category × symptoms` | Hard filter + soft score |
| 2. Hangi araç | `brand_coverage × drivetrain_coverage` ↔ `vehicle.make/model/drivetrain` | Hard preference + soft penalty |
| 3. Nerede | `workshop_lat_lng + service_radius + districts` ↔ `location_lat_lng` | PostGIS ST_DWithin + ETA |
| 4. Nasıl | `capabilities × schedule × capacity` ↔ `service_mode_pref × preferred_window × urgency` | Hard filter + weight shift |
| 5. Kim (trust) | `admission_gate + verified_level + performance_snapshot` ↔ `user_fraud × payment × evidence` | Admission + rank |
| 6. Ekonomi | `market_band + price_variance + hidden_cost` ↔ `price_preference × budget` | priceFit score |
| 7. Trust ledger | per-case evidence disiplini | retention + tekrar iş sinyali |

**Matching tekniği katman katman:**
- L0-L1 HARD FILTER (admission, provider_type, kind, drivetrain)
- L2 SOFT SCORE 0-1 (rating, distance, procedure match, price fit)
- L3 AI EMBEDDING / exploration bonus (V2)

`finalScore = 0.30·problemFit + 0.25·trustScore + 0.15·speedScore + 0.10·priceFit + 0.10·convenienceScore + 0.10·retentionScore + bonuses`

**Tünel görüş uyarısı:** Faz 8 matching motoru yazılırken:
- Havuz query'si (§2.3 `list_pool_cases`) **L0-L1 hard filter'ları DB seviyesinde** uygulamalı (select'te WHERE)
- Soft score Python seviyesinde, ama **N+1 sorgu yok** — tek sorguda join edilerek getirilmeli
- `active_provider_type` filter'ı acil çekici dispatch'te **zorunlu**

---

## 9. Admission gate

Teknisyenin havuzda görünmesi için **hepsi** sağlanmalı:

1. `users.role='technician'` ve `users.approval_status='active'`
2. `technician_profiles.availability='available'`
3. `technician_profiles.deleted_at IS NULL`
4. **Rol-bazlı zorunlu cert matrisi karşılanmış** ([docs/rol-ui-mimarisi-backend.md §4.3](rol-ui-mimarisi-backend.md#43-service-layer)):
   - `(provider_type × provider_mode) → required_cert_kinds` service layer matrisinde
   - Her kind için `status='approved'` + `expires_at > NOW() or NULL`
5. `business` bilgisi dolu (legal_name + phone + tax_number)
6. `service_area` mevcut: workshop_lat_lng + radius_km ≥ 1 + city_code
7. `service_domains` ≥ 1
8. `working_schedule`: en az 1 gün açık slot
9. `active_provider_type` şu an çekici mi, usta mı — duyarlı filter (çekici dispatch'te kritik)

**`recompute_admission(profile_id)`** service bu 9 maddeyi her profil değişikliğinde çalıştırır; fail ise `availability='offline'` **FORCE** — teknisyen kendi "açık" yapsa bile sistem geri kapatır.

**Tünel görüş uyarısı:** Dev `/pool/feed` endpoint'i yazarken **her 9 maddeyi kontrol etmez**, sadece `availability='available'` kontrolü yeter SANIR. Hayır — `admission_gate_passed` cache'lenmiş flag okuma YA DA her sorguda matris kontrol **zorunlu**. Aksi halde pending/yarım teknisyenler havuzu görür.

---

## 10. Kullanıcı tercihi = talep prensibi (PO kuralı)

[memory: user_preferences_are_requests.md] — müşteri `on_site_repair`, `valet_requested`, `pickup_preference`, `preferred_window`, `price_preference` ile tercih iletir. Bu **dayatma değil talep**:

**Backend davranışı:**
- Submit'te kabul + sakla
- Usta offer verirken tercihe uymak zorunda DEĞİL — kendi `delivery_mode`'unu set eder
- **Ama:** tercih uyumsuzluğunda **soft-warning** (P0-5 audit):
  - Offer submit'te `delivery_mode ≠ request.pickup_preference` ise offer'a `badges=['tercih_dışı']` flag
  - Mobil UI'da offer kartı gri render, kullanıcı "tercih dışı ama yine de göster" diyebilir
- Hard reject YOK — usta'ya karar serbestliği

**Tünel görüş uyarısı:** Dev `/offers POST` validation'ında `delivery_mode` zorunlu mu diye karar verirken **hard validation** yazmamalı. Warning katmanı service layer'da; router 422 dönmez, 201 + warnings array döner.

---

## 11. Kanıt (evidence) hiyerarşi

Her vaka stage'i için zorunlu/opsiyonel kanıtlar:

| Stage | Actor | Kanıt | Zorunluluk |
|---|---|---|---|
| intake | customer | foto/video/ses + konum | case kind'a göre (kaza 2 zorunlu; bakım çoğunlukla opsiyonel) |
| pickup (tow only) | technician | "geldim" foto + GPS + timestamp | ZORUNLU |
| loading (tow only) | technician | yüklenmiş foto + customer OTP | ZORUNLU |
| diagnosis | technician | teşhis notu + foto | milestone'a göre |
| parts_request | technician | parça listesi + faturaya | parts_approval için zorunlu |
| before/after | technician | foto karşılaştırması | trust ledger — eksik = puan düşer |
| delivery | technician | teslim foto + recipient OTP | ZORUNLU (tow) / önerilen (diğer) |

**Transition gate:**
- `SERVICE_IN_PROGRESS → PARTS_APPROVAL` için parts evidence zorunlu
- `SERVICE_IN_PROGRESS → INVOICE_APPROVAL` için invoice evidence zorunlu
- `IN_TRANSIT → DELIVERED` (tow) için delivery foto + OTP zorunlu

**Evidence discipline score** — son 90 günde kaç stage'de zorunlu kanıt karşılandı → teknisyen rating'ine feed.

**Tünel görüş uyarısı:** Transition fonksiyonu `new_status` kontrol ediyor ama **"kanıt karşılandı mı"** kontrolünü unutabilir. Her transition'da stage-bazlı evidence check subquery.

---

## 12. Financial flow

### 12.1 Tow için (Faz 10 committed)

```
Request → PSP pre-auth (cap_amount + %20 buffer, Iyzico)
       → Dispatch + accept
       → Delivery → final_amount = min(actual_distance × rate, cap_amount)
       → PSP capture (final_amount)
       → Refund diff (pre-auth - final, if > 0)
       → platform_commission = final_amount × 0.10
       → net_to_technician = final_amount - commission
       → Kasko flag varsa: SMS customer, operations ticket, manual reimbursement flow
```

### 12.2 Diğer vakalar (bakım/kaza/arıza) — BİZ HENÜZ YAZMADIK

**Yok ve eksik** — audit P1 içinde yer almayan ama launch için kritik:
- Parts approval sonrası delta charge (yeni parça + fiyat farkı)
- Invoice approval sonrası nihai tutar
- Taksit (Iyzico installment) — V2
- Kasko kapsamında ödeme — V2 (API entegrasyonu şart)

**Bu brief §12 eksiklik:** Billing servis katmanı yazılmalı. Backend brief Faz A **bu kısmı out-of-scope** bırakmış; ayrı brief: `docs/billing-servis-brief.md` (henüz yazılmadı).

### 12.3 Komisyon (PO kararı — [feature-3.md](feature-3.md))

`platform_commission = final_amount × 0.10` — V1 sabit %10. V2'de tier'lı: premium usta %8, new exploration %12.

---

## 13. Anti-disintermediation (PO prensibi)

[memory: matching_regime] ve [feature-2.md] müşteri-usta doğrudan iletişimi caydırma:

**Aktif V1 kontrolleri:**
- Thread-only messaging: customer ↔ technician iletişim case.thread üzerinden
- `users.phone + email` → public API'de maskelenmiş (`"+90 5XX ••• •• 42"`, `"me•••@autopro.com.tr"`)
- Case detail endpoint'te customer PII sadece **assigned_technician** için (havuzda mask)
- Ödeme **platform üstünden** — dışarı para akışı iptal (PSP escrow)
- Off-platform iletişim denemesi (mesajlarda phone regex) → flag + warn (V2)

**Aktif değil (audit P0-4):**
- Twilio Proxy masked phone numbers — V2
- Email relay — V2
- Off-platform complete detection (usta 1 vaka sonrası müşteriyi doğrudan arayıp iş alırsa) — V3

**Tünel görüş uyarısı:** Public endpoint (`/technicians/public/{id}`, `/pool/case/{id}`) response'larında **PII FILTRE KATMANI** zorunlu. Dev `GET /cases/{id}` yazarken "customer_name" alanını sadece assigned_technician veya owner gösterir; pool'daki diğer teknisyenlere gösterirse **disintermediation sızıntısı**.

---

## 14. KVKK & retention

| Veri | Saklama | Retention cron |
|---|---|---|
| `users.phone/email` | aktif süresince + soft delete 30 gün | `user_lifecycle.soft_delete_user` |
| `vehicles` | aktif + dossier opsiyonel | — |
| `service_cases + offers + appointments` | closed + 2 yıl (dispute için) | — (V2 cron) |
| `tow_live_locations` | delivered + 30 gün | `tow_location_retention_purge` (Faz 10) |
| `tow_otp_events` | 90 gün | `tow_kvkk_purge` |
| `case_messages` | closed + 2 yıl (evidence) | V2 |
| `media_assets` | purpose retention'a göre (18 purpose) | `media_orphan_purge` + `media_retention_sweep` (Faz 11) |
| `insurance_claims` | 10 yıl (VUK) | hard delete yasak; pseudonymize |
| `auth_events` | 1 yıl | V2 |

**KVKK silme talebi:** 30 gün içinde user_lifecycle.soft_delete → cascade related PII + 30 gün sonra hard pseudonymize.

**Tünel görüş uyarısı:** Retention cron her domain için ayrı yazılmalı — genel "6 ay sonra sil" kuralı yok. Her tabloya özel policy.

---

## 15. Audit log + observability

Her **önemli aksiyon** için 3 paralel iz:

1. **CaseEvent** (`case_events` tablo) — iş akışı timeline; kullanıcıya timeline olarak gösterilir
2. **AuthEvent** (`auth_events` tablo) — auth + security; admin audit
3. **Prometheus metric** — `{endpoint}_total{status, kind, ...}` + histogram duration

**Zorunlu event'lenenler:**
- Her `transition_case_status` → CaseEvent `STATUS_UPDATE`
- Offer accept/reject/withdraw → CaseEvent
- Appointment approve/decline/cancel/counter → CaseEvent
- Insurance claim submit/accept/reject/paid → CaseEvent
- Admin aksiyonları → AuthEvent `ADMIN_*`
- Cert approve/reject → AuthEvent `CERT_REVIEW`
- Login, logout, refresh, reuse_attempt → AuthEvent

**Tünel görüş uyarısı:** Dev yeni endpoint yazarken `append_event` çağrısını unutur. **PR review kuralı:** her state değişikliği/admin aksiyonu `append_event` + metric emit.

---

## 16. Invariants — bozulmaz kurallar

Bunlar **koda uyulmazsa sistem tutarsız** olur:

**I-1.** Her offer için `(case_id, technician_id)` unique pending+shortlisted+accepted — aynı usta aynı vakaya 2 aktif teklif atamaz  
**I-2.** Her case için `assigned_technician_id IS NULL` veya **aktif 1 kişi** (SCHEDULED/SERVICE_IN_PROGRESS sırasında)  
**I-3.** `ALLOWED_TRANSITIONS` dışı state değişimi YASAK — `InvalidTransitionError`  
**I-4.** `service_cases.closed_at IS NOT NULL` ⟺ status ∈ {COMPLETED, CANCELLED, ARCHIVED}  
**I-5.** `insurance_claims` partial unique: case başına SUBMITTED/ACCEPTED/PAID'den sadece 1 aktif  
**I-6.** `media_assets.status='complete'` olmadan asset case'e bağlanamaz  
**I-7.** Admission gate 9 maddesi sağlanmadan teknisyen havuzda görünmez (§9)  
**I-8.** `tow_fare_settlement.final_amount ≤ preauth_amount` — cap aşılmaz, platform absorbe eder  
**I-9.** PII (phone/email/legal_name/tax_number) public endpoint'te **maskelenmemiş dönemez**  
**I-10.** Terminal state (COMPLETED/CANCELLED/ARCHIVED) sonrası yeni mutation YASAK — sadece read + admin override  
**I-11.** Every admin action → AuthEvent + metric. Admin dashboard gerekirse filter  
**I-12.** `active_provider_type` mutlaka `provider_type` veya `secondary_provider_types[]` içinden — constraint  
**I-13.** Event append-only — `case_events` UPDATE/DELETE YASAK  
**I-14.** Rate limit her POST endpoint'e zorunlu; spam koruma  
**I-15.** `model_validator` kind-bazlı conditional fields — cross-kind alanlar mixed gelemez (bakımda kasko_brand gibi)

---

## 17. Red flags — tünel görüş kaçırma riski EN yüksek noktalar

**Dev her yeni PR'da bu kontrol listesini yapmalı:**

### 17.1 Ownership + ilişki hiyerarşi
- [ ] Endpoint `current_user` check ediyor mu?
- [ ] Resource erişim: owner OR assigned_party OR admin kontrolü var mı?
- [ ] Cross-user leak: başkasının asset/case/offer'ına 403 mü?

### 17.2 PII koruma
- [ ] Response'ta `phone`, `email`, `legal_name`, `tax_number`, `iban` var mı?
- [ ] Varsa, bu alıcı için yetkili mi? (owner veya assigned veya admin)
- [ ] Havuz/public endpoint'te maskelenmiş mi?

### 17.3 State machine disiplin
- [ ] `transition` guard mevcut mu? `InvalidTransitionError` dönüyor mu?
- [ ] Race koruma: UPDATE ... WHERE status = ... RETURNING pattern?
- [ ] Terminal state check?

### 17.4 Validation
- [ ] Pydantic syntax +enum
- [ ] `@model_validator` conditional (kind-bazlı, capability-bazlı, role-bazlı)
- [ ] Service layer business rule (owner + admission + capacity)
- [ ] 422 mesajı user-actionable mı?

### 17.5 Audit + observability
- [ ] `append_event` çağrıldı mı?
- [ ] Prometheus metric emit edildi mi?
- [ ] Structured log (user_id, action, outcome)?

### 17.6 Race + concurrency
- [ ] UPDATE ... WHERE ... clause atomic mi?
- [ ] 2 paralel istek testi var mı?
- [ ] Idempotency key gerekli mi (POST'larda)?

### 17.7 Capability + admission gates
- [ ] Teknisyen admission_gate_passed kontrolü? (§9 all 9 items)
- [ ] `active_provider_type` doğru filter'de mi?
- [ ] Capability-gated aksiyon (insurance_case_handler, tow, on_site_repair) sorgulandı mı?

### 17.8 Schema parity
- [ ] Zod ↔ Pydantic paralel mi? Parity test güncel mi?
- [ ] Yeni alan iki tarafa da eklendi mi?

### 17.9 Tow özel
- [ ] `provider_type = 'cekici'` filter mi `active_provider_type = 'cekici'` mi?
- [ ] `tow_operator` cert zorunlu mu?
- [ ] GPS stream gate: `active_job + active_cekici` kontrolü?

### 17.10 KVKK
- [ ] Yeni alan PII mi? Retention policy belirli mi?
- [ ] Soft delete sonrası ne oluyor?

---

## 18. Bu doc nasıl kullanılır

### PO (ben)
- Her PR review'da §17 kontrol listesi geçer
- Invariant'lardan (§16) birisi kırılmışsa **merge YOK**
- Audit / CLEANER-CONTROLLER ile cross-check

### BACKEND-DEV
- Yeni endpoint öncesi §2-11 ilgili bölümleri okur
- §17 red flags'a göre kendi kod'unu review eder
- Invariant ihlali şüphesi varsa PO'ya sor

### UI-UX-FRONTEND-DEV
- §10 (kullanıcı tercihi = talep) + §13 (anti-disinter PII mask) önemli
- Mobil wire-up'ta backend contract §11 schema parity

### CLEANER-CONTROLLER
- Hat A iş mantığı denetim = bu doc'un invariant'ları koda yansımış mı taraması
- Audit dokümanıyla cross-reference

---

## 19. Canlı dokümandır — güncelleme

Yeni faz bittikçe bu doc **güncellenmelidir** (PO sorumlu):
- Faz 8 matching motoru kodlanınca §8'e implementation detay ekle
- Billing servis yazılınca §12.2 güncelle
- Anti-disinter V2 gelince §13 genişlet
- Yeni invariant çıkarsa §16'ya ekle

**Versiyonlama:** doc footer'da `v1.0 — 2026-04-22` gibi; major karar değişikliklerinde bump.

---

## 20. Referanslar

- [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) — mevcut boşluklar
- [docs/veri-modeli/](veri-modeli/) — 16 domain doc
- [docs/veri-modeli/KARAR-LOG.md](veri-modeli/KARAR-LOG.md) — karar günlüğü
- [docs/sinyal-hiyerarsi-mimari.md](sinyal-hiyerarsi-mimari.md) — matching 7-boyut
- [docs/rol-ui-mimarisi-backend.md](rol-ui-mimarisi-backend.md) — rol + mode + cert matrisi
- [docs/cekici-backend-mimarisi.md](cekici-backend-mimarisi.md) — tow dispatch detay
- [docs/musteri-vaka-olusturma-backend-contract.md](musteri-vaka-olusturma-backend-contract.md) — case submit contract
- [docs/backend-rest-api-faz-a-brief.md](backend-rest-api-faz-a-brief.md) — 67 endpoint roadmap
- Memory: [matching_regime](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/matching_regime.md), [user_preferences_are_requests](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/user_preferences_are_requests.md), [on_site_repair_capability](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/on_site_repair_capability.md)

---

**v1.0 — 2026-04-22** · Canonical iş mantığı + hiyerarşi · PO oversight reference
