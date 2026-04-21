import type { CaseAttachmentKind } from "@naro/domain";

export type EvidenceStep = {
  id: string;
  title: string;
  hint: string;
  /** Kabul edilen medya tipleri. İlk eleman varsayılan/tercih edilen kind. */
  kinds: CaseAttachmentKind[];
  minPhotos?: number;
  maxPhotos?: number;
  required?: boolean;
};

export const ACCIDENT_EVIDENCE_STEPS: EvidenceStep[] = [
  {
    id: "scene_overview",
    title: "Kazanın genel görünümü",
    hint: "İki aracı ve çevreyi gösterecek mesafeden bir kare al.",
    kinds: ["photo"],
    minPhotos: 1,
    maxPhotos: 3,
    required: true,
  },
  {
    id: "counterparty_plate",
    title: "Karşı araç plakası",
    hint: "Plakanın okunduğundan emin ol; karşı taraf yoksa geç.",
    kinds: ["photo"],
    maxPhotos: 2,
    required: false,
  },
  {
    id: "damage_detail",
    title: "Hasar detayı",
    hint: "En net görülen hasar bölgesini yakın mesafeden çek.",
    kinds: ["photo"],
    minPhotos: 1,
    maxPhotos: 4,
    required: true,
  },
  {
    id: "surroundings",
    title: "Çevre ve yol koşulları",
    hint: "Yol işaretleri, kayganlık ve görüş mesafesi için çevresel kare.",
    kinds: ["photo"],
    maxPhotos: 2,
  },
  {
    id: "extra",
    title: "Ek kanıt (opsiyonel)",
    hint: "Tanık, güvenlik kamerası ya da ekstra bir detay eklemek istersen.",
    kinds: ["photo"],
    maxPhotos: 3,
  },
];

