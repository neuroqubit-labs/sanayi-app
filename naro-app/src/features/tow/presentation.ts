import type { TowVehicleEquipment } from "@naro/domain";

import type { TowDispatchStage } from "./schemas";

export type TowStagePresentation = {
  eyebrow: string;
  title: string;
  description: string;
  tone: "info" | "accent" | "success" | "warning" | "critical";
  liveDot: boolean;
};

export function getTowStagePresentation(
  stage: TowDispatchStage,
): TowStagePresentation {
  switch (stage) {
    case "payment_required":
      return {
        eyebrow: "Ödeme",
        title: "Ön provizyon gerekiyor",
        description:
          "Çekici araması başlamadan önce güvenli ödeme adımını tamamla.",
        tone: "warning",
        liveDot: false,
      };
    case "searching":
      return {
        eyebrow: "Arıyoruz",
        title: "Sana en yakın çekiciye ulaşıyoruz",
        description:
          "İlk uygun operatöre dispatch gönderildi. Kabul ederse 10 saniye içinde eşleşiriz.",
        tone: "accent",
        liveDot: true,
      };
    case "accepted":
      return {
        eyebrow: "Eşleşti",
        title: "Operatör kabul etti",
        description: "Rotası hazırlandı, yola çıkmak üzere.",
        tone: "accent",
        liveDot: true,
      };
    case "en_route":
      return {
        eyebrow: "Yolda",
        title: "Operatör sana doğru geliyor",
        description: "Canlı konumu haritada takip edebilirsin.",
        tone: "accent",
        liveDot: true,
      };
    case "nearby":
      return {
        eyebrow: "Yakında",
        title: "Operatör birazdan yanında",
        description: "500 m içinde — aracının yanında olmaya hazır ol.",
        tone: "warning",
        liveDot: true,
      };
    case "arrived":
      return {
        eyebrow: "Vardı",
        title: "Operatör konumuna ulaştı",
        description:
          "Tanışma kodunu operatöre söyle. Yükleme öncesi fotoğraflar paylaşılacak.",
        tone: "warning",
        liveDot: false,
      };
    case "loading":
      return {
        eyebrow: "Yükleniyor",
        title: "Araç platforma alınıyor",
        description:
          "Operatör aracı güvenle yüklüyor. Yükleme fotoğrafı kanıt dosyasına işlenecek.",
        tone: "accent",
        liveDot: false,
      };
    case "in_transit":
      return {
        eyebrow: "Yolda",
        title: "Aracın servise doğru yolda",
        description: "Canlı konumu izleyebilir, servise ulaşana dek bekleyebilirsin.",
        tone: "accent",
        liveDot: true,
      };
    case "delivered":
      return {
        eyebrow: "Tamamlandı",
        title: "Aracın teslim edildi",
        description: "Puan ver ve süreç özetini ileride kanıt olarak kullanabilirsin.",
        tone: "success",
        liveDot: false,
      };
    case "cancelled":
      return {
        eyebrow: "İptal",
        title: "Talep iptal edildi",
        description: "İptal ücreti varsa özetinde göreceksin.",
        tone: "critical",
        liveDot: false,
      };
    case "scheduled_waiting":
      return {
        eyebrow: "Randevu onaylandı",
        title: "Randevu saatini bekliyoruz",
        description:
          "Zamanı geldiğinde operatör otomatik yola çıkacak. Haritada canlı takip aktifleşecek.",
        tone: "info",
        liveDot: false,
      };
    case "bidding_open":
      return {
        eyebrow: "Teklifler geliyor",
        title: "Randevulu çekici için teklif topluyoruz",
        description:
          "Gelen teklifleri puan, ETA ve garanti ile karşılaştır. Seçim senin.",
        tone: "accent",
        liveDot: true,
      };
    case "offer_accepted":
      return {
        eyebrow: "Teklif kabul",
        title: "Teklif kabul edildi",
        description: "Rezervasyonun hazırlanıyor.",
        tone: "success",
        liveDot: false,
      };
    case "timeout_converted_to_pool":
      return {
        eyebrow: "Arama sürüyor",
        title: "Uygun çekici bekleniyor",
        description:
          "Şu an yakın çevrede uygun operatör yok. Talebin açık kalır; uygun çekici kabul ettiğinde takip ekranı güncellenir.",
        tone: "warning",
        liveDot: true,
      };
    case "preauth_failed":
      return {
        eyebrow: "Ödeme reddedildi",
        title: "Ön yetki alınamadı",
        description:
          "Kartın pre-auth için yetersiz ya da banka reddetti. Farklı kart ile tekrar başlatabilirsin.",
        tone: "critical",
        liveDot: false,
      };
    case "preauth_stale":
      return {
        eyebrow: "Ödeme süresi doldu",
        title: "Ön yetki süresi aşıldı",
        description:
          "Pre-auth tutma süresi doldu. Talebi yeniden başlatman gerekiyor.",
        tone: "warning",
        liveDot: false,
      };
  }
}

const EQUIPMENT_LABELS: Record<TowVehicleEquipment, string> = {
  flatbed: "Flatbed (yatay platform)",
  hook: "Hook (çekme kancası)",
  wheel_lift: "Wheel-lift (tekerlek askısı)",
  heavy_duty: "Ağır vasıta kurtarıcı",
  motorcycle: "Motosiklet platformu",
};

export function labelForEquipment(e: TowVehicleEquipment): string {
  return EQUIPMENT_LABELS[e];
}

export function isActiveStage(stage: TowDispatchStage): boolean {
  return (
    stage === "payment_required" ||
    stage === "searching" ||
    stage === "accepted" ||
    stage === "en_route" ||
    stage === "nearby" ||
    stage === "arrived" ||
    stage === "loading" ||
    stage === "in_transit" ||
    stage === "bidding_open" ||
    stage === "offer_accepted" ||
    stage === "scheduled_waiting" ||
    stage === "timeout_converted_to_pool"
  );
}

export function formatTry(value: number): string {
  return `₺${value.toLocaleString("tr-TR")}`;
}
