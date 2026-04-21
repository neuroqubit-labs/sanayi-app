# Veri (BD)

BD tarafında kullanılan ham ve işlenmiş veri dosyaları.

## Alt klasörler

- `raw/` — kaynaktan alındığı haliyle (API dump, CSV, PDF export). **Gitignore'lu.**
- `processed/` — script çıktısı, analiz-ready. Küçük dosyalar commit edilebilir.
- `reference/` — statik referans veri (il kodları, araç marka listesi, NUTS bölge kodları vs.) — commit edilir.

## İlkeler

- **Hassas veri koymayın** — kişisel veri, müşteri sözleşmesi, partner NDA dosyası. KVKK + ticari gizlilik.
- **Kaynak kayıtlı** — her `processed/*.csv` için aynı isimli `.source.md` (nereden geldi, hangi tarih, hangi script üretti).
- **Büyük dosya** (`>10MB`): git-lfs yerine `raw/` altına + gitignore; paylaşım gerekirse dış storage (S3/drive) referansı `.source.md`'ye yazılır.
