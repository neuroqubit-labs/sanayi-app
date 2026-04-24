# Tow Mock-to-Live Map — 2026-04-23

## Customer App

| Alan | Bugünkü kaynak | Backend canonical | Risk | Sonraki adım |
|---|---|---|---|---|
| Auth | Live | `/auth/*` | Düşük | Olduğu gibi kalabilir |
| Vehicle CRUD | Live | `/vehicles*` | Düşük | Olduğu gibi kalabilir |
| Case create (non-tow) | Live POST + local detail inject | `/cases` | Orta | Detail/actions da live'a taşınmalı |
| Case list/summary | Live | `/cases/me`, `/cases/{id}` | Düşük | Olduğu gibi kalabilir |
| Case detail / offers / thread / appointments / cancel | Local `useCasesStore` | `/offers*`, `/appointments*`, `/cases/{id}/cancel` | Yüksek | Live queries + mutations yazılmalı |
| Tow composer | Local `useTowStore` | `/tow/fare/quote`, `/tow/cases` | Çok yüksek | Backend'e geçirilmeli |
| Tow case tracking | Local snapshot + WS overlay | `/tow/cases/{id}`, `/tracking`, `/ws/tow/{id}` | Çok yüksek | Snapshot backend tabanlı olmalı |
| Tow cancel / OTP / rating | Local store | `/tow/cases/{id}/cancel`, `/otp/verify`, `/rating` | Çok yüksek | Route client'ları yazılmalı |
| Billing initiate / summary | Live | `/cases/{id}/payment/initiate`, `/billing/summary` | Orta | Route parity korunmalı |
| Billing refunds / approvals / dispute | Hook var ama yanlış path | `/cases/{id}/approvals*`, refunds route yok | Yüksek | Canonical path/shape'e hizalanmalı |

## Service App

| Alan | Bugünkü kaynak | Backend canonical | Risk | Sonraki adım |
|---|---|---|---|---|
| Login / shell-config | Live | `/auth/*`, `/technicians/me/shell-config` | Düşük | Olduğu gibi kalabilir |
| Payouts | Live | `/technicians/me/payouts` | Düşük | Olduğu gibi kalabilir |
| Tow availability toggle | Local store | Gerçek availability + dispatch ingress gerekir | Orta | Tow online/offline state backend ile hizalanmalı |
| Incoming dispatch | Demo `SAMPLE_DISPATCH` | `/tow/cases/{id}/dispatch/response` + push/realtime | Çok yüksek | Realtime dispatch ingress yazılmalı |
| Tow active job | Local store | `/tow/cases/{id}`, `/otp/issue`, `/otp/verify`, `/evidence` | Çok yüksek | Real job modeline taşınmalı |
| Live location broadcaster | Kısmi live ama yanlış path | `/tow/cases/{id}/location` | Çok yüksek | Path düzeltilmeli, demo akış ayrılmalı |
| Pool feed | Local `useJobsStore` | `/pool/feed` | Yüksek | Live query yazılmalı |
| Offer submit | Local `useJobsStore.submitOffer` | `/offers` | Yüksek | Live mutation yazılmalı |
| Incoming appointments | Local store | `/appointments*` | Yüksek | Live query/mutation yazılmalı |
| Job detail / messages / evidence | Local store | `/cases/{id}` + ilgili route'lar | Yüksek | Live zincire geçirilmeli |

## Hangi Bug'lar Mock Zincirinde Maskeleniyor?

- Tow cancel fee/refund backend bug'ı customer ve service app local store nedeniyle kullanıcıya yansımıyor.
- Tow dispatch occupancy bug'ı provider/client canlı zinciri bağlı olmadığı için görünmez kalıyor.
- Wrong tow eligibility (`towing -> usta`) service app pool local matrix içinde birebir tekrar ediyor.
- Non-tow offer/appointment flow bug'ları iki app'te de local state altında saklanıyor.

## Geçiş Kuralı

- Demo store yalnızca açıkça "preview/demo" etiketli modda kalmalı.
- Launch path ekranları authoritative backend state okumalı.
- "Live + local shadow" modeli yalnızca geçici migration aşamasında kabul edilmeli; shadow state ana gerçeklik olmamalı.
