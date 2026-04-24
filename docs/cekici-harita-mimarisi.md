# Çekici Harita Mimarisi — 3 Katmanlı Canonical Spec

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbetler:** UI-UX-FRONTEND-DEV (both apps) + BACKEND-DEV
> **Kapsam:** naro-app (müşteri) + naro-service-app (çekici usta) + backend harita altyapısı
> **Kardeş dokümanlar:** [cekici-modu-urun-spec.md](cekici-modu-urun-spec.md) (ürün UX) · [cekici-backend-mimarisi.md](cekici-backend-mimarisi.md) (backend ops, Faz 10 shipped)

---

## 1. Context — bu doc neden var

Çekici hizmeti Naro'nun **haritaya en bağımlı** ürünü. Müşteri endişeli (panikte), usta sahada (sürüyor), backend gerçek zamanlı akış tutuyor. Üç tarafın senkronize + güven veren + performanslı bir harita deneyimi sunması gerekir.

Mevcut durum:
- **Backend tarafı** [Faz 10](cekici-backend-mimarisi.md) ile **büyük ölçüde hazır** — PostGIS + Redis Streams + WebSocket + Mapbox client + `tow_live_locations` partitioned + 4 ARQ cron.
- **Frontend tarafı** — çekici scaffold (`naro-service-app/src/features/tow/TowDispatchSheet.tsx`) + composer map picker stub (`naro-app/.../LocationPicker.tsx`) mevcut ama **yapısal harita component paketi yok**. Her ekran kendi map'ini sıfırdan yazabilir → kaos.
- **Use case** henüz uçtan uca yazılı değil — kullanıcı hangi ekranda haritada ne görür, tek sayfada yok.

Bu doc bunları toplar. Uber copy değil, **Naro use case'e göre Uber'den öğrenilmiş ama farklı** bir mimari.

### 1.1 Uber'den ne alıyoruz, ne almıyoruz

**Alıyoruz:**
- Map-first customer UX (hemen çağrı ekranı = harita + aşağıda aksiyon)
- Live truck pin moving toward pickup
- ETA countdown
- "Arriving" / "Arrived" toast + kart
- Route line (pickup → dropoff)
- Driver card (truck info + rating + contact)

**Almıyoruz:**
- Turn-by-turn navigation (V1'de yok — usta kendi Yandex/Google Maps'i ile yürür; V2 opsiyonel in-app)
- Surge pricing görselleştirme (cap üstü fiyat yok, platform absorbe)
- Trip sharing dışarıya (V2 — "aracım taşınıyor, arkadaşım takip etsin")
- Pool / shared rides (çekici tek-iş)
- Heatmap (demand visualization — V3)

---

## 2. Use case haritası — kim, nerede, ne görür

### 2.1 Müşteri (naro-app)

| Ekran | Map tipi | Görünen |
|---|---|---|
| **Çekici çağır — Adım 1** | Interactive picker | GPS default pin + sürüklenebilir + reverse geocode etiket |
| **Dropoff seçim** (opsiyonel) | Interactive picker | Kullanıcı ikinci pin koyar; ~~Dropoff boşsa "anlaşırız"~~ aşamasında çekici konuşur |
| **Dispatch arama** | Animasyonlu statik | GPS etrafında radar dalga animasyon, çekici pin yok |
| **Match bulundu** | Static preview | Pickup pin + tech workshop pin (çekici gerçek GPS değil henüz, sadece workshop) |
| **En route — live tracking** | Live map | Pickup pin + **truck pin moving** + route line (opsiyonel) + ETA marker |
| **Arrived (vardı)** | Live map, zoom in | Pickup pin üstünde truck arrived çemberi + OTP ekranı üstte |
| **In transit** | Live map | Truck pin moving toward dropoff pin + route line + ETA |
| **Delivered** | Static | Dropoff pin + delivery photo thumbnail + özet kart |
| **Composer — harici akışlarda** | Picker (bakım/arıza) | Aynı pattern — §2 LocationPicker |

### 2.2 Usta / Çekici (naro-service-app)

| Ekran | Map tipi | Görünen |
|---|---|---|
| **Accept sheet (incoming dispatch)** | Mini static map | Pickup pin + current tech location + mesafe badge (4.2 km) + fare preview |
| **Active job — heading to pickup** | Live map | Pickup pin + self GPS pulse + route line (Mapbox Directions opsiyonel) + ETA + stage progress bar |
| **At pickup (arrived)** | Live zoomed | Pickup pin + self pin zoom + "Vardım" + photo + OTP input |
| **Loading** | Static overlay | Pickup pin + "Yükleniyor" badge + photo upload |
| **In transit** | Live map | Dropoff pin + self GPS + route line + ETA |
| **At dropoff** | Live zoomed | Dropoff pin + "Teslim" + photo + recipient OTP |
| **Profil / service area** | Static + overlay | Workshop pin + radius circle + working_districts shaded |
| **Onboarding service-area step** | Interactive picker + radius slider | Pin drag + radius slider (5/10/15/25/50 km) |
| **Shell header GPS status badge** | Icon only | GPS on/off, battery warning |

### 2.3 Backend

| İş | Map etkisi |
|---|---|
| **Dispatch scoring** (tow_dispatch) | PostGIS `ST_DWithin` + Mapbox distance matrix → top-k candidates |
| **Live location ingest** | `POST /tow/{case_id}/location` — DB insert (partition) + Redis SETEX + XADD stream |
| **WebSocket fan-out** | `/ws/tow/{case_id}` — customer + tech subscribe; Redis pub/sub consumer → broadcast |
| **Reverse geocode** | Mapbox Places API — backend caches 30g (pickup address enrich) |
| **Directions** | Mapbox Directions API — V1'de client-side (tech app), backend cache yok; V2 backend önerir ETA validation |
| **Proximity checks** | Service layer: arrival guard `ST_Distance` ≤ 500m (tech "vardım" dediğinde yanıltma engeli) |
| **Retention** | `tow_live_locations` delivered + 30g sonra partition drop (KVKK) |

---

## 3. Mimari — 3 katman

```
┌─────────────────────────────────────────────────────────────────┐
│  MOBILE — naro-app (müşteri)                                    │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ LocationPicker│    │ LiveTowMap   │    │ StaticTowMap │       │
│  │ (composer)    │    │ (live track) │    │ (delivered)  │       │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘       │
│         │                   │                                    │
│         ▼                   ▼                                    │
│  ┌─────────────────────────────────────────────────┐            │
│  │      packages/ui/map — shared component lib      │            │
│  │  MapView, TruckMarker, PinMarker, RouteLine,    │            │
│  │  RadiusCircle, GpsPulse, ETABadge, StaticPreview│            │
│  └─────────────────────────────────────────────────┘            │
│         ▲                   ▲                                    │
│         │                   │                                    │
│  ┌──────┴───────┐    ┌──────┴────────┐                          │
│  │ useLiveLocation│   │ useMapPicker  │                          │
│  │ (WS subscribe) │   │ (permission +  │                          │
│  │                │   │  geocode)     │                          │
│  └────────────────┘   └───────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                  │ WS /ws/tow/{case_id}
                  │ POST /api/v1/tow/{case_id}/location (tech only)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND                                                         │
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                    │
│  │ REST /tow/*      │   │ WS /ws/tow/{id}  │                    │
│  └──────┬───────────┘   └──────┬───────────┘                    │
│         │                       │                                │
│  ┌──────▼──────────┐    ┌──────▼──────────────┐                │
│  │ tow_location    │    │ tow_ws_fanout       │                │
│  │ service         │    │ (Redis pub/sub)     │                │
│  └──────┬──────────┘    └─────────────────────┘                │
│         │                                                        │
│  ┌──────▼──────────────┐   ┌───────────────────┐                │
│  │ tow_live_locations  │   │ Redis:            │                │
│  │ (partitioned daily) │   │  tow:location:{id}│                │
│  │ PostGIS geography   │   │  XADD stream      │                │
│  └─────────────────────┘   │  pub/sub channels │                │
│                              └───────────────────┘                │
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │ Mapbox integration                    │                       │
│  │ - reverse geocode (cached 30d)        │                       │
│  │ - distance matrix (dispatch scoring)  │                       │
│  │ - directions (V2)                     │                       │
│  │ - haversine fallback                  │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                  ▲
                  │ POST /api/v1/tow/{case_id}/location
                  │ WS /ws/tow/{case_id}
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│  MOBILE — naro-service-app (çekici usta)                        │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ AcceptMini   │    │ ActiveTowMap │    │ ServiceArea  │       │
│  │ Map (sheet)  │    │ + GPS stream │    │ Picker (onb) │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────────────────────────────────────────┐            │
│  │      packages/ui/map — aynı shared lib           │            │
│  └─────────────────────────────────────────────────┘            │
│         ▲                                                        │
│         │                                                        │
│  ┌──────┴─────────────┐                                         │
│  │ useLiveLocation    │                                         │
│  │ Broadcaster (tech) │                                         │
│  │ - 5s moving        │                                         │
│  │ - 15s stationary   │                                         │
│  │ - offline queue    │                                         │
│  └────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Teknoloji kararları (PO locked)

### K-M1 — Map SDK: `@rnmapbox/maps`
**Sebep:** Mapbox zaten K-P2'de backend için seçildi. RN için en olgun Mapbox wrapper. Native performans (iOS MapKit Metal-based / Android OpenGL). Offline tile support V2. Custom style Naro brand için uygun (dark theme default).

**Alternatif düşünülüp elendi:**
- `react-native-maps` (Google/Apple) — GP billing riski + tile style limited
- Apple Maps — iOS-only
- Leaflet (webview) — perf zayıf mobilde

### K-M2 — Tile style
2 style:
- **Light day** — gündüz varsayılan
- **Dark night** — gece 20:00-06:00 otomatik + kullanıcı toggle

Naro marka renkleri route line + pin'lerde (brand-500 turuncu-kırmızı).

### K-M3 — Token management
- **Public token** — mobil bundle'a gömülü (Mapbox Secret Key mobile'a ASLA)
- **Secret token** — backend env (`MAPBOX_BACKEND_TOKEN`)
- **Proxy reverse geocode** — mobil doğrudan Mapbox'a değil, **backend üzerinden** (`POST /api/v1/maps/reverse-geocode`) — abuse limit + audit + cache paylaşımı
- Exception: interactive map tile rendering — mobil Mapbox CDN'e doğrudan (public token ile)

### K-M4 — GPS broadcast protokolü
**Client → server:** REST `POST /api/v1/tow/{case_id}/location` (idempotent, retry-safe, offline queue'da kuyruğa)
**Server → client fan-out:** WebSocket `/ws/tow/{case_id}` (push event-based)

**Sebep:** REST push POST — network failure durumunda client retry kolay; idempotency via `captured_at` dedupe. WS server-to-client sadece fan-out için; reverse yönde WS kullansak idempotency + offline + reconnect karmaşası.

### K-M5 — GPS stream sıklığı
- **Moving** (speed > 2 km/h VEYA son lokasyondan > 5m delta): **5 saniye**
- **Stationary** (ikisi de değil): **15 saniye**
- **Offline** (no network): local queue (AsyncStorage + Zustand persist), connectivity dönünce batch send (captured_at korur)
- **App background** (çekici beklemede veya yemekte): **30 saniye** — iOS significant location + Android foreground service

### K-M6 — Live tracking connection lifetime
WebSocket bağlantısı `tow_stage` `accepted` (ilk) → `delivered` VE `cancelled` (son) arasında açık. Stage terminal olunca client + server her iki tarafta close.

### K-M7 — Fallback — Mapbox API down
- **Reverse geocode fail** → static "Konumu manuel gir" text field fallback
- **Directions fail** → route line gösterme, düz pickup-dropoff line
- **Tile fail** → static grid placeholder + "Harita yüklenemiyor" badge
- **Haversine** — her durumda fallback mesafe ve ETA (backend internal)

### K-M8 — Privacy
- **Public tile data** — Mapbox kendi başı
- **GPS trail** customer görebilir (kendi vakası) + tech (kendi stream) + admin
- Delivered + 30g sonra `tow_live_locations` partition **hard drop** (KVKK)
- GPS trail asla başka teknisyenlere görünmez (tow dispatch adayı olsa bile)

---

## 5. Shared component library (`packages/ui/map/`)

Yeni dizin: `packages/ui/src/map/`. İki app da tüketir — tek kaynak.

### 5.1 Componentler

| Component | Prop | Kullanım |
|---|---|---|
| `<MapView>` | `center, zoom, style, children, onRegionChange` | Base wrapper — @rnmapbox/maps etrafında. Dark/light style switcher dahil. |
| `<PinMarker>` | `kind: pickup\|dropoff\|workshop\|self\|arrived, coord, label?` | Categorized pin — Naro brand iconography |
| `<TruckMarker>` | `coord, heading, pulse: bool, size?` | Çekici animated pin. Pulse halo for "live". Heading rotasyon. |
| `<RouteLine>` | `coords[], style?` | Pickup → dropoff polyline. Mapbox Directions dönüşünden GeoJSON, V1 fallback düz çizgi. |
| `<RadiusCircle>` | `center, radiusKm, style?` | Service area overlay (transparent fill + ince border) |
| `<GpsPulse>` | `coord, color?` | Müşteri kendi konumu için dalga animasyon |
| `<ETABadge>` | `minutes, label?` | Route üstüne pin-style ETA (12 dk) |
| `<StaticMapPreview>` | `coords[], size, zoom` | Non-interactive snapshot — Mapbox Static API veya inline SVG fallback |
| `<MapControlCluster>` | `buttons: ControlButton[]` | Sağ üst köşede My Location / Layer / Zoom |

### 5.2 Hook'lar

| Hook | Dönen | Kullanım |
|---|---|---|
| `useMapPicker({initial, onChange})` | `{ coord, address, setCoord, frequentPlaces[], requestGPS }` | Composer map picker (bakım + hasar + çekici + çekici dropoff) |
| `useLiveTowLocation({caseId, role})` | `{ latest, history[], isConnected, error }` | Müşteri + tech live track ekranları (WS subscribe) |
| `useLiveLocationBroadcaster({caseId, active})` | `{ status, queueDepth, sendNow, pause }` | Tech active job sırasında GPS push |
| `useGpsPermission()` | `{ status, request, denied }` | Permission flow |
| `useReverseGeocode({lat, lng})` | `{ address, loading, error }` | Backend proxy call |
| `useDirections({from, to})` | `{ route: GeoJSON\|null, distance, duration }` | V1 opsiyonel; V2 primary |

### 5.3 Zorunlu Naro UX davranışları

- **Dark theme default** (app genel tonu)
- **Pickup pin turuncu-kırmızı** (brand), **dropoff yeşil** (success), **workshop gri** (neutral), **truck pin aktif turuncu + pulse halo**
- **GPS izin denied** — permission sheet "Konumun çekici çağırman için kritik" açıklama + "Ayarlara git" buton + **manuel text fallback**
- **Low battery warning** — tech app active job'da battery %20 altı ise modal: "Şarja tak, stream kesilebilir"
- **Map tile loading skeleton** — dark gri grid + spinner

---

## 6. Müşteri app (naro-app) — use case flow detay

### 6.1 Çekici çağır akışı

```
[Adım 1 — Pickup picker]
  MapView (GPS default pin) + draggable PinMarker(pickup)
  + onChange → useReverseGeocode → address chip + setCoord
  + "Haritayı aç" tap → full-screen map picker modal
  + "Konumumu kullan" button → requestGPS

[Adım 2 — Dropoff picker (opsiyonel)]
  Same pattern, PinMarker(dropoff)
  Tap "Şimdilik atla" → null dropoff, "anlaşırız" notu
  
[Adım 3 — Vehicle + state + confirm]
  Static summary + cap + submit

[Dispatch arama]
  Full-screen animasyon:
    background: MapView zoomed on pickup
    overlay: GpsPulse(pickup) dalga animasyon + "3 çekici arıyoruz 15sn..."
    cancel button (ücretsiz)

[Match bulundu]
  Hero card: truck info (name, rating, plate, truck type, ETA)
  Map: PinMarker(pickup) + PinMarker(workshop, tech'in atölyesi)
  Not: bu aşamada tech henüz yola çıkmadı — live location yok
  CTA: "Canlı takibi aç" → live tracker

[Live tracker — en route]
  Full screen MapView
    + PinMarker(pickup)
    + TruckMarker(tech_location, heading, pulse)
    + RouteLine(pickup → tech current)
    + ETABadge(X dk)
  Bottom sheet: stage progress (Yolda → Yaklaşıyor → Vardı → Yüklüyor → Yolda → Teslim)
  CTA: Call + Message + Cancel (fee warning)

[Arrived event (server pushed)]
  Toast "Çekici geldi" + vibrate
  Map zoom to pickup
  Overlay kart: 6-hane OTP (server-generated, customer'a WS'ten geldi)
  "Ustamıza söyle" — büyük rakamlar

[Loading event]
  Photo thumbnail preview (tech upload)
  "Yüklendi ✓" transition animasyon

[In transit]
  Map: PinMarker(dropoff) + TruckMarker + RouteLine(tech → dropoff) + ETA

[Delivered event]
  Arrived toast + delivery photo
  OTP input (kullanıcı veya teslim alan girer)
  Payment summary + invoice download

[Post — rating]
  Static map snapshot (route trail overlay)
  5-star rating + comment
```

### 6.2 WebSocket olayları (server → customer)
```typescript
type CustomerTowEvent =
  | { type: "match_found", tech: TechInfo, eta_minutes: number }
  | { type: "stage_changed", stage: TowStage, at: ISO }
  | { type: "location_update", location: TowLiveLocation }
  | { type: "arrived", pickup_otp: "######" }
  | { type: "loaded" }
  | { type: "delivered_pending_otp" }
  | { type: "delivered" }
  | { type: "cancelled", reason: string }
  | { type: "fare_finalized", amount, refund }
```

### 6.3 Critical UX rules

- **GPS permission denied** müşteri tarafında → **manuel adres + map pin** ile devam; composer blok olmaz
- **Network lost** live tracker — "Bağlantı aranıyor..." badge + son konum freeze + reconnect
- **App background → foreground** reconnect + catch-up event stream (`resume_from: ISO` WS message)

---

## 7. Usta app (naro-service-app) — use case flow detay

### 7.1 Accept sheet (incoming dispatch)

```
Full-screen modal (push'tan açılır, 15sn countdown)
  ┌──────────────────────────┐
  │  ⚡ ACIL ÇEKİCİ İSTEĞI   │
  │                          │
  │  [ StaticMapPreview ]    │
  │    PinMarker(pickup)     │
  │    PinMarker(tech_ws)    │
  │                          │
  │  📍 Maslak Kemer Cd.     │
  │  📏 4.2 km · ETA 12 dk   │
  │  🚗 BMW 320i · Çalışmıyor│
  │  💰 1.449 ₺ (komisyon    │
  │    sonrası)              │
  │                          │
  │  [ KABUL ]   [ RED ]     │
  └──────────────────────────┘
```

StaticMapPreview: Mapbox Static API (cached, client bundle).

### 7.2 Active job — heading to pickup

```
Full screen:
  MapView
    + PinMarker(pickup, pulse green)
    + TruckMarker(self_gps, pulse, heading)
    + RouteLine(self → pickup)  [V1: düz çizgi haversine; V2: Mapbox Directions]
    + ETABadge(X dk)
  
  Bottom sheet (swipe up for more):
    - Stage progress bar (Yolda → Yaklaşıyor → Vardı → ...)
    - Customer mini-card (name masked "Alfonso D.", phone obfuscated tap-to-call proxy)
    - Araç: BMW 320i · 34 ABC 42
    - [ Vardım ] (büyük CTA — arrival photo + enable next stage)
    - [ Ara ] [ Mesaj ]
    
  Header:
    GpsStatusBadge (iconu turuncu pulse = streaming)
    Battery warning chip
```

### 7.3 At pickup — OTP flow

```
Tap "Vardım":
  - Camera açılır (arrival photo zorunlu)
  - Photo upload via useMediaUpload (purpose=tow_arrival_photo)
  - Server: record_arrival + OTP issue
  - Customer push: "Çekici geldi" + OTP display
  - Tech UI:
    - OTP input (6-digit number pad)
    - "Müşteriden OTP'yi iste"
    - Verify on submit → "Yüklemeye başla" enabled
```

### 7.4 Loading + in transit + delivery

Stage progression pattern tekrar — her birinde:
- Photo zorunlu (tow_loading_photo, tow_delivery_photo)
- OTP doğrulama (loading kullanıcıdan, delivery recipient'tan)
- Stage button disabled olana kadar (evidence + OTP verified)

### 7.5 GPS broadcaster davranışı

`useLiveLocationBroadcaster({caseId, active: true})`:
- active=true iken: setInterval 5s (moving) / 15s (stationary)
- Her tick: `expo-location.getCurrentPositionAsync` → POST /location
- Offline (no network): AsyncStorage queue append (FIFO, max 1000 entries = ~5 saat stationary veya ~1.5 saat moving)
- Reconnect: queue flush (batch POST up to 50 entries)
- Battery < 20%: toast "Şarja tak" — stream continues ama kullanıcıya warn
- Battery < 10%: stream interval 15s forced (battery saving)
- `tow_stage ∈ {delivered, cancelled, timeout_converted_to_pool}` → stream stop, queue flush, unsub

### 7.6 Service area setup (onboarding)

```
Onboarding (provider_type='cekici' path):
  MapView full screen
    + PinMarker(workshop, draggable)
    + RadiusCircle(center=workshop, radius=sliderValue)
  Slider: 5 / 10 / 15 / 25 / 50 km
  Auto-detect districts (haversine from workshop + radius)
  Chip grid: working_districts (add/remove)
  "Kaydet" → PUT /me/service-area
```

---

## 8. Backend mimarisi (Faz 10 shipped + V2 talepler)

### 8.1 Şu an (Faz 10 canlı)

✓ `tow_live_locations` tablo (PostGIS geography + daily partitioning)
✓ `POST /api/v1/tow/{case_id}/location` endpoint
✓ `WS /ws/tow/{case_id}` WebSocket + Redis pub/sub fan-out
✓ Mapbox client (`app/integrations/maps/mapbox.py`) + haversine fallback
✓ `tow_dispatch_service` event-driven SQL scoring (PostGIS ST_DWithin)
✓ ARQ cron `tow_location_retention_purge` (KVKK 30g)

### 8.2 Eksik / geliştirilecek (V1.1 + V2)

**V1.1 (yakın):**
- `POST /api/v1/maps/reverse-geocode` — client proxy (K-M3 uyarınca); Mapbox secret key backend'de + cache 30g (Redis)
- `POST /api/v1/maps/static-preview` — Static API proxy (accept sheet mini map için backend cache, client hızlı yükleme)
- `tow_live_locations` içinde **stationary vs moving flag** (client gönderir, server validate) — retention + UX için

**V2:**
- Directions caching backend (Mapbox Directions çok sorgu; backend cache TTL 1h by route hash)
- Turn-by-turn nav içgömülü (V2 — opsiyonel)
- Heatmap demand visualization (admin dashboard)
- Offline tile delivery (fleet driver için, V3)

### 8.3 WebSocket events — sunucu → client

`app/api/v1/routes/tow_ws.py` (Faz 10 shipped) — event tipleri [cekici-backend-mimarisi.md §9](cekici-backend-mimarisi.md#9-websocket-protokolü) içinde. Bu doc'un §6.2 + müşteri event tipleri paralel.

### 8.4 Auth + visibility

- `/ws/tow/{case_id}` — query param `?token={jwt}`; middleware:
  - customer → `case.customer_user_id == user.id` ise OK
  - technician → `case.assigned_technician_id == user.id` ise OK
  - admin → all
  - Aksi: `WS 1008 Policy Violation` close
- GPS trail READ (`GET /tow/{case_id}/locations?from=&to=`) aynı visibility

---

## 9. Mapbox entegrasyon detayları

### 9.1 API kullanımları ve cache

| API | Kullanım | Cache stratejisi | Maliyet hafifletme |
|---|---|---|---|
| **Tiles (raster + vector)** | Map view render | Client SDK kendi cache | Offline tile download V2 |
| **Reverse Geocode** | Pickup/dropoff adres enrichment | Backend Redis 30g (key: `geocode:{rounded_lat_lng}`) | Backend proxy — mobile direct call YOK (K-M3) |
| **Forward Geocode** (text → coord) | Manuel adres yazarken autocomplete | Client-side, Mapbox search sessions API | — |
| **Directions** | Route line (pickup → dropoff) | V1 client-side; V2 backend cache 1h by route hash | V1'de opsiyonel (tech bazen direct line görür); haversine ETA |
| **Distance Matrix** | Dispatch scoring (top-k adaylar) | Backend, per-dispatch per-request | Radius pre-filter (PostGIS) → sadece 5-10 aday için matrix call |
| **Static API** | Accept sheet mini-map, delivered özet | Backend proxy + client cache 24h | Pre-generate sık konumlar (V2) |

### 9.2 Rate limit + quota

**Monthly limits (Mapbox free tier):**
- 100k map loads (tile requests) — 10k MAU ile uyumlu
- 100k geocoding — backend cache sonrası çok düşer
- 100k matrix — dispatch volume'a bağlı (10/gün vakada ~300/ay — güvenli)

**Backend quota monitoring:** Prometheus metric `mapbox_api_calls_total{api, status}`; günlük budget alert Slack.

### 9.3 Privacy

- Client'tan Mapbox'a giden **yalnızca public token + session id**. Kullanıcı PII (phone, email) Mapbox'a gitmez.
- Backend Mapbox çağrılarında `user_id` parametresi yok — sadece lat/lng + text query.

---

## 10. Performans + battery

### 10.1 Mobile rendering
- `@rnmapbox/maps` native — 60fps sabit
- Animated TruckMarker interpolation: location update 5s arada, lerp ile smooth movement (client-side interpolation between packets)
- Route line: max 500 nokta decimated (GeoJSON simplify); >500 ise polyline compression
- Rebuild avoid: React.memo + keyExtractor

### 10.2 Tech battery
- Background location API (iOS significant-location / Android foreground service)
- Battery < 20% warning; < 10% frequency reduction
- Screen off → 30s interval default (foreground service)
- Push notification with deep link on state change (reduce app-alive requirement)

### 10.3 Network
- 5s GPS post packet ~200 byte — 3.6 KB/min — very light
- WebSocket heartbeat 30s
- LTE/4G yeterli; 3G sorun değil

---

## 11. Test senaryoları (cross-platform)

### 11.1 Müşteri app
- `test_location_picker_gps_grant_flow`
- `test_location_picker_permission_denied_fallback`
- `test_live_tow_map_reconnect_after_background`
- `test_live_tow_map_websocket_disconnect_shows_last_location`
- `test_arrived_otp_displays_correctly`
- `test_delivered_confirmation_flow`

### 11.2 Tech app
- `test_accept_sheet_mini_map_renders`
- `test_gps_broadcaster_interval_moving_vs_stationary`
- `test_gps_broadcaster_offline_queue_flushes_on_reconnect`
- `test_battery_low_frequency_reduction`
- `test_arrival_proximity_check_rejects_faraway_vardim`
- `test_service_area_picker_radius_slider_updates_districts`

### 11.3 Backend
- `test_location_ingest_idempotency` (aynı captured_at 2 kez POST → tek insert)
- `test_ws_fanout_customer_and_tech_both_receive`
- `test_reverse_geocode_cache_hit`
- `test_mapbox_api_fail_fallback_haversine`
- `test_gps_trail_visibility_unauthorized_403`
- `test_location_retention_purge_after_delivered_30d`

---

## 12. Observability

**Prometheus metrics:**
- `tow_gps_ingest_total{status}` — POST /location sayısı
- `tow_gps_ingest_lag_seconds{bucket}` — captured_at vs received_at gecikme
- `tow_ws_connections_active{role}` — WebSocket açık sayısı
- `tow_ws_message_lag_ms{bucket}` — pub/sub fan-out gecikme
- `mapbox_api_calls_total{api, status}`
- `mapbox_cache_hit_ratio{api}`
- `tow_arrival_proximity_reject_total` — tech `vardım` dedi ama > 500m (fraud flag)

**Log:** structured per GPS ingest + WS event — user_id + case_id + stage + lag_ms.

**Alert:** 
- `mapbox_api_calls_total{status="error"}` > 1/sn 5dk → Slack
- `tow_ws_connections_active{role="customer"}` düşüş > 50% içinde 5dk → outage
- `tow_arrival_proximity_reject_total` > 10/saat → fraud flag manuel inceleme

---

## 13. KVKK + retention

| Veri | Retention | Purge |
|---|---|---|
| `tow_live_locations` | Delivered + 30 gün | ARQ cron `tow_location_retention_purge` (mevcut) |
| Reverse geocode Redis cache | 30 gün TTL | — (Redis kendi expire) |
| Static preview cache | 24 saat | — |
| WS session log | 90 gün | V2 cron |
| User GPS history in `service_cases.pickup_lat/lng` | Süresiz (vaka kaydı) | KVKK silme talebi → pseudonymize (round 2 decimal, ~1.1km grid) |

GPS koordinat hassasiyeti: DB 6-decimal (mm cinsinden hassas); public API döndürürken 4-decimal (~11m) round — privacy защит.

---

## 14. Faz planı

### Faz 1 — Shared component library (3 gün, FE)
- `packages/ui/map/` dizini + 9 component
- Hook'lar (useMapPicker, useLiveTowLocation, useLiveLocationBroadcaster, useGpsPermission, useReverseGeocode)
- Mapbox token config + dark/light style
- Storybook / mock story env

### Faz 2 — Müşteri use case'ler (3 gün, FE)
- LocationPicker composer'larda wire-up (bakım + hasar + çekici pickup + dropoff)
- Çekici live tracker screen
- Dispatch arama animasyon
- Arrived/delivered UI

### Faz 3 — Tech use case'ler (3 gün, FE)
- Accept sheet mini map
- Active job full screen map + stage progression
- GPS broadcaster (online + offline queue + battery)
- Service area picker (onboarding)

### Faz 4 — Backend proxy + V1.1 genişletme (2 gün, BE)
- `POST /api/v1/maps/reverse-geocode` proxy + Redis cache
- `POST /api/v1/maps/static-preview` proxy
- `tow_live_locations.is_stationary` flag
- WS event genişletme (heartbeat, resume)

### Faz 5 — Polish + observability (1 gün)
- Prometheus metric
- Alert rules
- Manuel smoke test staging

**Toplam:** ~12 iş günü · 2 FE dev paralel mümkün (customer + tech ayrı) → ~7 gün; BE 2 gün paralel.

---

## 15. Açık PO kararları

**Açık (dev geri dönüşü bekleyen):**

1. **@rnmapbox/maps vs alternatifler** — final karar (K-M1 PO önerim). Dev deneyimi/test sonrası geri dönüş → final lock.
2. **Turn-by-turn nav V1'de mi V2'de mi?** Öneri: V2. Dev app içi nav yazmaya başlarsa karmaşa → tech kendi Yandex/Google'ıyla. Ama dev "yazarım 2 gün" derse V1'e çekilebilir.
3. **Offline tile download** V3'e. V1'de online şart; 3G/LTE yeterli.
4. **Map theme** — gündüz/gece auto-switch vs user toggle. Öneri: **auto + manual override toggle header'da**.
5. **Tech → customer masked phone** — Twilio Proxy (K-M3 privacy) V2. V1'de direct phone shown (pilot için kabul edilir).

---

## 16. Invariant ekler (backend-is-mantigi-hiyerarsi §16'ya)

**I-MAP-1.** `tow_live_locations` sadece `tow_stage ∈ {accepted, en_route, nearby, arrived, loading, in_transit}` sürecinde insert edilir. Terminal state sonrası post → 409.

**I-MAP-2.** GPS trail read erişimi yalnızca case.customer_user_id | case.assigned_technician_id | admin. Başkasının case'ine WS connect → 1008.

**I-MAP-3.** Mapbox secret token asla mobil bundle'a gömülmez. Sadece backend env.

**I-MAP-4.** Arrival proximity check (`ST_Distance ≤ 500m`) tech "vardım" aksiyonunda zorunlu; aksi → 422 + fraud flag.

**I-MAP-5.** GPS post idempotency key = `(case_id, technician_id, captured_at)` UNIQUE; duplicate gelse drop.

**I-MAP-6.** `tow_live_locations` retention 30g post-terminal — cron zorunlu.

**I-MAP-7.** Public API GPS response'u 4-decimal round'ed (KVKK privacy); DB 6-decimal saklar.

---

## 17. Referanslar

- [docs/cekici-backend-mimarisi.md](cekici-backend-mimarisi.md) — Faz 10 backend (GPS + WS + PostGIS)
- [docs/cekici-modu-urun-spec.md](cekici-modu-urun-spec.md) — ürün UX + PO kararları
- [docs/rol-ui-mimarisi-frontend.md](rol-ui-mimarisi-frontend.md) — shell + çekici takeover
- [docs/backend-is-mantigi-hiyerarsi.md](backend-is-mantigi-hiyerarsi.md) — canonical invariant umbrella
- [packages/domain/src/tow.ts](../packages/domain/src/tow.ts) — TowLiveLocation + TowStage şemaları
- Mapbox GL JS docs + @rnmapbox/maps RN binding
- [naro-backend/app/integrations/maps/](../naro-backend/app/integrations/maps/) — client + haversine (Faz 10 shipped)

---

**v1.0 — 2026-04-22** · Çekici harita mimarisi · 3 katman (müşteri + tech + backend) · FE + BE brief
