# Rol UI Mimarisi — Frontend Brief

> **Sorumlu:** UI-UX-FRONTEND-DEV sohbeti
> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Kardeş doc:** [rol-ui-mimarisi-backend.md](rol-ui-mimarisi-backend.md)
> **Başlangıç:** Çekici implementasyonu (`naro-service-app/src/features/tow/`) tam olarak bu mimari üzerine oturacak

---

## 1. Context

Service app tek shell olamaz. Çekici rolü dar ekran seti + GPS-ağır; tamirci rolü geniş + GPS opsiyonel. İşletme modu (business vs bireysel) da UI davranışını etkiler (küçük işletme için kampanya/ekip/rapor overkill).

Frontend çözüm: **config-driven shell**. Backend `/me/shell-config` döner, shell/tab/+ menü/home layout buna göre render edilir. Hardcode matris UI katmanında olmaz — değişiklik = backend config değişikliği.

Mevcut durumda fixture'da zaten bu yönde hazırlık görüyorum (`secondary_provider_types: ["cekici"]`, `tow_operator` cert, [TowDispatchSheet.tsx](../naro-service-app/src/features/tow/screens/TowDispatchSheet.tsx) scaffold). Bu brief onu formalleştirip genelleştirir.

**Outcome:** Her rol × mode kombinasyonu için farklı shell + tab + widget kümesi render eden tek bir `naro-service-app`. Yeni aktör tipi (ör. satıcı) geldiğinde yeni shell variant eklenir, mevcut kodlar kırılmaz.

---

## 2. Canonical model (kısa)

```
provider_type         mevcut enum 6 değer — UI raw render'da kullanılır
provider_mode         NEW enum: business | individual (side_gig V2)
active_provider_type  NEW: multi-role kişi için "şu an hangi rolde"
role_config_version   NEW int: cache invalidation sinyal
```

Detay + matrisler [docs/rol-ui-mimarisi-backend.md §2-4](rol-ui-mimarisi-backend.md) içinde.

---

## 3. PO kararları (V1 — hepsi locked)

**K-R1** Side gig V2'de. V1'de `provider_mode` enum frontend'de de `business | individual`.

**K-R2** Default mode `business`. Onboarding'de değiştirilebilir.

**K-R3** `tow_operator` yeni cert_kind (fixture zaten kullanıyor). `capability_attestation` V2.

**K-R4** Çekici × `side_gig` **hard-yasak** — provider-type seçim sonrası mode seçim ekranında disabled + tooltip.

**K-R5** Active role switch **explicit** — multi-role kişi header'dan tap ile rol değişir; shell re-render.

---

## 4. Deliverable

### 4.1 Shared contract — [packages/domain/src/shell-config.ts](../packages/domain/src/shell-config.ts) (YENİ)

```typescript
export const ProviderModeSchema = z.enum(["business", "individual"]);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

export const HomeLayoutSchema = z.enum([
  "tow_focused",
  "full",
  "business_lite",
  "minimal",
  "damage_shop",
]);
export type HomeLayout = z.infer<typeof HomeLayoutSchema>;

export const QuickActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  route: z.string(),
  requires_capability: z.string().nullable().default(null),
});
export type QuickAction = z.infer<typeof QuickActionSchema>;

export const ShellConfigSchema = z.object({
  primary_provider_type: ProviderTypeSchema,
  active_provider_type: ProviderTypeSchema,
  provider_mode: ProviderModeSchema,
  secondary_provider_types: z.array(ProviderTypeSchema).default([]),
  verified_level: TechnicianVerifiedLevelSchema,
  admission_status: z.enum(["active", "pending", "suspended"]),
  admission_gate_passed: z.boolean(),
  enabled_capabilities: z.array(z.string()).default([]),
  home_layout: HomeLayoutSchema,
  tab_set: z.array(z.string()),
  quick_action_set: z.array(QuickActionSchema).default([]),
  required_onboarding_steps: z.array(z.string()).default([]),
  required_cert_kinds: z.array(TechnicianCertificateKindSchema).default([]),
  role_config_version: z.number().int(),
});
export type ShellConfig = z.infer<typeof ShellConfigSchema>;
```

Ayrıca `TechnicianCertificateKind` enum'a `tow_operator` ekle ([packages/domain/src/user.ts](../packages/domain/src/user.ts#L50)).

### 4.2 Shell architecture — tek shell, 4 sabit tab

> **Revize (2026-04-22):** 5 shell variant fikri sadeleştirildi. V1'de **tek shell**, tab iskeleti sabit: `home / havuz / kayitlar / profil`. Rol-spesifik varyasyon **home widget kompozisyonu** + **+ butonu quick_action_set** + **profil seksiyonları** + **modal/sheet açılışları** seviyesinde. Sebep: PO kararı — tab sayısı değişkenliği "farklı app" algısı yaratıyordu; sabit iskelet zihinsel model olarak temiz.

**Tab router:** `app/(tabs)/_layout.tsx` dört sabit tab'ı mount eder. `useShellConfig().home_layout`'a göre home içeriği değişir ama tab sayısı ve sırası sabit.

**Home layout varyantları (5, içerik seviyesinde):**

| `home_layout` | Hero | Ana row'lar |
|---|---|---|
| `tow_focused` | `ActiveTowJobHero` (büyük, active job varsa) veya `AvailabilityToggleCard` | `TodayEarningsCard`, `QuickQueueRow` |
| `full` | `BusinessSummaryCard` | `TowCapabilityCard` (capability varsa), `CampaignsRow`, `MobileServiceRow` (capability varsa), `OtherToolsList` |
| `business_lite` | `BusinessSummaryCard` | `CampaignsRow`, `OtherToolsList` |
| `minimal` | `ActiveJobsCountCard` | `AvailabilityToggleCard` |
| `damage_shop` | `DamagePoolCard` | `ExpertiseRequestsCard`, `CampaignsRow` |

**Özel ekranlar (tab değil, modal/sheet/deep-link):**
- Çekici aktif iş detayı → `CanliIsModal` (home hero tap veya push deep-link açar)
- Hasar ekspertiz akışı → `DamagePoolCard` tap → `ExpertiseFlowScreen` (stack push)
- Kampanyalar → `CampaignsRow` tap veya + menüden; full-screen modal

Shared screens (havuz/kayitlar/profil) aynı component'i kullanır ama `active_provider_type`'a göre filtrelenmiş veri gösterir.

### 4.3 Shell config hook + provider — `src/features/shell/`

```typescript
// useShellConfig.ts
export function useShellConfig(): ShellConfig {
  // V1: mock from fixtures; V2: fetch /me/shell-config
  // Header: X-Role-Config-Version cache hint
  // Version bump → auto-refetch
}

// ShellConfigProvider.tsx
<ShellConfigProvider>
  <ShellSwitcher />
</ShellConfigProvider>

// ShellSwitcher.tsx — shell config.home_layout değerine göre doğru shell render
```

### 4.4 Tab router — [app/(tabs)/_layout.tsx](../naro-service-app/app/(tabs)/_layout.tsx)

> **Revize:** Tab iskelet V1'de sabit → **4 tab her zaman mount edilir**: home, havuz, kayitlar, profil. Mevcut hard-coded yapı korunur (değişiklik yok). `shell_config.tab_set` forward-compat için gelir ama V1'de assert: sabit 4 değeri. V2'de genişletilirse tab router config-driven yapılır.

### 4.5 Home ekran — config-driven widget kompozisyonu

Mevcut [HomeScreen.tsx](../naro-service-app/src/features/home/screens/HomeScreen.tsx) yeniden düzenlenir:

```tsx
export function HomeScreen() {
  const config = useShellConfig();
  return (
    <Screen>
      {renderHeroByLayout(config.home_layout, config)}
      {renderWidgetsByLayout(config.home_layout, config)}
    </Screen>
  );
}
```

Widget matrisi (component mapping):

- `tow_focused`: `ActiveTowJobHero` + `AvailabilityToggleCard` + `TodayEarningsCard` + `QuickQueueRow`
- `full`: `BusinessSummaryCard` + `TowCapabilityCard` (capability varsa) + `CampaignsRow` + `MobileServiceRow` (capability varsa) + `OtherToolsList`
- `business_lite`: `BusinessSummaryCard` + `CampaignsRow` + `OtherToolsList`
- `minimal`: `ActiveJobsCountCard` + `AvailabilityToggleCard`
- `damage_shop`: `DamagePoolCard` + `ExpertiseRequestsCard` + `CampaignsRow`

Mevcut `TowCapabilityCard` tamirci home'da **capability-gated widget** olarak kalır; çekici home'da ana widget.

### 4.6 + butonu — `QuickActionsFab` config-driven

Mevcut FAB + sheet mantığı korunur ama item listesi `shellConfig.quick_action_set`'ten gelir:

```tsx
function QuickActionsSheet() {
  const { quick_action_set, enabled_capabilities } = useShellConfig();
  return (
    <Sheet>
      {quick_action_set.map((action) => (
        <ActionRow
          key={action.id}
          action={action}
          disabled={
            action.requires_capability != null
            && !enabled_capabilities.includes(action.requires_capability)
          }
        />
      ))}
    </Sheet>
  );
}
```

Hardcode action listesi YOK. Şu an [QuickActionsSheet](../naro-service-app/src/features/home/components/QuickActionsSheet.tsx) gibi yerlerde hard-coded liste varsa config'e taşınır.

### 4.7 Active role switch UI

Header component yeni: `ActiveRoleSwitcher`. `secondary_provider_types.length > 0` ise header'ın sağında chip. Tap → bottom sheet:

```
┌─────────────────────────┐
│  Şu an hangi rolde?     │
├─────────────────────────┤
│  ● Usta (şu an)        │
│  ○ Çekici               │
└─────────────────────────┘
```

Seçim → `POST /me/switch-active-role` → shell config refetch → shell animate transition.

Secondary yoksa chip gösterilmez (tek rollü kullanıcılar için UI temiz).

### 4.8 Onboarding fork

Mevcut onboarding [app/(onboarding)/](../naro-service-app/app/(onboarding)/) şu an 5 adım `provider-type → business → capabilities → certificates → review`.

Yeni akış:

```
provider-type.tsx
    ↓
provider-mode.tsx  (YENİ — business | individual seçim)
    ↓  (çekici + side_gig yasak ama zaten side_gig V1'de yok)
    ↓
if provider_mode == "business":
    → business-info → coverage → service-area → capabilities → certificates → review  (7 adım)
if provider_mode == "individual":
    → esnaf-beyani → capabilities → coverage → certificates → review  (5 adım)
```

Her path ayrı dizin: `(onboarding)/business/*` ve `(onboarding)/individual/*`. Review sonunda API'ye submit + admission check → pending state'te wait screen.

### 4.9 Cert upload UI — `required_cert_kinds` dynamic

Mevcut cert upload list hard-coded; backend'den `required_cert_kinds` gelecek. UI bu liste üzerinden render:

```tsx
{required_cert_kinds.map((kind) => (
  <CertUploadRow
    key={kind}
    kind={kind}
    status={certStatusFor(kind)}
    label={CERT_KIND_LABELS[kind]}
    template={CERT_KIND_TEMPLATES[kind]}  // upload formu açıklama metni
  />
))}
```

Yeni `tow_operator` cert_kind için:
- Label: "Çekici Operatör Sertifikası"
- Template: "Devlet tarafından verilmiş çekici operatör belgesi (ruhsat + operatör yetki)."
- Icon: truck + shield

Mevcut fixture'da bu cert zaten var; enum'a eklemek + label mapping yeter.

### 4.10 Çekici özel yüzeyler (tab DEĞİL; modal/sheet/banner)

> **Revize:** "Canlı iş" kendi tab'ı değil. Sabit 4 tab korunur; çekici aktif işine erişim **home hero widget tap + push deep-link + persistent banner** ile olur.

Mevcut scaffold: `TowDispatchSheet.tsx`. Eklenecek yüzeyler:

- `CanliIsModal` — full-screen modal (home hero tap veya push deep-link açar); live map + stage progress + call/message + cancel
- `AcceptBanner` — push gelince **tüm app üstü banner** (tab bar üzerinde, global); 15 sn countdown; kabul/red; geçici — accept sonrası CanliIsModal açılır
- `ActiveTowJobHero` — home'da büyük widget; tap → CanliIsModal
- `GpsStatusBadge` — global header badge (tabsiz overlay); `useLiveLocationBroadcaster` durumunu gösterir
- `useLiveLocationBroadcaster` — active_job mevcut ve `active_provider_type='cekici'` iken 5sn stream; stationary ise 15sn

### 4.11 Tamirci özel yüzeyler (tab DEĞİL; row/modal)

> **Revize:** Kampanyalar, hasar akışı, randevular kendi tab'ları değil. Home'da row olarak başlar, tap ile full-screen modal/stack push.

- `CampaignsRow` — `home_layout IN ('full', 'business_lite', 'damage_shop')` ise home'da görünür. Tap → `CampaignsScreen` (stack push)
- `ExpertiseRequestsCard` — `damage_shop` layout'ta; tap → `ExpertiseFlowScreen`
- Randevular, Ekip, Raporlar — V2'de home widget + modal; V1'de + butonundan erişilir

### 4.12 Data filter — shared screens

Ortak screens için `actor_context`:

```tsx
const { active_provider_type, provider_mode } = useShellConfig();
const cases = usePoolCases({ active_provider_type });  // backend filter
```

Çekici shell'de havuz sadece towing cases; tamirci shell'de accident/breakdown/maintenance + scheduled towing.

### 4.13 Testler

- `ShellSwitcher.test.tsx` — 5 config → 5 shell render
- `QuickActionsSheet.test.tsx` — capability-gated item disabled
- `ActiveRoleSwitcher.test.tsx` — switcher tap → refetch + animate
- `OnboardingFork.test.tsx` — provider_mode seçim → doğru dizin route
- `TabRouter.test.tsx` — tab_set değişince tab'ların mount/unmount olması

---

## 5. Acceptance criteria

- [ ] `packages/domain/src/shell-config.ts` yazılı + Zod ↔ Pydantic parity test geçer
- [ ] Tab router 4 sabit tab mount eder (değişmez); `tab_set` response'tan gelirse V1'de sabit değerler assert
- [ ] Home ekranı `home_layout`'a göre farklı widget kompozisyonu gösterir (5 varyant içerik seviyesinde)
- [ ] `QuickActionsSheet` backend config'ten render; hardcode item yok
- [ ] `ActiveRoleSwitcher` multi-role kullanıcıda görünür + switch çalışır; shell refresh animate
- [ ] Onboarding `provider-mode` adımı yeni; çekici × side_gig disabled (V1'de side_gig zaten yok)
- [ ] Cert upload UI `tow_operator` + mevcut 6 kind'ı render eder
- [ ] Mevcut [TowDispatchSheet.tsx](../naro-service-app/src/features/tow/screens/TowDispatchSheet.tsx) `tow_focused` layout hero + modal olarak wire edilir (ayrı tab YOK)
- [ ] `pnpm -C naro-service-app typecheck + lint + test` temiz
- [ ] Expo dev'de: profile'da `provider_type` + `secondary_provider_types` değiştirip home içeriğinin değiştiği + tab iskeletinin aynı kaldığı manuel smoke

---

## 6. Out of scope

- Side gig UI — V2
- Satıcı / yedek parçacı shell variant'ları — yeni provider_type eklenince
- Admin panel (`(admin)/*`) — ayrı iterasyon
- Gelir/rapor widget'larının dolu datası — V1'de mock
- Mobil servis akışı detay — capability var ama full flow ayrı brief

---

## 7. Açık sorular (FE'ye)

1. **Shell geçiş animasyonu** — hard-cut mı, crossfade mi? Öneri: crossfade 200ms (role switch edildiğinde tab bar flicker olmasın).
2. **Config refetch stratejisi** — polling mi, WebSocket push mu, sadece login/focus'ta mı? Öneri: **focus'ta + role switch'te + 5 dk background interval**. `role_config_version` header mismatch → zorla refetch.
3. **Offline shell cache** — cihaz son bilinen config'i Zustand persist ile tutsun mu (uçak modu için)? Öneri: evet, 24 saat TTL.
4. **Mevcut [TowCapabilityCard](../naro-service-app/src/features/home/components/TowCapabilityCard.tsx)** — tamirci home'da capability-gated widget olarak kalacak. "Aktifleştir" butonu zaten tow_operator cert varsa çalışıyor; flow'u bu brief'te bozmamalıyız (backward compatible).

---

## 8. Referanslar

- [docs/rol-ui-mimarisi-backend.md](rol-ui-mimarisi-backend.md) — kardeş brief (endpoint + schema + matris)
- [packages/domain/src/user.ts](../packages/domain/src/user.ts) — provider_type + TechnicianCertificateKind enum genişletme
- [naro-service-app/src/features/technicians/data/fixtures.ts](../naro-service-app/src/features/technicians/data/fixtures.ts) — fixture güncel (`secondary: ["cekici"]` + `tow_operator` cert)
- [naro-service-app/src/features/tow/screens/TowDispatchSheet.tsx](../naro-service-app/src/features/tow/screens/TowDispatchSheet.tsx) — çekici scaffold
- [docs/cekici-modu-urun-spec.md](cekici-modu-urun-spec.md) — ürün UX kardeş doc
- [memory/role_ui_separation.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/role_ui_separation.md) — ürün kararı memory
- [memory/tow_capability_gate.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/tow_capability_gate.md) — çekici aktivasyon kuralı
