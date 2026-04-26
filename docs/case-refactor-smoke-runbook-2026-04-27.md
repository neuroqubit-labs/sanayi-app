# Vaka Omurgası Refactor Smoke Runbook

Tarih: 2026-04-27

Amaç: Faz 1-7 sonrası müşteri app, servis app ve backend'in aynı vaka sözleşmesine göre çalıştığını manuel olarak doğrulamak.

## Smoke Ön Koşulları

- Backend çalışıyor.
- Customer app ve service app aynı backend'e bağlı.
- En az bir müşteri kullanıcısı, bir araç ve iki servis kullanıcısı var.
- Servislerden biri test case ile uyumlu, diğeri uyumsuz olacak şekilde capability/service area verisine sahip.
- Payment provider dev ortamda mock veya sandbox modunda.
- Google Maps key ve backend route fallback ayarları çalışır durumda.

Genel backend gate:

```bash
cd naro-backend
uv run ruff check app tests
uv run pytest tests/ -v --tb=short
```

Naming gate:

```bash
rg -n "extra_payment|additional_payment|additional_amount|\\bbid\\b" \
  naro-app/src naro-service-app/src naro-backend/app
```

## 1. Customer Case -> Uygun Usta -> Vakayı Bildir -> Teklif

Setup:

- Müşteri uygulamasında araç seçili.
- Maintenance veya breakdown case oluşturulabilecek durumda.
- Servis A case türü/lokasyon/etiket ile uyumlu.
- Servis B uyumsuz veya düşük uyumlu.

Adımlar:

1. Müşteri maintenance veya breakdown case oluşturur.
2. Vaka profilini açar.
3. Uygun usta bandı/kartlarında Servis A'nın "Bu vakaya uygun" sinyaliyle geldiğini görür.
4. Müşteri Servis A için "Vakayı bildir" aksiyonunu çalıştırır.
5. Servis app'te Servis A pool/inbox ekranında "Size bildirildi" rozetini görür.
6. Servis A case için teklif gönderir.

Beklenen state:

- Case oluşur ve araçla ilişkilidir.
- `preferred_technician_id` müşteri niyeti olarak kalabilir.
- `assigned_technician_id` set edilmez.
- Bildirim assignment veya appointment oluşturmaz.
- Teklif oluşur; appointment yalnız teklif kabulünden sonra oluşabilir.

DB kanıt:

- `service_cases.vehicle_id IS NOT NULL`
- `service_cases.assigned_technician_id IS NULL`
- `case_technician_matches` içinde uyumlu servis kaydı
- `case_technician_notifications` içinde bildirilen servis kaydı
- `case_offers` içinde servis teklif kaydı

Fail sayılır:

- Bildirim sonrası case doğrudan assigned olursa.
- Bildirim match gibi fake sistem uyumu yaratırsa.
- Offer olmadan appointment oluşursa.

## 2. Offer Accept -> Appointment -> Service Process

Setup:

- Pending offer olan bakım/arıza/hasar case.
- Müşteri ve servis app aktif.

Adımlar:

1. Müşteri teklif detayını açar.
2. Teklifi kabul eder.
3. Appointment oluştuğunu görür.
4. Servis appointment approve eder.
5. Müşteri vaka süreç ekranını açar.
6. Servis gerekirse parts request veya invoice approval oluşturur.

Beklenen state:

- Offer accept olmadan appointment yoktur.
- Appointment approve sonrası `assigned_technician_id` set edilir.
- Vaka eşleşme sonrası süreç ekranına girer.
- Parts/invoice açıklaması en az 10 karakter olmalıdır.
- Completion açıklama zorunlu değildir.
- UI dili "ek ödeme" değil, "kapsam/parça onayı" ve "final fatura" eksenindedir.

DB kanıt:

- `appointments.offer_id IS NOT NULL`
- `service_cases.assigned_technician_id = accepted_technician_id`
- `case_approvals.description` parts/invoice için dolu
- `case_approvals.revision_amount` varsa kontrollü kapsam/fatura tutarıdır

Fail sayılır:

- Direct appointment akışı bakım/arıza/hasar için çalışırsa.
- `assigned_technician_id` teklif/appointment onayı öncesi set edilirse.
- Approval UI "ek ödeme"yi normal beklenen süreç gibi gösterirse.

## 3. Immediate Tow

Setup:

- Müşteri app'te araç seçili.
- Pickup/dropoff seçimi yapılabilir.
- Payment provider mock veya sandbox çalışır.
- En az bir çekici servis online veya test fallback senaryosu biliniyor.

Adımlar:

1. Müşteri acil çekici çağırma ekranını açar.
2. Pickup ve dropoff seçer.
3. Backend quote ile "En fazla" tutarını görür.
4. Ödeme/preauth adımını tamamlar.
5. Tracking ekranında dispatch/searching sürecini görür.
6. Servis tarafında çekici işi kabul edilir.
7. Delivered transition tamamlanır.

Beklenen state:

- Preauth olmadan dispatch başlamaz.
- Immediate tow pool/offer feed'inde görünmez.
- Payment success sonrası dispatch başlar.
- Delivered sonrası final capture helper idempotent çalışır.

DB kanıt:

- `tow_cases.tow_mode = immediate`
- `tow_cases.tow_stage` payment sonrası `searching` veya sonraki dispatch stage
- `payment_orders.state` preauth/capture akışına göre ilerler
- `tow_settlements.preauth_id` payment sonrası doludur
- Dispatch attempt kayıtları yalnız payment sonrası oluşur

Fail sayılır:

- Immediate tow havuz/teklif ekranında görünürse.
- Payment/preauth olmadan dispatch attempt oluşursa.
- Delivered sonrası capture tekrar tekrar yan etki üretirse.

## 4. Scheduled Tow Payment Window

Setup:

- Gelecek zamana planlı çekici case oluşturulabilir.
- Payment window lead süresi test ortamında bilinir.

Adımlar:

1. Müşteri planlı çekici case oluşturur.
2. Tracking ekranında payment window açılmadan bekleme mesajını görür.
3. Payment window açıldığında ödeme CTA'sı görünür.
4. Ödeme tamamlanır.
5. Scheduled zaman henüz gelmediyse dispatch başlamaz.
6. Scheduled zaman geldiyse dispatch başlar.

Beklenen state:

- İlk stage `scheduled_waiting`.
- Payment window öncesi CTA yoktur.
- Payment sonrası zaman gelmediyse yine scheduled bekleme devam eder.
- Zaman geldiyse dispatch stage'e geçilir.
- Scheduled tow pool/offer modeline düşmez.

DB kanıt:

- `tow_cases.tow_mode = scheduled`
- `tow_cases.tow_stage` sırasıyla `scheduled_waiting`, payment window'da `payment_required`, sonra timing'e göre `scheduled_waiting` veya `searching`
- `payment_orders` yalnız payment window açıldıktan sonra oluşur

Fail sayılır:

- Scheduled tow normal bakım/arıza/hasar teklif havuzuna düşerse.
- Payment window öncesi preauth alınırsa.
- Payment success hemen ve zamandan bağımsız dispatch başlatırsa.

## 5. Ek Ödeme Yokluğu / Kapsam-Fatura Onayı

Setup:

- Eşleşmiş service case `service_in_progress` durumunda.
- Servis app parts request ve invoice approval oluşturabilir.

Adımlar:

1. Servis parts request'i açıklamasız göndermeyi dener.
2. Servis kısa açıklamayla göndermeyi dener.
3. Servis 10+ karakter açıklamayla geçerli parts request oluşturur.
4. Müşteri approval sheet'i açar.
5. Müşteri online ödeme, serviste kart veya nakit seçeneklerini görür.
6. Offline ödeme seçilirse approval kaydı ilerler ama payment order oluşmaz.

Beklenen state:

- Parts/invoice açıklamasız veya kısa açıklamayla reddedilir.
- Completion için açıklama zorunlu değildir.
- Online seçilirse Payment Core direct capture akışı başlar.
- Offline kart/nakit seçilirse ödeme Naro üzerinden alınmaz, yalnız kayıt tutulur.
- "Ek ödeme / ek tutar" dili ürün yüzeyinde normal akış olarak görünmez.

DB kanıt:

- `case_approvals.kind IN (parts_request, invoice)`
- `case_approvals.description` geçerli açıklamayı taşır
- `case_approvals.payment_method` müşteri seçimine göre set edilir
- Online seçenekte `payment_orders.subject_type = case_approval`
- Offline seçenekte payment order oluşmaz

Fail sayılır:

- Approval açıklamasız geçerse.
- Offline ödeme commission/payment order üretirse.
- UI "ek ödeme"yi normal beklenen süreç gibi sunarsa.

## Smoke Kapanış Notu

Smoke başarılı kabulü için:

- Beş senaryonun tamamı UI ve DB kanıtıyla doğrulanır.
- Ham `API error` mesajı görülmez.
- Vaka profili/dossier, müşteri ve servis rollerinde role-safe veri gösterir.
- Çekici akışı ile normal servis havuzu birbirine karışmaz.
- Naming gate temiz kalır.
