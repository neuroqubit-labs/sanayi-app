# 2026-04-23 API Contract Matrix

| Sınıf | Backend canonical | Customer app | Service app | Parity | Not |
| --- | --- | --- | --- | --- | --- |
| Auth | Var | Var | Var | Yeşil | TokenPair uyumlu |
| Vehicles | Var | Var | Yok | Sarı | Route uyumlu, semantic data loss var |
| Taxonomy | Var | Var | Var | Yeşil | Feed/filter data canlı |
| Technicians Public | Var | Var | Yok | Yeşil | Public listing/detail uyumlu |
| Cases Core | Var | Var | Yok | Sarı/Kırmızı | Live + store aynı anda var |
| Tow | Var | Store-heavy | Store-heavy | Kırmızı | Feature parity yok |
| Billing Customer | Var | Var | Yok | Sarı | Refund schema drift |
| Billing Technician Payouts | Var | Yok | Var | Yeşil | Revenue query canlı |
| Approvals Consume | Var | Var | Yok | Sarı | List/decide canlı |
| Approvals Create | Var | Kısmi schema | Yok | Kırmızı | `title` drift |
| Appointments Consume | Var | Var | Store | Kırmızı | Request payload drift |
| Offers Consume | Var | Var | Store | Kırmızı | Response schema drift |
| Technicians Me Coverage | Var | Yok | Var | Sarı | Coverage canlı |
| Technicians Me Service Area | Var | Yok | Store only | Kırmızı | Client mutation yok |
| Technicians Me Schedule | Var | Yok | Store only | Kırmızı | Client mutation yok |
| Technicians Me Capacity | Var | Yok | Store only | Kırmızı | Client mutation yok |
| Media | Var | Var | Var | Yeşil | Feature-level kullanım eksik |
| Notifications | Yok | Mock | Mock | Gri | Backend sınıfı yok |
| Search | Yok | Local derived | Yok | Gri | Backend sınıfı yok |
| Home Business Summary | Yok | Yok | Mock | Gri | Backend sınıfı yok |
| Jobs / Pool service app | Kısmen var | Yok | Mock | Kırmızı | Route var, client store kullanıyor |

## Renk Anahtarı

- `Yeşil`: route + payload + response + tüketim büyük ölçüde hizalı
- `Sarı`: canonical route var ama schema veya tüketim katmanında eksik var
- `Kırmızı`: aktif drift, validasyon kırığı veya mock/live çift gerçeklik
- `Gri`: backend sınıfı hiç yok; mock/derived feature
