/**
 * Vehicle feature user-facing copy — tek kaynak.
 *
 * Hardcoded inline string'ler bu modülden import edilir. İmla + ton
 * değişiklikleri tek yerden yapılır, ileride i18n katmanına taşınması
 * kolaylaşır (TB-9).
 */

export const VEHICLE_ADD_COPY = {
  screen: {
    title: "Araç ekle",
  },
  steps: {
    kind: {
      title: "Aracın hangi türde?",
      helper: "Bu bilgi ustalar ve teklifler için kritik.",
    },
    identity: {
      title: "Aracını tanıt",
      helper: "Plaka formatı: 34 ABC 42",
      placeholders: {
        plate: "34 ABC 42",
        make: "Marka",
        model: "Model",
        year: "Yıl",
      },
    },
    photo: {
      title: "Aracını göster",
      helper:
        "Fotoğraflı araçlara ustalar daha hızlı yanıt veriyor. İstersen geçebilirsin.",
      addLabel: "Fotoğraf ekle",
      replaceLabel: "Değiştir",
      removeLabel: "Kaldır",
      uploading: "Yükleniyor…",
    },
    basics: {
      title: "Teknik",
      fuelLabel: "Yakıt",
      placeholders: {
        mileage: "Kilometre",
        color: "Renk",
      },
    },
    advanced: {
      title: "Detaylar",
      helper: "Sadece biz saklıyoruz; servislerle paylaşılmaz.",
      transmissionLabel: "Vites",
      placeholders: {
        chassis: "Şase numarası",
        engine: "Motor numarası",
        note: "Kısa bir not (sadece sen görürsün)",
      },
      skipLabel: "Hepsini geç",
    },
    consent: {
      title: "Geçmiş erişimi",
      body:
        "İzin verirsen bakım, sigorta ve plaka geçmişi eşleşmeye girer. İstediğin an geri alırsın.",
      toggleLabel: "Geçmişe erişim veriyorum",
    },
  },
  chrome: {
    closeLabel: "Vazgeç",
    backLabel: "Geri",
    nextLabel: "İleri",
    submitLabel: "Aracı ekle",
  },
  validation: {
    kindRequired: "Araç türünü seç.",
    plateRequired: "Plaka zorunlu.",
    plateInvalid: "Plaka formatı doğru değil. Örn: 34 ABC 42.",
    makeRequired: "Marka zorunlu.",
    modelRequired: "Model zorunlu.",
    yearRequired: "Yıl zorunlu.",
    yearInvalid: "Yıl geçerli bir aralıkta olmalı.",
    mileageInvalid: "Kilometre sayı olmalı.",
    chassisTooLong: "Şase numarası çok uzun.",
    engineTooLong: "Motor numarası çok uzun.",
  },
  success: {
    created: "Araç eklendi.",
  },
} as const;

export const VEHICLE_DETAIL_COPY = {
  history: {
    sectionTitle: "Geçmiş",
  },
  documents: {
    comingSoon: "Yakında",
  },
} as const;
