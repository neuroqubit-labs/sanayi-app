# BD — Analiz Scriptleri

BD tarafında kullanılan analiz scriptleri. Pazar verisi toplama, rakip izleme, CAC/LTV hesabı, TÜİK/TSB açık veri çekme vb.

## Dil ve paket yönetimi

- **Python 3.12** (backend ile uyumlu) — `uv` ile izole env.
- İlk script eklenince `pyproject.toml` + `uv.lock` bu klasöre kurulur; `uv run <script>` ile çalışır.
- JS/shell alternatifi serbest — repo kökünde zaten Node env mevcut.

## İsimlendirme

- `verb-konu.py` — örn. `fetch-google-trends.py`, `scrape-rakip-fiyat.py`, `hesap-cac-ltv.py`
- Çıktı → [../data/](../data/) altına (`processed/` → commit, `raw/` → gitignore).
- Çıktı analizle birleşirse → [../analiz/](../analiz/) altında `YYYY-MM-DD-konu.md` raporlanır, script'e referans verilir.

## İlk script eklenince yapılacak (bootstrap)

```bash
cd docs/business/scripts
uv init --package bd-scripts
uv add httpx pandas pydantic
# İlk script:
uv run fetch-ornek.py
```

Kurulunca bu README'ye kullanım örneği ekle.

## Mevcut scriptler

_(Boş — henüz script yok)_
