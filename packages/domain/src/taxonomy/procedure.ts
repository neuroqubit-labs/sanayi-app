import { z } from "zod";

import type { ServiceDomain } from "./service-domain";

export type ProcedureMeta = {
  key: string;
  domain: ServiceDomain;
  label: string;
  description?: string;
  typical_labor_hours_min?: number;
  typical_labor_hours_max?: number;
  typical_parts_cost_min?: number;
  typical_parts_cost_max?: number;
  popular?: boolean;
  order: number;
};

export const PROCEDURE_CATALOG: ProcedureMeta[] = [
  // motor
  { key: "motor_yag_bakimi", domain: "motor", label: "Yağ + filtre bakımı", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, popular: true, order: 1 },
  { key: "motor_zamanlama_kiti", domain: "motor", label: "Zamanlama kiti / kayış değişimi", typical_labor_hours_min: 4, typical_labor_hours_max: 8, popular: true, order: 2 },
  { key: "motor_zincir_seti", domain: "motor", label: "Zincir seti değişimi", typical_labor_hours_min: 6, typical_labor_hours_max: 12, popular: true, order: 3 },
  { key: "motor_turbo_rebuild", domain: "motor", label: "Turbo rebuild / değişim", typical_labor_hours_min: 3, typical_labor_hours_max: 6, order: 4 },
  { key: "motor_kafa_contasi", domain: "motor", label: "Silindir kapağı contası", typical_labor_hours_min: 8, typical_labor_hours_max: 16, order: 5 },
  { key: "motor_valf_ayari", domain: "motor", label: "Valf ayarı", typical_labor_hours_min: 2, typical_labor_hours_max: 4, order: 6 },
  { key: "motor_revizyon", domain: "motor", label: "Komple motor revizyonu", typical_labor_hours_min: 20, typical_labor_hours_max: 60, order: 7 },
  { key: "motor_obd_teshis", domain: "motor", label: "OBD teşhis", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1.5, popular: true, order: 8 },
  { key: "motor_ecu_kodlama", domain: "motor", label: "ECU programlama / remap", typical_labor_hours_min: 1, typical_labor_hours_max: 3, order: 9 },

  // sanziman
  { key: "sanziman_yag_bakimi", domain: "sanziman", label: "Şanzıman yağ değişimi", typical_labor_hours_min: 1, typical_labor_hours_max: 2, popular: true, order: 1 },
  { key: "sanziman_debriyaj", domain: "sanziman", label: "Debriyaj seti değişimi", typical_labor_hours_min: 4, typical_labor_hours_max: 8, popular: true, order: 2 },
  { key: "sanziman_dsg_bakimi", domain: "sanziman", label: "DSG / otomatik bakım", typical_labor_hours_min: 2, typical_labor_hours_max: 4, popular: true, order: 3 },
  { key: "sanziman_mekatronik", domain: "sanziman", label: "DSG mekatronik onarımı", typical_labor_hours_min: 6, typical_labor_hours_max: 12, order: 4 },
  { key: "sanziman_diferansiyel", domain: "sanziman", label: "Diferansiyel onarımı", typical_labor_hours_min: 4, typical_labor_hours_max: 10, order: 5 },
  { key: "sanziman_revizyon", domain: "sanziman", label: "Komple şanzıman revizyonu", typical_labor_hours_min: 12, typical_labor_hours_max: 30, order: 6 },

  // fren
  { key: "fren_balata_on", domain: "fren", label: "Ön balata değişimi", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1.5, popular: true, order: 1 },
  { key: "fren_balata_arka", domain: "fren", label: "Arka balata değişimi", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1.5, popular: true, order: 2 },
  { key: "fren_disk", domain: "fren", label: "Disk değişimi", typical_labor_hours_min: 1, typical_labor_hours_max: 2, popular: true, order: 3 },
  { key: "fren_hidrolik_degisim", domain: "fren", label: "Hidrolik yağ değişimi", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, order: 4 },
  { key: "fren_abs_teshis", domain: "fren", label: "ABS teşhis & onarım", typical_labor_hours_min: 1, typical_labor_hours_max: 3, order: 5 },
  { key: "fren_el_freni", domain: "fren", label: "El freni ayarı / onarımı", typical_labor_hours_min: 0.5, typical_labor_hours_max: 2, order: 6 },

  // suspansiyon
  { key: "suspansiyon_amortisor", domain: "suspansiyon", label: "Amortisör değişimi", typical_labor_hours_min: 1, typical_labor_hours_max: 3, popular: true, order: 1 },
  { key: "suspansiyon_rot_rotil", domain: "suspansiyon", label: "Rot / rotil değişimi", typical_labor_hours_min: 1, typical_labor_hours_max: 2, popular: true, order: 2 },
  { key: "suspansiyon_salincak", domain: "suspansiyon", label: "Salıncak değişimi", typical_labor_hours_min: 2, typical_labor_hours_max: 4, order: 3 },
  { key: "suspansiyon_denge_cubugu", domain: "suspansiyon", label: "Viraj demiri / denge çubuğu", typical_labor_hours_min: 1, typical_labor_hours_max: 3, order: 4 },

  // elektrik
  { key: "elektrik_aku_degisim", domain: "elektrik", label: "Akü değişimi", typical_labor_hours_min: 0.25, typical_labor_hours_max: 0.5, popular: true, order: 1 },
  { key: "elektrik_alternator", domain: "elektrik", label: "Alternatör onarımı / değişimi", typical_labor_hours_min: 1.5, typical_labor_hours_max: 3, popular: true, order: 2 },
  { key: "elektrik_mars", domain: "elektrik", label: "Marş motoru onarımı", typical_labor_hours_min: 1, typical_labor_hours_max: 3, order: 3 },
  { key: "elektrik_ecu_arizasi", domain: "elektrik", label: "ECU arıza teşhis", typical_labor_hours_min: 1, typical_labor_hours_max: 4, order: 4 },
  { key: "elektrik_sensor_degisim", domain: "elektrik", label: "Sensör değişimi", typical_labor_hours_min: 0.5, typical_labor_hours_max: 2, popular: true, order: 5 },
  { key: "elektrik_multimedya", domain: "elektrik", label: "Multimedya / teyp", typical_labor_hours_min: 1, typical_labor_hours_max: 4, order: 6 },
  { key: "elektrik_kablo_tesisat", domain: "elektrik", label: "Kablo / tesisat onarımı", typical_labor_hours_min: 2, typical_labor_hours_max: 8, order: 7 },

  // klima
  { key: "klima_gaz_dolum", domain: "klima", label: "Klima gaz dolumu", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, popular: true, order: 1 },
  { key: "klima_kompresor", domain: "klima", label: "Kompresör değişimi", typical_labor_hours_min: 3, typical_labor_hours_max: 6, popular: true, order: 2 },
  { key: "klima_polen_filtresi", domain: "klima", label: "Polen filtre değişimi", typical_labor_hours_min: 0.25, typical_labor_hours_max: 0.5, popular: true, order: 3 },
  { key: "klima_kalorifer", domain: "klima", label: "Kalorifer radyatörü", typical_labor_hours_min: 4, typical_labor_hours_max: 10, order: 4 },
  { key: "klima_bakteri_temizligi", domain: "klima", label: "Ozon / bakteri temizliği", typical_labor_hours_min: 1, typical_labor_hours_max: 2, order: 5 },

  // lastik
  { key: "lastik_degisim", domain: "lastik", label: "Lastik değişimi (4'lü)", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, popular: true, order: 1 },
  { key: "lastik_balans", domain: "lastik", label: "Balans ayarı", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, popular: true, order: 2 },
  { key: "lastik_rot_ayari", domain: "lastik", label: "Rot (alignment) ayarı", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, popular: true, order: 3 },
  { key: "lastik_jant_onarim", domain: "lastik", label: "Jant düzeltme / tamiri", typical_labor_hours_min: 1, typical_labor_hours_max: 3, order: 4 },
  { key: "lastik_tamiri", domain: "lastik", label: "Patlak/delik lastik tamiri", typical_labor_hours_min: 0.25, typical_labor_hours_max: 0.5, popular: true, order: 5 },
  { key: "lastik_mevsimlik_saklama", domain: "lastik", label: "Mevsimlik lastik saklama", order: 6 },

  // aku
  { key: "aku_teshis", domain: "aku", label: "Akü teşhis / şarj testi", typical_labor_hours_min: 0.25, typical_labor_hours_max: 0.5, popular: true, order: 1 },
  { key: "aku_degisim_yerinde", domain: "aku", label: "Yerinde akü değişimi", typical_labor_hours_min: 0.25, typical_labor_hours_max: 0.5, popular: true, order: 2 },

  // kaporta
  { key: "kaporta_boya_parcali", domain: "kaporta", label: "Parça başı boya", typical_labor_hours_min: 4, typical_labor_hours_max: 12, popular: true, order: 1 },
  { key: "kaporta_duzeltme", domain: "kaporta", label: "Ezik düzeltme (PDR)", typical_labor_hours_min: 1, typical_labor_hours_max: 4, popular: true, order: 2 },
  { key: "kaporta_komple_boya", domain: "kaporta", label: "Komple araç boya", typical_labor_hours_min: 40, typical_labor_hours_max: 120, order: 3 },
  { key: "kaporta_tampon_boya", domain: "kaporta", label: "Tampon boya & tamiri", typical_labor_hours_min: 3, typical_labor_hours_max: 8, popular: true, order: 4 },
  { key: "kaporta_ekspertiz", domain: "kaporta", label: "Hasar ekspertiz raporu", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, order: 5 },

  // cam
  { key: "cam_on_degisim", domain: "cam", label: "Ön cam değişimi", typical_labor_hours_min: 1, typical_labor_hours_max: 2, popular: true, order: 1 },
  { key: "cam_film", domain: "cam", label: "Cam filmi uygulama", typical_labor_hours_min: 2, typical_labor_hours_max: 4, popular: true, order: 2 },
  { key: "cam_yan_arka_degisim", domain: "cam", label: "Yan / arka cam değişimi", typical_labor_hours_min: 1, typical_labor_hours_max: 3, order: 3 },
  { key: "cam_tamir_cip_cizigi", domain: "cam", label: "Çip / çizik tamiri", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1, order: 4 },

  // aksesuar
  { key: "aksesuar_koltuk_dosemesi", domain: "aksesuar", label: "Koltuk döşeme / kaplama", typical_labor_hours_min: 8, typical_labor_hours_max: 24, order: 1 },
  { key: "aksesuar_folyo_kaplama", domain: "aksesuar", label: "Folyo kaplama", typical_labor_hours_min: 24, typical_labor_hours_max: 80, order: 2 },
  { key: "aksesuar_kamera_multimedya", domain: "aksesuar", label: "Kamera / multimedya montajı", typical_labor_hours_min: 2, typical_labor_hours_max: 6, popular: true, order: 3 },
  { key: "aksesuar_koruma_ppf", domain: "aksesuar", label: "PPF koruma filmi", typical_labor_hours_min: 16, typical_labor_hours_max: 40, order: 4 },
  { key: "aksesuar_detayli_yikama", domain: "aksesuar", label: "Detaylı yıkama / seramik", typical_labor_hours_min: 4, typical_labor_hours_max: 12, popular: true, order: 5 },

  // cekici
  { key: "cekici_sehir_ici", domain: "cekici", label: "Şehir içi çekici", typical_labor_hours_min: 0.5, typical_labor_hours_max: 1.5, popular: true, order: 1 },
  { key: "cekici_uzun_yol", domain: "cekici", label: "Uzun yol / şehirler arası çekici", typical_labor_hours_min: 2, typical_labor_hours_max: 24, popular: true, order: 2 },
  { key: "cekici_otopark_transfer", domain: "cekici", label: "Otopark / transfer", typical_labor_hours_min: 0.5, typical_labor_hours_max: 2, order: 3 },
  { key: "cekici_yol_yardim", domain: "cekici", label: "Yol yardım (akü/lastik/yakıt)", typical_labor_hours_min: 0.25, typical_labor_hours_max: 1, popular: true, order: 4 },
];

export const ProcedureKeySchema = z.string();

export const ProcedureBindingSchema = z.object({
  key: z.string(),
  confidence_self_declared: z.number().min(0).max(1).default(1),
  confidence_verified: z.number().min(0).max(1).nullable().default(null),
});
export type ProcedureBinding = z.infer<typeof ProcedureBindingSchema>;

export function proceduresByDomain(domain: ServiceDomain): ProcedureMeta[] {
  return PROCEDURE_CATALOG.filter((p) => p.domain === domain).sort(
    (a, b) => a.order - b.order,
  );
}

export function popularProcedures(domain: ServiceDomain): ProcedureMeta[] {
  return proceduresByDomain(domain).filter((p) => p.popular);
}

export function getProcedure(key: string): ProcedureMeta | undefined {
  return PROCEDURE_CATALOG.find((p) => p.key === key);
}
