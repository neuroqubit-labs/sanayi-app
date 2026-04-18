# Naro — Araç Servis Süper App

## Vizyon
Türkiye'de araç sahipleri ile servis sağlayıcıları (çekici, oto parçacı, bakımcı, motorcu, sanayi ustası vb.) uçtan uca eşleştiren, Uber + Yemeksepeti karışımı bir süper app. Tek bir müşteri uygulaması tüm servis türlerini işlevsel olarak kapsayacak; usta/servis tarafı tek bir uygulamada rolüne göre odaklanacak.

## Sektörel Bağlam ve Zorluklar
- Türkiye'de yıllardır denenmiş, kimse tam optimize edememiş bir alan — çok sayıda başarısız startup geçmişi var.
- **Düşük kullanım frekansı:** Son kullanıcı kaza/çekici için yılda bir-iki kez karşılaşır; salt bu sebeple uygulama indirmez. Değer önerisi "ihtiyaç anında bulunabilir + güven" üzerine kurulmalı (pazarlama, SEO, offline kanallar, belki sigorta/servis anlaşmaları üzerinden dağıtım).
- **Aradan çıkma (disintermediation) riski:** Kötü kurgu, usta ile müşterinin uygulamayı atlayıp doğrudan iletişime geçmesine yol açar. Kısıtlamalar ürün deneyimini bozmadan yapılmalı.

## Hedef Kullanıcılar (tasarım personaları)
- Panik/kaza anındaki endişeli genç kullanıcı — net, tek-butonlu, stressiz akış.
- Aracını tanımayan, sanayiye aşina olmayan kadın kullanıcı — terminoloji/sorun tarifi yerine görsel + rehberli sihirbaz.
- Okuma-yazması zayıf usta — minimum metin, ikon + ses + büyük dokunma alanları, sesli bildirim.

## Ürün Prensipleri
- UX/UI altyapısı üründen önce gelir; akışlar sürekli optimize edilir.
- Her kısıt (anti-disintermediation, KYC vb.) deneyimi bozmayacak şekilde tasarlanır.
- Mobil-öncelikli. Web ikincil.

## Mimari — Mevcut Durum (2026-04)
Monorepo, üç bağımsız proje. Auth scaffold çalışır durumda, feature katmanları boş.

- **[naro-app/](naro-app/)** — Müşteri (araç sahibi). React Native 0.76 + Expo 52 + TypeScript + NativeWind + Expo Router + Zustand + TanStack Query + Zod + React Hook Form + expo-secure-store. Auth (OTP) + tabs scaffold; features boş.
- **[naro-service-app/](naro-service-app/)** — Servis sağlayıcı. Aynı stack; ek olarak expo-document-picker, expo-image-picker. Auth + onboarding (KYC pending) scaffold; features boş.
- **[naro-backend/](naro-backend/)** — FastAPI + Python 3.12 + async SQLAlchemy + Alembic + Pydantic v2 + ARQ (Redis) + Twilio/console SMS. PostgreSQL 16 + Redis 7. JWT + OTP auth. Customer/technician rolleri; technician `pending` → admin onay → active. Matching/jobs/earnings henüz yok.
- **[legacy/](legacy/)** — Eski React + Vite web prototipleri (app/ ve usta-app/). Referans; zamanla silinecek.
- **[docs/](docs/)** — Ürün ve tasarım dokümanları: vizyon, eşleştirme mimarisi, UX framework, reklam sistemi, AI prompt notları.

İki mobil app arasında ortak kod yok — `api.ts`, `storage.ts`, query client duplicate. Shared workspace/package henüz kurulmadı; uzun vadede kurulması gerekecek.

## İki Ayrı App Kararı
Müşteri ve servis sağlayıcı tamamen farklı mental model, farklı sıklık, farklı bildirim profili, farklı app store stratejisine (arama anahtar kelimeleri, açıklamalar) sahip. Tek app içinde rol-switch karmaşayı artırır ve store konumlandırmasını bozar. Bu yüzden iki ayrı app olarak devam ediyoruz.

## Açık Sorular / Sıradaki İşler
- Uzun vadeli "gelişmiş app deneyimi" için mimari yol haritası — shared UI/design system, shared API client, shared domain tipleri.
- Matching algoritması, KYC workflow, iş akışı (teklif → onay → gerçekleştirme → ödeme → puan) backend'de ve app'larda implement edilmeli.
- Anti-disintermediation stratejisi: maskelenmiş iletişim, escrow, puan/reputation bağlama.
- Offline/düşük-bağlantı deneyimi (çekici usta sahada).
