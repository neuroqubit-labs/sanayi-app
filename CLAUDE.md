# Naro — Araç Servis Süper App

## Ürün Kimliği
Türkiye'de araç sahibi (müşteri) ile servis sağlayıcıyı (çekici, oto parçacı, bakımcı, motorcu, sanayi ustası) eşleştiren süper app. Düşük frekans (yılda ~5 ziyaret), yüksek güven ihtiyacı, disintermediation riski yüksek alan.

İki kullanıcı tipi, iki ayrı app, ortak backend:
- [naro-app/](naro-app/CLAUDE.md) — Müşteri (araç sahibi) RN/Expo app.
- [naro-service-app/](naro-service-app/CLAUDE.md) — Servis sağlayıcı (atölye/usta/çekici) RN/Expo app.
- [naro-backend/](naro-backend/CLAUDE.md) — FastAPI + Postgres + Redis + ARQ.
- [packages/domain/](packages/domain/CLAUDE.md) — Cross-app Zod kontratı.
- `packages/mobile-core/`, `packages/ui/` — paylaşılan istemci paketleri.

## Auto-yüklü alt bağlam
@naro-app/CLAUDE.md
@naro-service-app/CLAUDE.md
@naro-backend/CLAUDE.md
@packages/domain/CLAUDE.md

## Canonical Kaynak (her iş öncesi)
Davranış, naming, omurga **dokümandan okunur**, koddan tahmin edilmez:

- [docs/naro-vaka-omurgasi.md](docs/naro-vaka-omurgasi.md) — anlatı (PO sesi).
- [docs/naro-vaka-omurgasi-genisletilmis.md](docs/naro-vaka-omurgasi-genisletilmis.md) — sistem dili.
- [docs/naro-domain-glossary.md](docs/naro-domain-glossary.md) — naming sözlüğü (canonical).
- [docs/naro-urun-use-case-spec.md](docs/naro-urun-use-case-spec.md) — UC1-UC4 spec.
- [docs/backend-is-mantigi-hiyerarsi.md](docs/backend-is-mantigi-hiyerarsi.md) — backend invariant + red flag.

## Naming Disiplini
Yeni alias üretme. Önce sözlüğe bak; yetmiyorsa sözlüğe ekle, sonra kod yaz.

**Yasak terimler:**
- UI/domain (`naro-app/**`, `naro-service-app/**`, `packages/**`): `extra_payment`, `additional_payment`, `additional_amount`, `bid` (UI'da; `bidder` gibi internal hariç).
- Backend (`naro-backend/**`): `direct_request` (appointment source).

PreToolUse hook git commit'te yasak terim taraması yapar; yakalarsa commit bloklanır.

## Runtime Proof Kuralı
typecheck + test + lint = **yapısal pencere**. Davranış kanıtı **çalışan cihazda**dır.

"Tamam", "kapandı", "canonical oturdu" demeden önce: (a) typecheck temiz (b) test yeşil (c) cihazda primary akış çalıştı (d) logcat regression-free. (a)+(b) tek başına yetmez.

Audit dokümanı "structural review only" diyorsa sonuç da "structural OK, runtime pending" olmalı.

ADB device: `c249a4f`. Smoke playbook: `/smoke`.

## Geliştirme Modu
Ürün geliştirme modu — sabit launch tarihi yok. Vaka omurgası gibi temel kavramların oturması öncelik; gecikme kabul edilebilir.

**Sıra:** mobil ekran mock'la uçtan uca → akış oturunca `@naro/domain` şemaları ekrandan türetilir → backend domain şemalardan türetilir.

## Yasak Refleksler
- "Şimdilik yeter, sonra düzeltiriz" — mimari borç biriktirme reddedilir.
- "İleride lazım olur" gerekçesi ile kod yazma (over-engineering).
- Yeni alias/synonym üretme — önce glossary.
- typecheck'i runtime delili saymak.
- Kod-içi yorumla niyet belgelemek (canonical docs ana kaynak).

## İletişim
Türkçe. Sakin, dürüst, kurucu tonu. Hype/jargon minimum.
Kullanıcı ADHD; **kısa net özet + kademeli plan**, doc seli odağı kaybettirir, brief disiplinli olmalı.

## Slash Skills
Workflow gate'leri ve yapısal kontroller `.claude/skills/` altında:

- `/be-test` — backend gate (pytest + ruff + alembic upgrade head)
- `/fe-check` — frontend gate (paket başına tsc + repo-wide lint)
- `/smoke` — cihaz smoke playbook (adb + logcat)
- `/audit` — branch end-to-end audit (canonical drift + naming + invariant + runtime gap)
- `/uc-walk` — müşteri app UC bazında ekran taraması
- `/canli-hazirlik` — production readiness gate

## Subagent (paralel/isolated context)
Heavy iş veya bağımsız değerlendirme için `.claude/agents/`:

- `glossary-auditor` — naming/sözlük drift okuyucu
- `schema-parity` — domain ↔ backend schema ↔ ekran tip diff
- `backend-invariant` — pre-merge backend §16/§17 self-check
- `case-doc-drift` — vaka omurgası canonical vs kod
- `smoke-runner` — adb + logcat smoke icra (`/smoke` bunu çağırır)
