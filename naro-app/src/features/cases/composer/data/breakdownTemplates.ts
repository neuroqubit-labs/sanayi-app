import type { BreakdownCategory, ServiceRequestDraft } from "@naro/domain";
import {
  Activity,
  AlertTriangle,
  Battery,
  Car,
  CircleDashed,
  CircleSlash,
  Droplets,
  Flame,
  Navigation,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Snowflake,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

import type { BreakdownQuestion } from "../components/questionFields/types";

import type { EvidenceStep } from "./evidenceSteps";

export type BreakdownCategoryMeta = {
  id: BreakdownCategory;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

export type SeverityLevel = "low" | "medium" | "high";

export type SeverityRule = {
  level: "high" | "medium";
  matchAny: string[];
};

export type BreakdownTemplate = {
  category: BreakdownCategory;
  hero: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
  };
  questions: BreakdownQuestion[];
  evidence: EvidenceStep[];
  severityRules: SeverityRule[];
};

export const BREAKDOWN_CATEGORIES: BreakdownCategoryMeta[] = [
  { id: "engine", title: "Motor", subtitle: "Ses, güç kaybı, sıcaklık", icon: Flame },
  { id: "electric", title: "Elektrik", subtitle: "Uyarı ışığı, marş", icon: Battery },
  { id: "mechanic", title: "Mekanik", subtitle: "Fren, süspansiyon", icon: Wrench },
  { id: "transmission", title: "Şanzıman", subtitle: "Vites, debriyaj", icon: Settings2 },
  { id: "climate", title: "Klima", subtitle: "Soğutmuyor, koku", icon: Snowflake },
  { id: "tire", title: "Lastik", subtitle: "Patlak, inmiş, aşınma", icon: Car },
  { id: "fluid", title: "Sızıntı", subtitle: "Yağ, soğutma, yakıt", icon: Droplets },
  { id: "other", title: "Başka", subtitle: "Kısa açıklamayla gönder", icon: AlertTriangle },
];

export const BREAKDOWN_CATEGORY_LABEL: Record<BreakdownCategory, string> = {
  engine: "Motor",
  electric: "Elektrik",
  mechanic: "Mekanik",
  transmission: "Şanzıman",
  climate: "Klima",
  tire: "Lastik",
  fluid: "Sızıntı",
  other: "Başka",
};

const ENGINE_TEMPLATE: BreakdownTemplate = {
  category: "engine",
  hero: {
    icon: Flame,
    title: "Motorla ilgili ne yaşıyorsun?",
    subtitle:
      "Birkaç işaretle — ustayı sana özel teşhise yaklaştırırız. Duyduğun sesi kaydederek paylaşabilirsin.",
  },
  questions: [
    {
      kind: "chips",
      id: "engine_symptom",
      title: "Ne yaşıyorsun?",
      options: [
        "Ses/titreşim",
        "Güç kaybı",
        "Duman/koku",
        "Sıcaklık uyarısı",
        "Stop ediyor",
      ],
    },
    {
      kind: "chips",
      id: "engine_when",
      title: "Ne zaman belirgin?",
      options: [
        "Soğuk çalıştırmada",
        "Hızlanırken",
        "Rolantide",
        "Otoyolda",
        "Her zaman",
      ],
    },
    {
      kind: "chips",
      id: "engine_noise",
      title: "Nasıl bir ses?",
      options: ["Vuruntu", "Düdük", "Sürtünme", "Gıcırtı", "Metal çıtırtı"],
      showIf: { questionId: "engine_symptom", includesAny: ["Ses/titreşim"] },
    },
    {
      kind: "chips",
      id: "engine_smoke",
      title: "Duman rengi?",
      options: ["Mavi", "Beyaz", "Siyah", "Kokulu buhar"],
      showIf: { questionId: "engine_symptom", includesAny: ["Duman/koku"] },
    },
  ],
  evidence: [
    {
      id: "engine_hood",
      title: "Motor kaputu",
      hint: "Kaputu aç, motor görünümünü çek.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
    {
      id: "engine_underside",
      title: "Sızıntı / motor altı",
      hint: "Sızıntı veya anormal bir şey görüyorsan alt kısımdan çek.",
      kinds: ["photo", "video"],
      maxPhotos: 3,
    },
    {
      id: "engine_sound",
      title: "Arıza sesi",
      hint: "Motor çalışırken duyduğun sesi kaydet — tamircinin teşhisine büyük katkı.",
      kinds: ["audio"],
      maxPhotos: 2,
    },
    {
      id: "engine_dashboard",
      title: "Gösterge paneli uyarıları",
      hint: "Yanan ışıkların net göründüğü bir kare.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
  ],
  severityRules: [
    {
      level: "high",
      matchAny: [
        "engine_symptom:Duman/koku",
        "engine_symptom:Sıcaklık uyarısı",
        "engine_symptom:Stop ediyor",
      ],
    },
    {
      level: "medium",
      matchAny: ["engine_symptom:Güç kaybı", "engine_symptom:Ses/titreşim"],
    },
  ],
};

const ELECTRIC_TEMPLATE: BreakdownTemplate = {
  category: "electric",
  hero: {
    icon: Battery,
    title: "Uyarı ışığı ya da elektrik sorunu",
    subtitle:
      "Hangi ışık yanıyor, nasıl davranıyor? İkon seç — tamirci uzmanlık alanına göre eşleşir.",
  },
  questions: [
    {
      kind: "icon_grid",
      id: "electric_light",
      title: "Hangi uyarı ışığı yandı?",
      items: [
        { id: "check_engine", label: "Check engine", icon: AlertTriangle },
        { id: "battery", label: "Akü", icon: Battery },
        { id: "oil", label: "Yağ", icon: Droplets },
        { id: "abs", label: "ABS", icon: CircleSlash },
        { id: "airbag", label: "Airbag", icon: ShieldAlert },
        { id: "esp", label: "ESP", icon: RotateCcw },
        { id: "none", label: "Hiç yanmadı", icon: CircleDashed },
      ],
    },
    {
      kind: "chips",
      id: "electric_state",
      title: "Işık nasıl?",
      options: [
        "Sürekli yanıyor",
        "Yanıp sönüyor",
        "Belirli durumda yanıyor",
      ],
    },
    {
      kind: "chips",
      id: "electric_extra",
      title: "Ek belirti?",
      options: [
        "Marş basmıyor",
        "Far/sinyal garip",
        "Cam/silecek çalışmıyor",
        "Ekran donuyor",
      ],
    },
  ],
  evidence: [
    {
      id: "electric_dashboard",
      title: "Gösterge paneli",
      hint: "Yanan ışıkların görüldüğü video ya da fotoğraf.",
      kinds: ["photo", "video"],
      maxPhotos: 2,
      required: true,
    },
    {
      id: "electric_sound",
      title: "İlginç ses (varsa)",
      hint: "Marşta veya çalışırken duyduğun ses.",
      kinds: ["audio"],
      maxPhotos: 1,
    },
    {
      id: "electric_fusebox",
      title: "Sigorta kutusu",
      hint: "Sigorta kutusunu açıp çektiğin fotoğraf — uzman yorumlar.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
  ],
  severityRules: [
    {
      level: "high",
      matchAny: [
        "electric_light:oil",
        "electric_extra:Marş basmıyor",
      ],
    },
    {
      level: "medium",
      matchAny: [
        "electric_light:check_engine",
        "electric_light:battery",
        "electric_light:abs",
      ],
    },
  ],
};

const MECHANIC_TEMPLATE: BreakdownTemplate = {
  category: "mechanic",
  hero: {
    icon: Wrench,
    title: "Hangi bölgede hissediyorsun?",
    subtitle:
      "Fren, direksiyon, süspansiyon — farklı kasları taradığımız için kısa sorular geliyor.",
  },
  questions: [
    {
      kind: "icon_grid",
      id: "mech_area",
      title: "Hangi bölgede?",
      items: [
        { id: "brakes", label: "Fren", icon: CircleSlash },
        { id: "steering", label: "Direksiyon", icon: Navigation },
        { id: "clutch", label: "Vites/debriyaj", icon: Settings2 },
        { id: "suspension", label: "Süspansiyon", icon: Activity },
        { id: "underside", label: "Alt takım", icon: Wrench },
      ],
    },
    {
      kind: "chips",
      id: "mech_feel",
      title: "Nasıl?",
      options: ["Titreme", "Sertlik", "Ses", "Kayma", "Zorlanma"],
    },
    {
      kind: "chips",
      id: "mech_when",
      title: "Ne zaman?",
      options: [
        "Dönüşlerde",
        "Fren yaparken",
        "Hızlanırken",
        "Yavaş seyirde",
        "Duruyorken",
      ],
    },
  ],
  evidence: [
    {
      id: "mech_general",
      title: "Araç genel",
      hint: "Genel bir kare — aracı tanıyalım.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
    {
      id: "mech_area_closeup",
      title: "Bölge yakın çekim",
      hint: "Sorunun hissedildiği bölgenin yakın fotoğrafı ya da videosu.",
      kinds: ["photo", "video"],
      maxPhotos: 3,
    },
    {
      id: "mech_sound",
      title: "Arıza sesi",
      hint: "Fren, süspansiyon ya da direksiyondan gelen sesi kaydet.",
      kinds: ["audio"],
      maxPhotos: 2,
    },
  ],
  severityRules: [
    {
      level: "high",
      matchAny: ["mech_area:brakes", "mech_feel:Zorlanma"],
    },
    {
      level: "medium",
      matchAny: ["mech_feel:Titreme", "mech_feel:Sertlik", "mech_feel:Kayma"],
    },
  ],
};

const TRANSMISSION_TEMPLATE: BreakdownTemplate = {
  category: "transmission",
  hero: {
    icon: Settings2,
    title: "Vites hissi",
    subtitle:
      "Manuel / otomatik farkı teşhise büyük sinyal — önce şanzıman tipini seç.",
  },
  questions: [
    {
      kind: "chips",
      id: "trans_type",
      title: "Şanzıman tipin?",
      multi: false,
      options: ["Manuel", "Otomatik", "DSG/DCT", "CVT", "Bilmiyorum"],
    },
    {
      kind: "chips",
      id: "trans_feel",
      title: "Ne hissediyorsun?",
      options: ["Geç vites", "Sertlik", "Ses", "Titreme", "Hız kaybı"],
    },
    {
      kind: "chips",
      id: "trans_when",
      title: "Hangi durumda?",
      options: [
        "1 → 2 geçişinde",
        "2 → 3 geçişinde",
        "Yüksek viteslerde",
        "Geri vitese takarken",
        "Park / nötr konumunda",
      ],
      showIf: {
        questionId: "trans_feel",
        includesAny: ["Geç vites", "Sertlik"],
      },
    },
  ],
  evidence: [
    {
      id: "trans_lever",
      title: "Vites kolu / seçici",
      hint: "Vites kolunun fotoğrafı.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
    {
      id: "trans_sound",
      title: "Arıza sesi",
      hint: "Vites değiştirirken duyduğun ses.",
      kinds: ["audio"],
      maxPhotos: 2,
    },
    {
      id: "trans_dashboard",
      title: "Gösterge paneli",
      hint: "Şanzıman uyarı ışığı varsa göster.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
  ],
  severityRules: [
    {
      level: "high",
      matchAny: ["trans_feel:Hız kaybı"],
    },
    {
      level: "medium",
      matchAny: ["trans_feel:Geç vites", "trans_feel:Sertlik"],
    },
  ],
};

const CLIMATE_TEMPLATE: BreakdownTemplate = {
  category: "climate",
  hero: {
    icon: Snowflake,
    title: "Klima sorunu",
    subtitle:
      "Soğutma eksikliği mi, ses mi, koku mu? Kısa seçimler teşhis için yeterli.",
  },
  questions: [
    {
      kind: "chips",
      id: "climate_issue",
      title: "Sorun?",
      options: [
        "Soğutmuyor",
        "Isıtmıyor",
        "Koku yapıyor",
        "Ses geliyor",
        "Kompresör tıkırtısı",
      ],
    },
    {
      kind: "chips",
      id: "climate_smell",
      title: "Koku nasıl?",
      options: ["Küflü", "Yanık", "Tatlımsı", "Kimyasal"],
      showIf: {
        questionId: "climate_issue",
        includesAny: ["Koku yapıyor"],
      },
    },
    {
      kind: "chips",
      id: "climate_when",
      title: "Ne zaman?",
      options: ["İlk açışta", "Yüksek devirde", "Sürekli", "Belirli hızda"],
    },
  ],
  evidence: [
    {
      id: "climate_cabin",
      title: "Kabin içi",
      hint: "Havalandırma panelinin görüldüğü bir kare.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
    {
      id: "climate_vent",
      title: "Havalandırma / ızgara",
      hint: "Hava çıkış ızgaralarına yakın çekim.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
    {
      id: "climate_sound",
      title: "Kompresör / fan sesi",
      hint: "Klimayı aç, duyduğun sesi kaydet.",
      kinds: ["audio"],
      maxPhotos: 2,
    },
  ],
  severityRules: [
    {
      level: "medium",
      matchAny: [
        "climate_issue:Kompresör tıkırtısı",
        "climate_smell:Yanık",
        "climate_smell:Kimyasal",
      ],
    },
  ],
};

const TIRE_TEMPLATE: BreakdownTemplate = {
  category: "tire",
  hero: {
    icon: Car,
    title: "Lastik durumu",
    subtitle:
      "Hangi lastik, ne sorun? Bazıları yerinde onarılabilir, çoğunda ustanın bakması gerekir.",
  },
  questions: [
    {
      kind: "icon_grid",
      id: "tire_position",
      title: "Hangi lastik(ler)?",
      items: [
        { id: "front_left", label: "Ön sol", icon: Car },
        { id: "front_right", label: "Ön sağ", icon: Car },
        { id: "rear_left", label: "Arka sol", icon: Car },
        { id: "rear_right", label: "Arka sağ", icon: Car },
      ],
    },
    {
      kind: "chips",
      id: "tire_damage",
      title: "Ne var?",
      options: [
        "Patlak",
        "İnmiş",
        "Çatlak",
        "Yanak şişmesi",
        "Anormal aşınma",
      ],
    },
    {
      kind: "chips",
      id: "tire_season",
      title: "Lastik tipi?",
      multi: false,
      options: ["Yaz", "Kış", "4 mevsim", "Bilmiyorum"],
    },
  ],
  evidence: [
    {
      id: "tire_panorama",
      title: "4 lastik panoramik",
      hint: "Tüm lastikleri gösteren bir genel kare.",
      kinds: ["photo"],
      maxPhotos: 1,
      required: true,
    },
    {
      id: "tire_damage_closeup",
      title: "Hasarlı lastik yakın",
      hint: "Hasarın net görüldüğü fotoğraf veya video.",
      kinds: ["photo", "video"],
      maxPhotos: 4,
    },
  ],
  severityRules: [
    {
      level: "high",
      matchAny: ["tire_damage:Patlak", "tire_damage:Yanak şişmesi"],
    },
    {
      level: "medium",
      matchAny: ["tire_damage:İnmiş", "tire_damage:Çatlak"],
    },
  ],
};

const FLUID_TEMPLATE: BreakdownTemplate = {
  category: "fluid",
  hero: {
    icon: Droplets,
    title: "Sızıntı analizi",
    subtitle:
      "Sıvı rengi ve konumu tamircinin parça tahminini %50 kolaylaştırır.",
  },
  questions: [
    {
      kind: "chips",
      id: "fluid_color",
      title: "Sıvı rengi?",
      multi: false,
      options: [
        "Siyah / koyu",
        "Kırmızımsı",
        "Yeşil",
        "Sarı / altın",
        "Şeffaf / su",
        "Bilmiyorum",
      ],
    },
    {
      kind: "chips",
      id: "fluid_where",
      title: "Nereden sızıyor?",
      options: [
        "Motor altı",
        "Motor önü",
        "Bagaj altı",
        "Her yerde",
        "Bilmiyorum",
      ],
    },
    {
      kind: "chips",
      id: "fluid_rate",
      title: "Ne kadar?",
      multi: false,
      options: ["Damlama", "Akma", "Sürekli", "Park sonrası leke"],
    },
    {
      kind: "short_text",
      id: "fluid_note",
      title: "Ek not (opsiyonel)",
      placeholder: "Ne zaman fark ettin, koku var mı, araç çalışırken mi duruyorken mi?",
    },
  ],
  evidence: [
    {
      id: "fluid_ground",
      title: "Park sonrası zemin",
      hint: "Aracı çektiğin yerde kalan iz / leke.",
      kinds: ["photo"],
      maxPhotos: 2,
      required: true,
    },
    {
      id: "fluid_source",
      title: "Sızıntı kaynağı",
      hint: "Sızıntının geldiği nokta — video daha iyi anlatır.",
      kinds: ["photo", "video"],
      maxPhotos: 3,
    },
    {
      id: "fluid_drop",
      title: "Sıvı damlası yakın",
      hint: "Rengi net görünen yakın çekim.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
  ],
  severityRules: [
    {
      level: "high",
      matchAny: [
        "fluid_color:Kırmızımsı",
        "fluid_rate:Akma",
        "fluid_rate:Sürekli",
      ],
    },
    {
      level: "medium",
      matchAny: ["fluid_color:Siyah / koyu", "fluid_rate:Damlama"],
    },
  ],
};

const OTHER_TEMPLATE: BreakdownTemplate = {
  category: "other",
  hero: {
    icon: AlertTriangle,
    title: "Kısaca anlat",
    subtitle:
      "Diğer kategorilere girmeyen bir şey varsa burada serbest ifadeyle aktarabilirsin.",
  },
  questions: [
    {
      kind: "chips",
      id: "other_tag",
      title: "Kısa etiket",
      options: [
        "Daha önce olmadı",
        "Tekrar eden sorun",
        "Kontrol amaçlı",
        "Başka bir şey",
      ],
    },
    {
      kind: "short_text",
      id: "other_detail",
      title: "Açıklama",
      placeholder: "Durumu serbest biçimde anlat — tamirci okuyacak.",
    },
  ],
  evidence: [
    {
      id: "other_general",
      title: "Araç genel",
      hint: "Genel kare.",
      kinds: ["photo"],
      maxPhotos: 3,
    },
    {
      id: "other_detail",
      title: "İlgili bölge",
      hint: "Sorunu hissettiğin bölge — fotoğraf veya video.",
      kinds: ["photo", "video"],
      maxPhotos: 3,
    },
    {
      id: "other_sound",
      title: "Duyduğun ses (varsa)",
      hint: "Sesi kaydet — yazıyla anlatılması zor şeyler için.",
      kinds: ["audio"],
      maxPhotos: 1,
    },
  ],
  severityRules: [],
};

export const BREAKDOWN_TEMPLATES: Record<BreakdownCategory, BreakdownTemplate> = {
  engine: ENGINE_TEMPLATE,
  electric: ELECTRIC_TEMPLATE,
  mechanic: MECHANIC_TEMPLATE,
  transmission: TRANSMISSION_TEMPLATE,
  climate: CLIMATE_TEMPLATE,
  tire: TIRE_TEMPLATE,
  fluid: FLUID_TEMPLATE,
  other: OTHER_TEMPLATE,
};

export function computeSeverityHint(
  draft: ServiceRequestDraft,
): SeverityLevel {
  const category = draft.breakdown_category;
  if (!category) return "low";
  const template = BREAKDOWN_TEMPLATES[category];
  const symptoms = new Set(draft.symptoms);
  let level: SeverityLevel = "low";
  for (const rule of template.severityRules) {
    if (rule.matchAny.some((entry) => symptoms.has(entry))) {
      if (rule.level === "high") return "high";
      if (rule.level === "medium" && level === "low") level = "medium";
    }
  }
  return level;
}

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  high: "Acil görünüyor",
  medium: "Erken müdahale önerilir",
  low: "",
};
