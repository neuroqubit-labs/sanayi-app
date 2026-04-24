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
      plateLabel: "Plaka",
      makeLabel: "Marka",
      otherMake: "Diğer",
      otherMakePlaceholder: "Marka yaz",
      modelLabel: "Model",
      yearLabel: "Yıl",
      placeholders: {
        plate: "34 ABC 42",
        make: "Marka",
        model: "Model — örn: 3 Serisi",
        year: "Yıl — örn: 2020",
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
      transmissionLabel: "Vites",
      placeholders: {
        mileage: "Kilometre — örn: 85.000",
        color: "Renk — örn: Koyu Gri",
      },
    },
    advanced: {
      title: "Detaylar",
      helper: "Sadece biz saklıyoruz; servislerle paylaşılmaz.",
      drivetrainLabel: "Çekiş",
      placeholders: {
        engineDisplacement: "Motor hacmi — örn: 1.6L",
        enginePower: "Motor gücü (hp) — örn: 150",
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
