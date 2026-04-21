# Naro — Business Development Workspace

Bu klasör, Naro projesinin **iş geliştirme (BD)** tarafının kalıcı çalışma alanıdır. Pazar, rekabet, büyüme stratejisi, ortaklık haritası, monetizasyon ve risk analizleri burada biriktirilir. Backend veri modeli nasıl [../veri-modeli/](../veri-modeli/) altında yaşıyorsa, BD kararları da burada.

**Sohbet bağlamı:** Business Development sohbetinde Claude bu dizini kullanır. Diğer sohbetler (backend, frontend) ve PM (kullanıcı) buradaki yazılı çıktıları okuyup senkron olur.

## Hızlı giriş

- **[DURUM.md](DURUM.md)** — Canlı panel: aktif öncelikler, açık sorular, bekleyen kararlar. **Her oturum başında ilk okunan.**
- **[KARAR-LOG.md](KARAR-LOG.md)** — Stratejik karar günlüğü. Yeni bir yön tayin edildiğinde buraya düşer.

## Konu haritası

| Klasör | Kapsam |
|---|---|
| [strateji/](strateji/) | Vizyon tezi, kuzey yıldızı metrik, uzun vadeli hedef, tematik memolar |
| [pazar/](pazar/) | Pazar tanımı (TAM/SAM/SOM), sektör analizi, rakip haritası, kullanıcı araştırması |
| [gtm/](gtm/) | Go-to-market, lansman senaryosu, kanal stratejisi, şehir/segment yol haritası |
| [ortakliklar/](ortakliklar/) | Aday + aktif ortaklıklar, müzakere notları, [pipeline](ortakliklar/pipeline.md) |
| [monetizasyon/](monetizasyon/) | Gelir modeli, fiyatlandırma, unit economics, komisyon politikası |
| [risk/](risk/) | [Risk kayıt defteri](risk/risk-kayit-defteri.md): disintermediation, regülasyon, rakip, operasyon, itibar |
| [analiz/](analiz/) | Tarihli, tek-konulu ad-hoc analiz notları (`YYYY-MM-DD-konu.md`) |
| [data/](data/) | Raw + işlenmiş veri. Büyük + ham dosyalar gitignore'lu. |
| [scripts/](scripts/) | Python/shell analiz scriptleri (backend ile uyumlu `uv` env) |

## Dosya adlandırma konvansiyonu

- **Kök kontrol düzlemi**: `README.md`, `DURUM.md`, `KARAR-LOG.md` — büyük harf özel dosyalar.
- **Alt klasör içeriği**: `snake-case.md` (Türkçe, aksansız) — örn. `sigorta-ortakligi.md`, `rakip-haritasi-2026.md`.
- **Analiz (tarihli)**: `YYYY-MM-DD-konu.md` — örn. `analiz/2026-04-21-koc-oto-girisimleri.md`.
- **Pipeline / registry**: düz isim (`pipeline.md`, `risk-kayit-defteri.md`).

## Yazım disiplini

Her stratejik doküman **aksiyon edilebilir** olmalı: öneri + gerekçe + KPI + sorumlu + tarih. Soyut "pazara girme stratejisi" yerine "X sigorta ile co-branded lansman; Y KPI ile ölçeklenir; Z haftada pilot".

Naro'nun üç yapısal problemini her öneride adresle:
1. **Düşük frekans** — yılda 1-2 kez ihtiyaç; retention düşük
2. **Disintermediation** — platform atlama riski
3. **Güven açığı** — sektörde geçmiş başarısız oyuncular

## Karar akışı

1. **Analiz** — `analiz/YYYY-MM-DD-konu.md` altında düşünme notu.
2. **Olgunlaştırma** — ilgili kategori klasörüne kalıcı doküman (örn. `ortakliklar/sigorta-ortakligi.md`).
3. **Karar** — [KARAR-LOG.md](KARAR-LOG.md) girişi + gerekirse [DURUM.md](DURUM.md) güncelleme.
4. **Ekip senkronu** — teknik etki varsa PM'e bildir; yoksa KARAR-LOG yeterli.

## Ekip senkronizasyonu

- Backend ekip KARAR-LOG: [../veri-modeli/KARAR-LOG.md](../veri-modeli/KARAR-LOG.md)
- Proje vizyonu + mimari: [../../CLAUDE.md](../../CLAUDE.md)
- Ürün/UX dokümanları: [../](../) kökünde
