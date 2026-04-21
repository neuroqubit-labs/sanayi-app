# BD — Stratejik Karar Günlüğü

Naro iş geliştirme tarafında alınan stratejik kararlar burada birikir.
Teknik (backend) karar günlüğü: [../veri-modeli/KARAR-LOG.md](../veri-modeli/KARAR-LOG.md).

## Format

```
### YYYY-MM-DD — [konu]

**Karar:** <tek cümle>
**Gerekçe:** <bağlam — hangi veri/sinyal/tartışma üzerine>
**Kapsam:** strateji | pazar | gtm | ortaklık | monetizasyon | risk
**Etki:** P0 | P1 | P2
**Aksiyon:** <kim ne yapıyor, hangi dokümana düştü>
**Validate edildi:** PM | data | pilot | henüz hayır
```

**Etki seviyeleri:**
- **P0** — şirket yönünü değiştirir (yeni dikey, coğrafya, pivot)
- **P1** — bu çeyrek planına etki eder (kanal, fiyat, ortaklık, lansman)
- **P2** — ergonomik / iç süreç kararı

**Yaşam döngüsü:**
- Yeni kararlar **en üste** eklenir (reverse chronological).
- Karar sonradan revize edilirse: eski girişi bozmayın, altına `**REVİZE YYYY-MM-DD:** ...` satırı düşün.
- Karar iptal olursa: `**İPTAL YYYY-MM-DD:** <gerekçe>` ile işaretle.

---

## Kararlar

<!-- En yeni üstte -->

_(Henüz karar yok. İlk kayıt BD kick-off sonrasında eklenecek.)_
