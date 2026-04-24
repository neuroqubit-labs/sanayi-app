# Backend Billing Servisi — İş Mantığı Brief'i

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbetler:** BACKEND-DEV (primary) — launch blocker
> **Kapsam:** Vaka financial lifecycle; parts/invoice approval delta + komisyon + kasko + refund + Iyzico production transition
> **Kardeş doc:** [backend-is-mantigi-hiyerarsi.md §12](backend-is-mantigi-hiyerarsi.md#12-financial-flow) — o doc "yok" diyor; bu doc kapatır
> **Süre tahmini:** ~7-8 iş günü (3 alt-faz)

---

## 1. Context — neden acil

### 1.1 Mevcut durumda yok olan

Backend-is-mantigi umbrella §12.2 diyor ki: *"Diğer vakalar (bakım/hasar/arıza) — BİZ HENÜZ YAZMADIK. Yok ve eksik."*

Somut:
- `service_cases.estimate_amount` + `total_amount` kolon var — **hiç dolmuyor**
- Offer amount var — accept sonrası **hiçbir şey olmuyor** (case'e paraya aktarılmıyor, pre-auth yok)
- `case_approvals` parts/invoice mantığı var — **fiyat delta hesabı yok**
- `platform_commission` kararı: %10 flat V1 (pilot), tier'lı V2 pilot-sonrası — **servis katmanı yok**
- Iyzico **sadece tow için** stub (Faz 10); bakım+hasar+arıza için **PSP entegrasyonu YOK**
- Kasko reimbursement **sadece tow**'da manuel flow; diğer akışlarda flag dahi yok
- Refund policy dokümante değil — iptal sonrası ne olur?
- Escrow (platform ödemeyi tutar, iş tamamlanınca usta'ya aktarır) pattern belirsiz

### 1.2 Launch blocker mı?

**Evet.** Pilot launch senaryosunda bir kullanıcı bakım talebi verir → 3 usta teklif atar → kullanıcı seçer → **ödeme ne zaman, kim, nasıl tahsil eder?** Bu soru'nun cevabı yok → pilot çıkamaz.

### 1.3 Ne kadar işi var

- 3 faz: Şema + service layer + API (§14)
- ~7-8 iş günü BE
- Tow tarafından **pattern mevcut** — Iyzico abstraction + PSP Protocol reuse; ana iş **diğer kind'lar için flow yazmak**.

---

## 2. Aktörler + finansal akış resmi

```
┌─────────────┐      ┌──────────┐      ┌──────────┐      ┌───────────┐
│  MÜŞTERİ    │─────►│  NARO    │─────►│  USTA    │      │  SIGORTA  │
│             │ ₺    │ PLATFORM │ ₺    │          │      │  (kasko)  │
└─────────────┘      └──────────┘      └──────────┘      └───────────┘
      ▲                   │                                    │
      │                   ├─ komisyon (10%)                    │
      │                   │                                    │
      └───── iade ────────┘◄────── reimbursement ──────────────┘
```

**Üç taraflı akış:**
- **Müşteri** ödemeyi yapar (kart → Iyzico pre-auth)
- **Platform** (Naro) ödemeyi tutar (escrow) + komisyon keser
- **Usta** iş tamamlanınca net tutarı alır (platform → usta banka)
- **Sigorta** (opsiyonel) kasko kapsamındaysa → platform sigorta'ya fatura keser → sigorta platform'a öder → müşteriye iade
- **İade** — iptal / usta-failure / müşteri haklı şikayet durumunda müşteri kartına

### 2.1 Platform'un escrow rolü

Müşteri ödemez; Naro tutar. İş tamamlanınca usta'ya aktarılır. Faydalar:
- Müşteri güvenir (iş bitmeden para usta'ya gitmez)
- Usta'nın aynı-müşteri-off-platform kaçışı anlamsız (platform ödemesi tek kanal)
- Dispute durumunda Naro arabulucu (ödeme elimizde)
- Anti-disintermediation mali kaldıraç

**Yasal not:** Escrow aracılık TR'de **Ödeme Hizmetleri Kanunu** kapsamında değerlendirilir (ETBİS kaydı + BDDK bilgi). Hukuki danışman gerekli — BD sohbetine bağlı. Teknik olarak Iyzico merchant hesabı platform adına, usta payout ikinci adım (Iyzico Subaccount veya manuel banka transfer V1).

---

## 3. Case financial lifecycle — end-to-end

Her vaka (kind'a bakmadan) aynı temel finansal akışı takip eder. Varyans: kind-spesifik adımlar (parça onayı bakım'da şart, hasar'da sigorta branching, çekici single-shot).

### 3.1 Finansal state machine (case-level)

```
ESTIMATE (offer accept anındaki tutar)
    │
    ▼
PREAUTH_HELD (Iyzico pre-auth hold, offer.amount + 20% buffer)
    │
    ├─► (iş sürerken parça eklenir)
    │   ADDITIONAL_HOLD (parts_approval onaylanınca delta hold)
    │       │
    │       ▼
    ├─► (invoice_approval onayı)
    │   FINAL_AMOUNT belirleniyor
    │
    ▼
CAPTURED (iş tamamlandı + müşteri onayladı; Iyzico capture)
    │
    ├──► COMMISSION_CALCULATED (%10 platform)
    ├──► NET_TO_TECHNICIAN (usta payout scheduled)
    ├──► INVOICE_ISSUED (müşteriye e-fatura)
    │
    │   Kasko flag varsa:
    ├──► KASKO_PENDING (sigorta'ya fatura + operations ticket)
    │      │
    │      ▼
    │   KASKO_REIMBURSED (sigorta ödedi + müşteri kartına iade)
    │
    ▼
SETTLED (terminal — tüm taraflar ödenmiş)

[İptal path]
PREAUTH_HELD → CANCELLED → REFUNDED (cancellation_fee varsa kısmi capture)
```

### 3.2 Parts approval delta — en karmaşık nokta

Senaryo: Müşteri bakım verdi 1500 ₺ teklif kabul etti → pre-auth 1500 × 1.2 = 1800 ₺ hold. İş sırasında usta "gizli hasar, rotil değişecek, +800 ₺" dedi → `case_approval(kind='parts_request')` açılır.

**İşlem akışı:**
1. Usta `POST /case-approvals` — parts_request + line_items + total_addition (800 ₺)
2. Müşteriye push notif: "Parça onayı bekleniyor"
3. Müşteri onay/red:
   - **Onay:** 
     - Mevcut pre-auth yeterli mi? (`preauth_amount=1800` >= `estimate + addition = 2300`? → **Hayır, 500 ₺ eksik**)
     - Additional pre-auth gerek: `psp.authorize(500 ₺)` yeni kart hold
     - Total hold artık 2300 ₺
     - Case stage → SERVICE_IN_PROGRESS (geri)
   - **Red:**
     - Usta parça olmadan devam edemez → case'i iptal et veya farklı çözüm
     - Müşteri-usta müzakere (message thread)
     - Timeout 48 saat → otomatik iptal (fee 0)

**Invariant:** `sum(preauth holds) >= sum(estimate + approved_parts)` — herhangi bir anda pre-auth miktarı onaylanmış tutardan düşük olamaz.

### 3.3 Invoice approval + capture

Usta iş bitince `POST /case-approvals` — invoice + final_line_items + total_final.

Müşteri onay:
- Check: `total_final <= sum(pre-auth holds)` olmalı
- Eğer değilse → yeni partial pre-auth (ek onay akışı — nadir, usta düşük tahmin ettiyse)
- `psp.capture(all_auth_refs, total_final)` → platform tahsil eder
- `refund_excess` — pre-auth toplamı > final_amount ise fark auto-refund
- `platform_commission = total_final * 0.10`
- `net_to_technician = total_final - commission`
- Case → COMPLETED

### 3.4 Müşteri red (invoice)
- Dispute flag
- Admin arabulucu (manuel flow V1)
- Resolve: kısmi capture (kabul edilen tutar) + partial refund

---

## 4. Komisyon modeli

### 4.1 V1 — flat %10

`platform_commission = total_final × 0.10`

Sabit. Kind'a bakmaksızın. Feature-3.md'deki karar.

**İstisna — çekici acil dispatch:** Faz 10'da zaten implement (aynı %10). Değişiklik yok.

### 4.2 V2 önerisi (bu brief kapsam dışı — not)

Tier'lı komisyon:
- Premium usta (verified_level='premium' + evidence_discipline > 0.9): **%8**
- Standart (verified + evidence 0.6-0.9): **%10**
- Exploration / yeni kayıt (son 30g < 5 iş): **%12** (platform marketing yatırımı geri dönüşü)
- Dispute yüksek (son 90g dispute_rate > 0.1): **%15** (caydırıcı)

V2'de `technician_performance_snapshots`'tan hesaplanır — şu an snapshot cron yok (audit P1-3). Tier'lı komisyon **Faz 8 matching motoru** ile paralel yazılır.

### 4.3 Komisyon kaydı

Yeni tablo: `case_commission_settlements`:

```sql
CREATE TABLE case_commission_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID UNIQUE NOT NULL REFERENCES service_cases(id),
    gross_amount NUMERIC(12,2) NOT NULL,
    commission_amount NUMERIC(12,2) NOT NULL,
    commission_rate NUMERIC(5,4) NOT NULL,  -- 0.1000 V1; V2 tiered
    net_to_technician_amount NUMERIC(12,2) NOT NULL,
    platform_currency CHAR(3) DEFAULT 'TRY',
    captured_at TIMESTAMPTZ NOT NULL,
    payout_scheduled_at TIMESTAMPTZ,
    payout_completed_at TIMESTAMPTZ,
    payout_reference VARCHAR(120)  -- banka transfer ref
);
```

**Invariant:** `gross = commission + net_to_technician` (decimal exact, no rounding drift)

---

## 5. Iyzico V1.1 production transition

### 5.1 Şu an — Faz 10 stub

[app/integrations/psp/iyzico.py](../naro-backend/app/integrations/psp/iyzico.py) `NotImplementedError("Iyzico integration ships in V1.1")` raise ediyor. [MockPsp](../naro-backend/app/integrations/psp/mock.py) V1 default.

### 5.2 V1.1 gereksinim matrisi

| İşlem | Endpoint | Iyzico API |
|---|---|---|
| Authorize (pre-auth) | `authorize(amount, method_token, idempotency_key)` | `checkout/auth` (3DS) |
| Capture (tahsil) | `capture(auth_ref, amount, idempotency_key)` | `payment/auth` capture |
| Release (hold bırak) | `release(auth_ref)` | `payment/cancel` |
| Refund (iade) | `refund(capture_ref, amount, idempotency_key, reason)` | `payment/refund` |
| Partial refund | aynı, amount < capture | `payment/refund` partial |
| Get status | `get_status(ref)` | `payment/detail` |
| Card tokenize (V2) | `tokenize_card(...)` | `cardstorage/card` |

### 5.3 3DS Secure akışı
Iyzico zorunlu 3DS (TR regülasyonu). Akış:
1. Mobile: kart bilgileri → Iyzico checkout form (WebView)
2. Iyzico → bank 3DS challenge (SMS OTP vs)
3. Success → callback backend'e token + payment_id
4. Backend: authorize `amount` bu token ile

**Mobil entegrasyon:** Iyzico checkout form URL → WebView. Backend Iyzico webhook handler:
- `POST /api/v1/webhooks/iyzico` — status update
- HMAC signature verify
- Idempotency via `payment_id + retry_id`

### 5.4 Idempotency + audit

Her PSP çağrısı `tow_payment_idempotency` benzeri generic tablo:
```sql
CREATE TABLE payment_idempotency (
    idempotency_key VARCHAR(120) PRIMARY KEY,
    operation VARCHAR(32) NOT NULL,  -- 'authorize', 'capture', 'refund'
    case_id UUID NOT NULL REFERENCES service_cases(id),
    psp_provider VARCHAR(32) NOT NULL,  -- 'iyzico', 'mock'
    psp_ref VARCHAR(120),
    request_payload JSONB,
    response_payload JSONB,
    state VARCHAR(32) NOT NULL,  -- 'pending', 'success', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX ix_payment_idempotency_case ON payment_idempotency (case_id, created_at DESC);
```

Durable replay — network partition / timeout durumunda çift charge engeli.

---

## 6. Kasko reimbursement — manuel V1 / API V2

### 6.1 V1 akış (manuel)

Müşteri vaka açarken `kasko_selected=true` + `kasko_brand` giriyor. **Capture normal** (müşteri kartından). İş bitince:

1. Platform otomatik → müşteriye SMS/email: *"Faturayı kaskonuza ibraz edin. Naro'ya onay gelirse X gün içinde iade."*
2. Operations dashboard'da `kasko_pending` flag'li case'ler listesi (admin endpoint)
3. Operations ops (BD sohbeti) sigorta şirketi ile manuel koordinasyon:
   - Fatura gönder
   - Kasko approval bekle
   - Onay gelince amount confirm
4. Admin `POST /admin/cases/{id}/kasko-reimburse` → platform müşteri kartına iade (Iyzico refund)

### 6.2 V2 akış (sigorta API)

Hedef sigorta şirketleri (BD sohbeti — Axa, Anadolu, Aksigorta öncelik):
- Elektronik fatura submission API
- Claim status pull
- Auto-reimbursement confirm

V1'de tablo yapısı ve flag hazırlanır; V2'de API adapter yazılır.

### 6.3 Kasko state tracking

`case_kasko_settlements` tablo:
```sql
CREATE TABLE case_kasko_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID UNIQUE NOT NULL REFERENCES service_cases(id),
    insurer_name VARCHAR(120) NOT NULL,  -- 'Axa Sigorta'
    policy_number VARCHAR(80),
    claim_reference VARCHAR(120),  -- sigorta tarafının dosya no
    reimbursement_amount NUMERIC(12,2),
    state VARCHAR(32) NOT NULL,  -- 'pending', 'submitted', 'approved', 'rejected', 'reimbursed', 'partially_reimbursed'
    submitted_at TIMESTAMPTZ,
    reimbursed_at TIMESTAMPTZ,
    refund_to_customer_psp_ref VARCHAR(120),
    notes TEXT
);
```

**İlişki:** `insurance_claims` (submit + accept + pay state machine) + `case_kasko_settlements` (platform-level reimbursement tracking). Duplicate değil — `insurance_claims` sigorta tarafıyla konuşur, `kasko_settlements` platform tarafıyla.

---

## 7. Refund policy — net kurallar

### 7.1 İptal durumları + ücret

| Senaryo | Müşteri ücreti | Platform yapılanlar |
|---|---|---|
| Pre-auth sonrası, offer kabul öncesi iptal | 0 ₺ | pre-auth release |
| Offer kabul sonrası, randevu öncesi iptal (müşteri) | 0 ₺ | pre-auth release |
| Randevu gün öncesi iptal (müşteri, 24h+ öncesi) | 0 ₺ | pre-auth release |
| Randevu gün iptali (24h içinde, müşteri) | cancellation_fee (V2) | partial capture |
| Randevu sonrası, usta iş yaparken müşteri iptal | cancellation_fee + yapılan iş tutarı | partial capture |
| Usta iş yapamadı / reddetti / no-show | 0 ₺ | pre-auth release + usta reputation penalty |
| İş yarım bitti, müşteri memnun değil | dispute → admin arabulucu | manuel resolve |
| Çekici akışı iptalleri | [cekici-modu-urun-spec.md §3 K-4 tablosu](cekici-modu-urun-spec.md) | Faz 10'da shipped |

### 7.2 Cancellation fee V1 vs V2

**V1 simplified:** Müşteri iptali sadece tow'da fee'li ([tow K-4 tablosu](cekici-modu-urun-spec.md)). Diğer kind'larda iptal ücreti **yok** — kabul edilebilir (platform early stage, müşteri deneyimi önce). Usta reputation (cancel_rate) tarafından dolaylı dengeleme.

**V2:** Kind-bazlı cancellation fee matrix. `case_cancellations` tablosu + fee matrix function.

### 7.3 Refund işlemleri

Yeni tablo: `case_refunds` (tow_fare_refunds pattern):
```sql
CREATE TABLE case_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES service_cases(id),
    amount NUMERIC(12,2) NOT NULL,
    reason VARCHAR(60) NOT NULL,  -- 'cancellation', 'dispute', 'excess_preauth', 'kasko_reimbursement', 'admin_override'
    psp_ref VARCHAR(120),
    idempotency_key VARCHAR(120) UNIQUE NOT NULL,
    state VARCHAR(32) NOT NULL,  -- 'pending', 'success', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    initiated_by_user_id UUID REFERENCES users(id)
);
```

---

## 8. Usta payout

### 8.1 V1 — haftalık manuel payout

- `case_commission_settlements.net_to_technician_amount` birikir
- Haftalık (Pazartesi) Operations (BD/ops) tüm "payout_scheduled_at null + case completed" kayıtları toplar
- Manual banka transfer (usta IBAN'ına)
- `payout_completed_at` + `payout_reference` update

**Basit + regülatör dostu** — V1 launch için yeter. Iyzico subaccount V2 otomasyon.

### 8.2 V2 — Iyzico Subaccount / auto payout

Iyzico'nun subaccount API'si — her usta için subaccount + otomatik split. Capture → %10 platform + %90 usta subaccount. T+1 payout.

V2'de entegrasyon. V1 manuel flow yeterli 50-200 usta için.

### 8.3 Payout invariants

**I-PAY-1.** Net_to_technician ≥ 0 her zaman (negative olamaz; commission_rate max %100)
**I-PAY-2.** `payout_scheduled_at <= payout_completed_at` (null/null değilse)
**I-PAY-3.** Double payout engeli — `payout_reference` UNIQUE
**I-PAY-4.** Payout ancak `case.status='completed'` ve `capture` başarılı sonrası scheduled

---

## 9. E-fatura entegrasyonu

### 9.1 V1 — Iyzico invoice PDF + platform-side GIB entegrasyonu

Iyzico her capture sonrası otomatik tax-compliant fatura PDF üretir (merchant tarafında). Naro ek olarak GIB e-fatura veya e-arşiv entegrasyonu yapmalı (TR VUK şartı 5M TL+ gelirli şirketler için e-fatura, altında e-arşiv).

**V1 stratejisi:**
- Pilot launch'ta gelir < 5M TL → e-arşiv (daha basit)
- GIB portal manuel entry veya 3rd-party provider (ParamPos, Logo e-Fatura)
- Her capture → async worker → e-arşiv fatura oluştur + müşteriye email
- İnvoice PDF URL `case_commission_settlements.invoice_url`

### 9.2 V2 — Direct GIB API integration

Yüksek hacimde direkt GIB API (e-fatura). V2.

---

## 10. API endpoint'leri

### 10.1 Müşteri-side

| Method | Path | Role | Açıklama |
|---|---|---|---|
| `POST` | `/cases/{id}/payment/initiate` | customer | 3DS form URL döner (Iyzico checkout); kullanıcı WebView'de 3DS'i tamamlar |
| `POST` | `/cases/{id}/payment/webhook` (Iyzico webhook) | — | 3DS success → authorize |
| `GET` | `/cases/{id}/billing/summary` | customer (owner) or admin | Estimate + approved parts + final + refunds + kasko status |
| `POST` | `/case-approvals/{id}/approve` | customer (for parts/invoice) | Mevcut approval flow — ama billing trigger additional |
| `POST` | `/case-approvals/{id}/reject` | customer | Dispute path |

### 10.2 Usta-side

| Method | Path | Role | Açıklama |
|---|---|---|---|
| `POST` | `/cases/{id}/approvals` | technician | parts_request veya invoice submit |
| `GET` | `/technicians/me/payouts` | technician | Kendi net_to_technician kayıtları |

### 10.3 Admin

| Method | Path | Açıklama |
|---|---|---|
| `GET` | `/admin/billing/pending-payouts?from=&to=` | Haftalık payout listesi |
| `POST` | `/admin/billing/payouts/mark-completed` | Batch payout complete (manuel banka sonrası) |
| `GET` | `/admin/billing/kasko-pending?from=&to=` | Kasko reimbursement bekleyenler |
| `POST` | `/admin/cases/{id}/kasko-reimburse` | Amount + PSP refund trigger |
| `POST` | `/admin/cases/{id}/refund` | Arabulucu refund (dispute) |
| `POST` | `/admin/cases/{id}/capture-override` | Acil durumda admin capture (son çare; audit) |
| `GET` | `/admin/billing/commission-report?from=&to=` | Platform komisyon raporu |

### 10.4 Webhooks

| Path | Amaç |
|---|---|
| `POST /api/v1/webhooks/iyzico/payment` | PSP status update (auth success/fail, capture, refund) |
| `POST /api/v1/webhooks/iyzico/chargeback` | Chargeback alarm (V2 dispute automation) |

HMAC signature verify + idempotency via `payment_id + event_id`.

---

## 11. Service layer

### 11.1 Yeni modüller

- `app/services/case_billing.py` — ana orchestrator
  - `initiate_payment(case_id, offer_id)` — authorize akışı başlat
  - `process_3ds_callback(payment_id, result)` — webhook handler
  - `handle_parts_approval(approval_id, approved)` — delta hold
  - `handle_invoice_approval(approval_id, approved)` — final capture
  - `cancel_case(case_id, reason, actor)` — refund + fee logic
  - `reimburse_kasko(case_id, amount, admin_user_id)` — refund to customer
  - `calculate_commission(gross_amount, technician_id)` — V1 flat 10%; V2 tier'lı
  - `schedule_payout(case_id)` — commission_settlement insert
  
- `app/services/refund_policy.py` — cancel fee decision
  - `compute_cancellation_fee(case, at_stage, by_actor, at_time)` → Decimal
  
- `app/integrations/psp/iyzico.py` — V1.1 real impl
  - `authorize`, `capture`, `release`, `refund`, `get_status`, `process_3ds_form`
  - HMAC webhook verify
  
- `app/services/e_archive.py` — V1 e-arşiv integration
  - `issue_invoice(capture_ref, amount, customer_info)` → PDF URL

### 11.2 State machine enforcement

Yeni modül: `app/services/case_billing_state.py`

```python
BILLING_TRANSITIONS = {
    'estimate': {'preauth_requested'},
    'preauth_requested': {'preauth_held', 'preauth_failed'},
    'preauth_held': {'captured', 'released', 'additional_hold_requested'},
    'additional_hold_requested': {'additional_held', 'additional_failed'},
    'additional_held': {'captured', 'released'},
    'captured': {'partial_refunded', 'full_refunded', 'kasko_pending', 'settled'},
    'kasko_pending': {'kasko_reimbursed', 'kasko_rejected'},
    'kasko_reimbursed': {'settled'},
    'partial_refunded': {'settled', 'full_refunded'},
    'full_refunded': {'settled'},
    'settled': set(),  # terminal
}
```

`case_billing_state` kolonu yeni → `service_cases` veya ayrı `case_billing_status` tablosu.

### 11.3 Atomicity

Her fonksiyon tek transaction:
```python
async def handle_invoice_approval(session, approval_id, approved):
    async with session.begin():
        approval = await lock_approval(session, approval_id)  # SELECT FOR UPDATE
        if not approved:
            return await _handle_dispute(session, approval)
        
        settlement = await lock_or_create_settlement(session, approval.case_id)
        final_amount = approval.total_final
        preauth_total = await sum_preauth_holds(session, approval.case_id)
        
        if final_amount > preauth_total:
            raise InsufficientPreauthError(...)
        
        # PSP capture
        capture_ref = await psp.capture(
            auth_refs=settlement.auth_refs,
            amount=final_amount,
            idempotency_key=f"capture:{approval.case_id}:{approval.id}",
        )
        
        commission = calculate_commission(final_amount, approval.technician_id)
        net = final_amount - commission
        
        await update_settlement(session, settlement.id, captured=True, ...)
        await insert_commission_record(session, approval.case_id, final_amount, commission, net)
        
        # Excess refund if any
        if preauth_total > final_amount:
            await psp.refund(capture_ref, preauth_total - final_amount, ...)
        
        await transition_case(session, approval.case_id, CaseStatus.COMPLETED)
        
        # Async: e-arşiv fatura oluştur (ARQ job)
        await enqueue_invoice_issue(approval.case_id)
```

---

## 12. Invariants — billing'e özel 14 kural

Backend invariants umbrella (§16) üstüne, billing'in kendi iç kuralları:

**I-BILL-1.** `sum(preauth holds) >= sum(estimate + approved_parts)` — her anda  
**I-BILL-2.** `final_amount <= sum(preauth holds)` — capture'da (§3.3)  
**I-BILL-3.** `gross = commission + net_to_technician` — decimal exact  
**I-BILL-4.** Idempotency key UNIQUE — her PSP çağrısı için  
**I-BILL-5.** Webhook HMAC signature fail → 401 reject  
**I-BILL-6.** Refund amount ≤ captured amount — over-refund engel  
**I-BILL-7.** Payout ancak `case.status='completed' + capture successful` sonrası scheduled  
**I-BILL-8.** Kasko reimbursement → refund amount = kasko_approved_amount (not > captured)  
**I-BILL-9.** Cancellation fee ≤ cancellation stage fee matrisi (over-charge engel)  
**I-BILL-10.** Partial refund sonrası net_to_technician recomputed — eski commission re-claim edilmez (platform iade için keserdi)  
**I-BILL-11.** `payment_idempotency.state='success'` olan bir çağrı iki kez denenmez  
**I-BILL-12.** Admin capture_override audit event zorunlu + reason zorunlu  
**I-BILL-13.** Subaccount payout (V2) — usta'ya payout ancak case.closed_at + 7 gün sonra (dispute penceresi)  
**I-BILL-14.** Chargeback (V2) → otomatik dispute + capture reverse + manuel review queue

---

## 13. Test senaryoları

### 13.1 Happy path
- `test_case_estimate_to_settled_simple` — offer accept → auth → invoice approve → capture → commission calc → settled
- `test_case_parts_approval_adds_preauth` — parts approval → delta authorize → capture with new total
- `test_case_cancel_before_dispatch_full_refund`
- `test_case_kasko_flagged_reimbursement_flow` — manuel admin reimburse
- `test_commission_flat_10_percent_v1`

### 13.2 Edge / race
- `test_psp_idempotency_duplicate_call_returns_same_ref`
- `test_concurrent_invoice_approval_and_dispute_locks`
- `test_capture_excess_preauth_auto_refunds_diff`
- `test_webhook_replay_same_payment_id_idempotent`
- `test_preauth_insufficient_raises_422`

### 13.3 Iyzico integration (sandbox)
- `test_iyzico_3ds_authorize_success_sandbox`
- `test_iyzico_3ds_fail_maps_to_preauth_failed`
- `test_iyzico_capture_partial_refund_flow`
- `test_iyzico_webhook_hmac_verify`

### 13.4 Admin flows
- `test_admin_kasko_reimburse_refunds_customer_card`
- `test_admin_dispute_partial_capture`
- `test_admin_payout_batch_completion`

### 13.5 Invariants
- `test_billing_invariant_sum_preauth_ge_approved_at_all_times`
- `test_billing_invariant_gross_equals_commission_plus_net`
- `test_billing_invariant_refund_cannot_exceed_capture`

~40+ test. Coverage %80+ bu modül için.

---

## 14. Faz planı

### Faz 1 — Şema + state machine (2 gün, BE)
- Migration: `case_commission_settlements`, `case_refunds`, `case_kasko_settlements`, `payment_idempotency`
- Billing state machine enum + service
- `service_cases.billing_state` kolonu (veya ayrı tablo)
- Unit test: billing state transitions

### Faz 2 — Iyzico V1.1 concrete + sandbox (2 gün, BE)
- `app/integrations/psp/iyzico.py` concrete impl
- 3DS checkout flow
- Webhook endpoint + HMAC verify
- Sandbox happy path tests
- PSP failure scenarios

### Faz 3 — Case billing service layer (2 gün, BE)
- `case_billing.py` orchestrator (initiate, parts, invoice, cancel, kasko, commission)
- `refund_policy.py` cancellation fee calc
- Integration tests

### Faz 4 — API endpoints + admin + e-arşiv stub (1.5 gün, BE)
- Müşteri endpoint'leri (§10.1)
- Admin endpoint'leri (§10.3)
- E-arşiv integration stub (V1 provider — sonradan)

### Faz 5 — Test + audit + observability (1 gün)
- 40 test tam suite
- Prometheus metric (`billing_capture_total`, `billing_refund_total`, `commission_collected_try_total`)
- Audit event'leri
- KARAR-LOG güncelleme

**Toplam:** ~7-8 iş günü. Tek dev. Faz 1-2 sequential (migration + PSP hazır olmadan service yazılamaz); Faz 3-4 mostly paralel.

---

## 15. Out of scope (V2 ve sonra)

- **Iyzico Subaccount otomatik payout** — V2
- **Sigorta API entegrasyonu** (kasko auto-reimburse) — V2
- **GIB e-fatura direkt** — V2 (hacim gerektirir)
- **Chargeback + dispute otomasyonu** — V2
- **Tier'lı komisyon** (performance-bazlı) — Faz 8 matching motoru ile
- **Taksit (installment)** — V2
- **Usta cüzdan pattern** (biriken net tutarı istediğinde çeksin) — V2
- **Platform spor komisyon** (vergi iadesi vb.) — V3

---

## 16. Launch critical path

Bu brief bitmeden **pilot launch yapılamaz**. Backend Faz A PR 4-9 + bu brief (7-8 gün) + mobil wire-up (FE 1-2 gün) = **~12-14 iş günü yolu**.

Şu an Faz A PR 1-3 shipped (19%). Kalan Faz A ~10 gün + Billing 7-8 gün = ~17-18 gün backend. Paralel:
- FE hasar + arıza + çekici composer (~5 gün)
- FE mobil wire-up (~3 gün)
- Legal + hukuki metin (~1-2 hafta BD + avukat)

**Pilot launch ETA (bugünden itibaren):** ~4-5 hafta. Launch için bir de pilot kapsam + **Kayseri 10 gerçek usta + 10 mock (is_mock=true) seed** + TestFlight + Internal Testing + App Store review.

Bu brief launch'un **en kritik tek backend parçası** şu noktadan sonra.

---

## 17. PO merge kriterleri

Billing service'i **launch'a hazır** diyebilmek için:

- [ ] 40+ test green (unit + integration + sandbox)
- [ ] Iyzico sandbox capture + refund + 3DS tam çalışıyor
- [ ] Webhook HMAC verify + idempotency test edilmiş
- [ ] 14 invariant test ile doğrulanmış
- [ ] Admin kasko reimburse flow end-to-end (sandbox)
- [ ] Weekly payout batch report üretiyor
- [ ] Prometheus metric'ler yayında
- [ ] E-arşiv provider seçilmiş + entegrasyon stub (V1 için yeterli)
- [ ] KARAR-LOG Faz X girişi + [backend-is-mantigi-hiyerarsi.md §12.2](backend-is-mantigi-hiyerarsi.md#122-diğer-vakalar-bakımkazaarıza--biz-henüz-yazmadık) "kapatıldı" flag

PO her PR'da spot-check: idempotency key'ler + invariant testleri + HMAC verify.

---

## 18. Referanslar

- [docs/backend-is-mantigi-hiyerarsi.md §12](backend-is-mantigi-hiyerarsi.md#12-financial-flow) — umbrella (kapatılan bölüm)
- [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) — billing launch blocker vurgusu
- [docs/cekici-backend-mimarisi.md §14](cekici-backend-mimarisi.md#14-psp-entegrasyon-abstraksiyonu) — PSP Protocol pattern reuse
- [docs/naro-urun-use-case-spec.md](naro-urun-use-case-spec.md) — north star, UC-4 Ödeme olgunluk %30 🔴 launch blocker
- [naro-backend/app/integrations/psp/](../naro-backend/app/integrations/psp/) — Protocol + Mock + Iyzico stub (Faz 10 shipped)
- [naro-backend/app/models/tow.py](../naro-backend/app/models/tow.py) — `tow_fare_settlements` + `tow_payment_idempotency` pattern kaynak

---

**v1.0 — 2026-04-22** · Backend billing servisi — launch blocker brief · BACKEND-DEV implementation manifest
