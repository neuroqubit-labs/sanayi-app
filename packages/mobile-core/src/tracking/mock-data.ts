import type {
  CaseAttachment,
  CaseDocument,
  CaseEvent,
  CaseOffer,
  CaseThread,
  ServiceCase,
} from "@naro/domain";

import {
  createTrackingDraftForKind,
  getTrackingServiceSnapshot,
  trackingServiceDirectory,
} from "./directory";
import { syncTrackingCase } from "./engine";

const NOW = "2026-04-19T10:00:00.000Z";

function isoFromOffset(hours: number) {
  return new Date(Date.parse(NOW) + hours * 60 * 60 * 1000).toISOString();
}

function attachment(
  id: string,
  kind: CaseAttachment["kind"],
  title: string,
  subtitle?: string,
  statusLabel?: string,
): CaseAttachment {
  return { id, kind, title, subtitle, statusLabel, asset: null };
}

function document(
  id: string,
  kind: CaseDocument["kind"],
  title: string,
  sourceLabel: string,
  statusLabel: string,
  createdAtLabel: string,
  subtitle?: string,
): CaseDocument {
  return {
    id,
    kind,
    title,
    subtitle,
    source_label: sourceLabel,
    status_label: statusLabel,
    created_at: NOW,
    created_at_label: createdAtLabel,
    asset: null,
  };
}

function event(
  id: string,
  title: string,
  body: string,
  createdAtLabel: string,
  tone: CaseEvent["tone"],
  type: CaseEvent["type"] = "status_update",
): CaseEvent {
  return {
    id,
    type,
    title,
    body,
    created_at: NOW,
    created_at_label: createdAtLabel,
    tone,
  };
}

function message(
  id: string,
  authorName: string,
  authorRole: CaseThread["messages"][number]["author_role"],
  body: string,
  createdAtLabel: string,
  attachments: CaseAttachment[] = [],
): CaseThread["messages"][number] {
  return {
    id,
    author_name: authorName,
    author_role: authorRole,
    body,
    created_at: NOW,
    created_at_label: createdAtLabel,
    attachments,
  };
}

function offer(
  id: string,
  technicianId: string,
  amount: number,
  etaMinutes: number,
  status: CaseOffer["status"],
  headline: string,
  description: string,
  badges: string[] = [],
): CaseOffer {
  return {
    id,
    technician_id: technicianId,
    headline,
    description,
    amount,
    currency: "TRY",
    price_label: `₺${amount.toLocaleString("tr-TR")}`,
    eta_minutes: etaMinutes,
    eta_label: etaMinutes < 60 ? `~${etaMinutes} dk` : `~${etaMinutes / 60} sa`,
    available_at_label: status === "accepted" ? "Kabul edildi" : "Hazir",
    delivery_mode:
      technicianId === "tech-autopro-servis"
        ? "Pickup + atolye"
        : technicianId === "tech-engin-oto"
          ? "Mobil kontrol + atolye"
          : "Atolye kabul",
    warranty_label:
      technicianId === "tech-engin-oto" ? "30 gun teshis" : "Yazili garanti",
    status,
    badges,
  };
}

function emptyWorkflowFields() {
  return {
    milestones: [],
    tasks: [],
    evidence_feed: [],
    notification_intents: [],
    appointment: null,
    origin: "customer" as const,
    insurance_claim: null,
  };
}

export function seedTrackingCases(): ServiceCase[] {
  const breakdownCase: ServiceCase = syncTrackingCase({
    id: "case-bmw-breakdown-001",
    vehicle_id: "veh-bmw-34-abc-42",
    kind: "breakdown",
    status: "parts_approval",
    title: "Metalik ses ve titresim takip dosyasi",
    subtitle: "",
    summary:
      "Motor tarafinda ses kaynagi netlesti, parca karari ve maliyet etkisi aciklandi.",
    created_at: isoFromOffset(-42),
    created_at_label: "Dün",
    updated_at: isoFromOffset(-1),
    updated_at_label: "1 sa önce",
    request: {
      ...createTrackingDraftForKind("breakdown", "veh-bmw-34-abc-42"),
      preferred_technician_id: "tech-autopro-servis",
    },
    assigned_technician_id: "tech-autopro-servis",
    preferred_technician_id: "tech-autopro-servis",
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: "₺3.450",
    estimate_label: "Yarin 18:30",
    allowed_actions: [],
    pending_approvals: [
      {
        id: "approval-breakdown-parts-1",
        kind: "parts_request",
        status: "pending",
        title: "Parca ve ek iscilik onayi",
        description:
          "Zincir gergisi ve tamamlayici iscilik risk nedeniyle kapsam icine alindi.",
        requested_by: "AutoPro Servis",
        requested_at: NOW,
        requested_at_label: "40 dk önce",
        amount_label: "+₺1.250",
        action_label: "Parca onayini ver",
        service_comment:
          "Asinma noktasi ve zincir boslugu hem fotograf hem ses kaydi ile dokumante edildi.",
        line_items: [
          {
            id: "parts-line-1",
            label: "Zincir gergisi + tamamlayici iscilik",
            value: "+₺1.250",
            note: "Mevcut ses ve titresim riskini kesmek icin gerekli.",
          },
        ],
        evidence_document_ids: ["doc-breakdown-parts-proof"],
      },
    ],
    assigned_service: getTrackingServiceSnapshot(
      "tech-autopro-servis",
      "Bu vaka icin secilen servis",
    ),
    documents: [
      document(
        "doc-breakdown-parts-proof",
        "photo",
        "Parca gerekce gorseli",
        "Servis kaniti",
        "Onay bekliyor",
        "40 dk önce",
        "Zincir boslugu ve asinma noktasi isaretlendi.",
      ),
      document(
        "doc-breakdown-intake",
        "document",
        "Kabul ve ilk teshis notu",
        "Platform ozeti",
        "Hazir",
        "Dün",
        "Teslim modu, ses tanimi ve ilk notlar.",
      ),
    ],
    offers: [
      offer(
        "offer-breakdown-autopro",
        "tech-autopro-servis",
        3450,
        180,
        "accepted",
        "Kanıt ve pickup disiplini yuksek",
        "BMW zincir / zamanlama seslerinde once kanit, sonra kapsam yaklasimi.",
        ["Pickup", "Kanit izi", "BMW"],
      ),
      offer(
        "offer-breakdown-engin",
        "tech-engin-oto",
        2900,
        220,
        "rejected",
        "Mobil ilk kontrol ile hizli giris",
        "Erken teshis hizli ama pickup ve belge izi daha zayif.",
        ["Mobil kontrol"],
      ),
    ],
    attachments: [
      attachment(
        "attach-breakdown-sound",
        "video",
        "Ilk ses kaydi",
        "Rolantide metalik ses",
        "Hazir",
      ),
    ],
    events: [
      event(
        "event-breakdown-parts",
        "Parca onayi istendi",
        "Servis zincir gergisi icin gorsel ve ses kaniti paylasti.",
        "40 dk önce",
        "warning",
        "parts_requested",
      ),
      event(
        "event-breakdown-progress",
        "Teshis netlesti",
        "Ses kaynaginin zincir hattinda yogunlastigi teyit edildi.",
        "2 sa önce",
        "info",
      ),
      event(
        "event-breakdown-selected",
        "Teklif kabul edildi",
        "AutoPro Servis bu vaka icin secildi.",
        "Dün",
        "success",
        "technician_selected",
      ),
    ],
    thread: {
      id: "thread-breakdown-001",
      case_id: "case-bmw-breakdown-001",
      preview: "Parca gerekcesini net gorsellerle paylastik.",
      unread_count: 2,
      messages: [
        message(
          "message-breakdown-1",
          "AutoPro Servis",
          "technician",
          "Asinma noktasini yakin plan gorsellerle ekledik; ses kaydi da eklendi.",
          "40 dk önce",
        ),
        message(
          "message-breakdown-2",
          "Naro",
          "system",
          "Parca onayi bekleniyor. Onay gelince onarim sahnesi kaldigi yerden devam edecek.",
          "35 dk önce",
        ),
      ],
    },
    workflow_blueprint: "damage_uninsured",
    wait_state: {
      actor: "customer",
      label: "Musteri onayi bekleniyor",
      description: "Parca karari verilmeden onarim akisinda ileri gecilmez.",
    },
    last_seen_by_actor: {
      customer: isoFromOffset(-8),
      technician: isoFromOffset(-2),
    },
    ...emptyWorkflowFields(),
  });

  const accidentCase: ServiceCase = syncTrackingCase({
    id: "case-bmw-accident-002",
    vehicle_id: "veh-bmw-34-abc-42",
    kind: "accident",
    status: "service_in_progress",
    title: "Sag on hasar takip dosyasi",
    subtitle: "",
    summary:
      "Kaporta ve far hattinda onarim suruyor; sigorta dosyasi ve atolyedeki ilerleme birlikte akiyor.",
    created_at: isoFromOffset(-76),
    created_at_label: "3 gun önce",
    updated_at: isoFromOffset(-3),
    updated_at_label: "3 sa önce",
    request: {
      ...createTrackingDraftForKind("accident", "veh-bmw-34-abc-42"),
      preferred_technician_id: "tech-autopro-servis",
    },
    assigned_technician_id: "tech-autopro-servis",
    preferred_technician_id: "tech-autopro-servis",
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: "₺18.400",
    estimate_label: "2 gun icinde",
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: getTrackingServiceSnapshot(
      "tech-autopro-servis",
      "Sigorta ve kaporta tarafinda sureci yuruten servis",
    ),
    documents: [
      document(
        "doc-accident-insurance",
        "report",
        "Ekspertiz ozeti",
        "Sigorta dosyasi",
        "Hazir",
        "Dün",
        "On tampon, far ve baglanti ayaklari kapsama alindi.",
      ),
      document(
        "doc-accident-progress",
        "photo",
        "Atolye ilerleme gorseli",
        "Servis kaniti",
        "Yeni",
        "3 sa önce",
        "Far yuvası ve kaporta hizalama asamasi.",
      ),
    ],
    offers: [
      offer(
        "offer-accident-autopro",
        "tech-autopro-servis",
        18400,
        420,
        "accepted",
        "Sigorta dosyasi ve kaporta akisini birlikte yonetiyor",
        "Ekspertiz, parca ve teslim fotografi zincirini tek dosyada tutuyor.",
        ["Sigorta", "Kaporta", "Pickup"],
      ),
    ],
    attachments: [
      attachment(
        "attach-accident-front",
        "photo",
        "Ilk hasar fotografi",
        "Sag on tampon ve far bolgesi",
        "Hazir",
      ),
    ],
    events: [
      event(
        "event-accident-progress",
        "Atolye ilerleme gorseli yüklendi",
        "Far yuvasi ve kaporta hizalama asamasi paylasildi.",
        "3 sa önce",
        "info",
      ),
      event(
        "event-accident-expert",
        "Ekspertiz ozeti tamamlandi",
        "Sigorta kapsaminda degisecek parcalar teyit edildi.",
        "Dün",
        "success",
      ),
    ],
    thread: {
      id: "thread-accident-002",
      case_id: "case-bmw-accident-002",
      preview: "Son ilerleme gorselini yukledik; kaporta hizalama suruyor.",
      unread_count: 1,
      messages: [
        message(
          "message-accident-1",
          "AutoPro Servis",
          "technician",
          "Far yuvasini hizalama asamasina gectik. Son gorsel yuklendi.",
          "3 sa önce",
        ),
      ],
    },
    workflow_blueprint: "damage_insured",
    wait_state: {
      actor: "technician",
      label: "Usta sahnede",
      description: "Kaporta ve ekspertiz akisinda su an servis ilerliyor.",
    },
    last_seen_by_actor: {
      customer: isoFromOffset(-14),
      technician: isoFromOffset(-12),
    },
    ...emptyWorkflowFields(),
  });

  const maintenanceCase: ServiceCase = syncTrackingCase({
    id: "case-toyota-maintenance-003",
    vehicle_id: "veh-toyota-06-xyz-77",
    kind: "maintenance",
    status: "scheduled",
    title: "120.000 km bakim planı",
    subtitle: "",
    summary:
      "Bakim kalemleri netlesti; teslim modu ve ilk kabul hazirligina gecildi.",
    created_at: isoFromOffset(-28),
    created_at_label: "2 gun önce",
    updated_at: isoFromOffset(-6),
    updated_at_label: "6 sa önce",
    request: {
      ...createTrackingDraftForKind("maintenance", "veh-toyota-06-xyz-77"),
      preferred_technician_id: "tech-autopro-servis",
    },
    assigned_technician_id: "tech-autopro-servis",
    preferred_technician_id: "tech-autopro-servis",
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: "₺5.980",
    estimate_label: "Yarin 14:00",
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: getTrackingServiceSnapshot(
      "tech-autopro-servis",
      "Vale teslimli bakim akisi kuruluyor",
    ),
    documents: [
      document(
        "doc-maintenance-scope",
        "document",
        "Bakim kapsam listesi",
        "Platform ozeti",
        "Hazir",
        "Dün",
        "Yag, filtre, fren sivisi, genel kontrol.",
      ),
    ],
    offers: [
      offer(
        "offer-maintenance-autopro",
        "tech-autopro-servis",
        5980,
        300,
        "accepted",
        "Vale teslim ve kontrol raporu disiplini",
        "Planli bakimda teslim saati ve son kontrol ozetini net tutuyor.",
        ["Vale", "Bakim", "Kontrol raporu"],
      ),
      offer(
        "offer-maintenance-engin",
        "tech-engin-oto",
        5440,
        360,
        "rejected",
        "Hizli fiyat ama daha zayif teslim dili",
        "Bakim icin hizli fiyat sundu fakat karar bu servis lehine netlesti.",
        ["Hizli fiyat"],
      ),
    ],
    attachments: [],
    events: [
      event(
        "event-maintenance-scheduled",
        "Bakim randevusu hazir",
        "Vale teslimi ve sabah kabul penceresi olusturuldu.",
        "6 sa önce",
        "info",
      ),
    ],
    thread: {
      id: "thread-maintenance-003",
      case_id: "case-toyota-maintenance-003",
      preview: "Vale teslimi icin sabah saatlerini netlestirebiliriz.",
      unread_count: 0,
      messages: [
        message(
          "message-maintenance-1",
          "AutoPro Servis",
          "technician",
          "Sabah vale teslimi uygunsa ilk kabul fotografini yukleyerek baslayacagiz.",
          "6 sa önce",
        ),
      ],
    },
    workflow_blueprint: "maintenance_standard",
    wait_state: {
      actor: "customer",
      label: "Randevu teyidi bekleniyor",
      description: "Vale teslimi ve kabul saati son kez netlesecek.",
    },
    last_seen_by_actor: {
      customer: isoFromOffset(-12),
      technician: isoFromOffset(-10),
    },
    ...emptyWorkflowFields(),
  });

  const completedCase: ServiceCase = syncTrackingCase({
    id: "case-bmw-maintenance-004",
    vehicle_id: "veh-bmw-34-abc-42",
    kind: "maintenance",
    status: "completed",
    title: "Gecen ay tamamlanan bakim",
    subtitle: "",
    summary:
      "Fatura, son kontrol ve garanti notu bu kayitta saklaniyor.",
    created_at: isoFromOffset(-220),
    created_at_label: "Gecen ay",
    updated_at: isoFromOffset(-180),
    updated_at_label: "18 gun önce",
    request: createTrackingDraftForKind("maintenance", "veh-bmw-34-abc-42"),
    assigned_technician_id: "tech-autopro-servis",
    preferred_technician_id: "tech-autopro-servis",
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: "₺4.280",
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: getTrackingServiceSnapshot(
      "tech-autopro-servis",
      "Bu bakim kaydi tamamlandi",
    ),
    documents: [
      document(
        "doc-completed-invoice",
        "invoice",
        "Bakim faturasi",
        "Servis faturasi",
        "Onaylandi",
        "18 gun önce",
      ),
      document(
        "doc-completed-report",
        "report",
        "Final kontrol raporu",
        "Servis raporu",
        "Arsivde",
        "18 gun önce",
      ),
    ],
    offers: [
      offer(
        "offer-completed-autopro",
        "tech-autopro-servis",
        4280,
        240,
        "accepted",
        "Tamamlanan bakim",
        "Evrak ve final kontrol bu kayitta duruyor.",
        ["Tamamlandi"],
      ),
    ],
    attachments: [],
    events: [
      event(
        "event-completed-maintenance",
        "Bakim tamamlandi",
        "Fatura ve final kontrol notu kayda alindi.",
        "18 gun önce",
        "success",
        "completed",
      ),
    ],
    thread: {
      id: "thread-completed-004",
      case_id: "case-bmw-maintenance-004",
      preview: "Fatura ve final kontrol raporu kayda alindi.",
      unread_count: 0,
      messages: [
        message(
          "message-completed-1",
          trackingServiceDirectory["tech-autopro-servis"].name,
          "technician",
          "Bakim tamamlandi; garanti notunu ve final raporunu ekledik.",
          "18 gun önce",
        ),
      ],
    },
    workflow_blueprint: "maintenance_standard",
    wait_state: {
      actor: "none",
      label: "Bekleyen taraf yok",
      description: "Bu surec artik yalnizca kayit olarak okunuyor.",
    },
    last_seen_by_actor: {
      customer: isoFromOffset(-120),
      technician: isoFromOffset(-120),
    },
    ...emptyWorkflowFields(),
  });

  // ============================================================
  // POOL CASES — matching status, no technician assigned, no offer from us
  // Bu case'ler usta-app'te "İş Havuzu" feature'ında gözükür.
  // Customer app'te görünmemeleri için ayrı (fake) vehicle_id'ler kullanılır.
  // ============================================================

  const poolCase1: ServiceCase = syncTrackingCase({
    id: "case-pool-corolla-001",
    vehicle_id: "veh-pool-34-xyz-01",
    kind: "breakdown",
    status: "matching",
    title: "Yol kenarında arıza · Motor stop etti",
    subtitle: "Toyota Corolla 2018",
    summary:
      "Otoyolda aniden motor durdu, marş alıyor ama çalışmıyor. Benzin göstergesi normal.",
    created_at: isoFromOffset(-1),
    created_at_label: "1 saat önce",
    updated_at: isoFromOffset(-0.5),
    updated_at_label: "30 dk önce",
    request: {
      ...createTrackingDraftForKind("breakdown", "veh-pool-34-xyz-01"),
      urgency: "urgent",
      summary:
        "Otoyolda aniden motor durdu, marş alıyor ama çalışmıyor. Benzin göstergesi normal.",
      location_label: "TEM Otoyolu · Hasdal çıkışı yakını",
      notes:
        "Yaklaşık 5 km hızlanmadan sonra güç kaybı, ardından tamamen durdu. Araçta 2 yolcu var.",
      symptoms: ["Motor durdu", "Marş dönüyor, ateşleme yok", "Motor lambası yandı"],
      breakdown_category: "engine",
      vehicle_drivable: false,
      towing_required: true,
      pickup_preference: "pickup",
      price_preference: "fast",
      mileage_km: 142000,
    },
    assigned_technician_id: null,
    preferred_technician_id: null,
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: null,
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: null,
    documents: [],
    offers: [],
    attachments: [
      attachment("pool1-a1", "photo", "Motor bölmesi", "Kullanıcı paylaştı"),
      attachment("pool1-a2", "audio", "Marş sesi", "14 sn"),
    ],
    events: [
      event(
        "pool1-e1",
        "Havuzda açıldı",
        "Müşteri arıza bildirdi; eşleşen ustalar taranıyor.",
        "30 dk önce",
        "info",
        "submitted",
      ),
    ],
    thread: {
      id: "pool1-thread",
      case_id: "case-pool-corolla-001",
      preview: "Talep havuza düştü.",
      unread_count: 0,
      messages: [],
    },
    workflow_blueprint: "maintenance_standard",
    wait_state: {
      actor: "system",
      label: "Platform tarama yapıyor",
      description: "Uygun ustalar bilgilendiriliyor.",
    },
    last_seen_by_actor: { customer: isoFromOffset(-0.5), technician: null },
    ...emptyWorkflowFields(),
  });

  const poolCase2: ServiceCase = syncTrackingCase({
    id: "case-pool-clio-002",
    vehicle_id: "veh-pool-06-abc-02",
    kind: "breakdown",
    status: "matching",
    title: "Lastik patlağı · Yedek yok",
    subtitle: "Renault Clio 2020",
    summary:
      "Sol ön lastik patladı. Yedek lastik yok, yol kenarındayım. Yakında servise çekilmem lazım.",
    created_at: isoFromOffset(-2),
    created_at_label: "2 saat önce",
    updated_at: isoFromOffset(-1.5),
    updated_at_label: "1,5 saat önce",
    request: {
      ...createTrackingDraftForKind("breakdown", "veh-pool-06-abc-02"),
      urgency: "urgent",
      summary:
        "Sol ön lastik patladı. Yedek lastik yok, yol kenarındayım. Yakında servise çekilmem lazım.",
      location_label: "D100 karayolu · Sancaktepe yönü",
      dropoff_label: "En yakın lastikçiye transfer",
      notes: "Çocukla birlikteyim, hızlı çözüm gerekiyor.",
      symptoms: ["Sol ön lastik patladı", "Yedek yok"],
      breakdown_category: "tire",
      vehicle_drivable: false,
      towing_required: true,
      pickup_preference: "pickup",
      price_preference: "nearby",
      mileage_km: 68000,
    },
    assigned_technician_id: null,
    preferred_technician_id: null,
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: null,
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: null,
    documents: [],
    offers: [],
    attachments: [
      attachment("pool2-a1", "photo", "Patlak lastik", "Yol kenarı"),
      attachment("pool2-a2", "location", "Konum paylaşıldı", "Maslak"),
    ],
    events: [
      event(
        "pool2-e1",
        "Havuzda açıldı",
        "Acil lastik değişimi için eşleşme bekleniyor.",
        "1,5 saat önce",
        "warning",
        "submitted",
      ),
    ],
    thread: {
      id: "pool2-thread",
      case_id: "case-pool-clio-002",
      preview: "Acil lastik değişimi bekleniyor.",
      unread_count: 0,
      messages: [],
    },
    workflow_blueprint: "maintenance_standard",
    wait_state: {
      actor: "system",
      label: "Platform tarama yapıyor",
      description: "Yakın bölgedeki lastikçilere bildirim gidiyor.",
    },
    last_seen_by_actor: { customer: isoFromOffset(-1), technician: null },
    ...emptyWorkflowFields(),
  });

  // ============================================================
  // OFFER-COMPETITION CASE — bizim teklifimiz + 2 rakip usta
  // offers_ready, preferred/assigned yok, yarışma var
  // ============================================================

  const competitionCase: ServiceCase = syncTrackingCase({
    id: "case-pool-bmw-revizyon-003",
    vehicle_id: "veh-pool-34-def-03",
    kind: "breakdown",
    status: "offers_ready",
    title: "Motor revizyon · Yüksek km",
    subtitle: "BMW 320i 2014",
    summary:
      "Yağ kaçağı + motor yüksek km. Revizyon veya değişim kararı için teklif bekleniyor.",
    created_at: isoFromOffset(-6),
    created_at_label: "6 saat önce",
    updated_at: isoFromOffset(-2),
    updated_at_label: "2 saat önce",
    request: {
      ...createTrackingDraftForKind("breakdown", "veh-pool-34-def-03"),
      urgency: "today",
      summary:
        "Yağ kaçağı + motor yüksek km. Revizyon veya değişim kararı için teklif bekleniyor.",
      location_label: "Maslak Sanayi",
      notes:
        "Araç 268.000 km. Subap kapağından yağ kaçağı, motor yüksek km. Komple revizyon ya da değişim arası karar verecek.",
      symptoms: ["Yağ kaçağı", "Titreşim", "Yüksek yağ tüketimi"],
      breakdown_category: "engine",
      vehicle_drivable: true,
      towing_required: false,
      pickup_preference: "dropoff",
      price_preference: "any",
      mileage_km: 268000,
    },
    assigned_technician_id: null,
    preferred_technician_id: null,
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: null,
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: null,
    documents: [],
    offers: [
      offer(
        "comp-offer-me",
        "tech-autopro-servis",
        18500,
        180,
        "pending",
        "Revizyon paketi — orijinal parça",
        "Zaman. kiti + turbo kontrol + silindir ölçümü dahil.",
        ["Fatura disiplini", "OEM parça"],
      ),
      offer(
        "comp-offer-rival1",
        "tech-sariyer-motor",
        16200,
        240,
        "pending",
        "Revizyon — muadil parça",
        "Yüksek km motor için optimize paket.",
        ["Sponsorlu"],
      ),
      offer(
        "comp-offer-rival2",
        "tech-agir-bakim",
        21800,
        120,
        "pending",
        "Tam revizyon + garanti",
        "1 yıl garantili komple revizyon.",
        ["Ağır bakım"],
      ),
    ],
    attachments: [
      attachment("comp-a1", "photo", "Motor bölmesi", "Detaylı"),
      attachment("comp-a2", "video", "Çalışma sesi", "22 sn"),
    ],
    events: [
      event(
        "comp-e1",
        "3 teklif geldi",
        "Müşteri tekliflerini karşılaştırıyor.",
        "2 saat önce",
        "accent",
        "offer_received",
      ),
    ],
    thread: {
      id: "comp-thread",
      case_id: "case-pool-bmw-revizyon-003",
      preview: "Teklifler karşılaştırmada.",
      unread_count: 0,
      messages: [],
    },
    workflow_blueprint: "maintenance_major",
    wait_state: {
      actor: "customer",
      label: "Karar sende",
      description: "Müşteri teklifler arasından seçim yapacak.",
    },
    last_seen_by_actor: { customer: isoFromOffset(-1), technician: null },
    ...emptyWorkflowFields(),
  });

  // ============================================================
  // APPOINTMENT-PENDING CASE — bize randevu talebi gelmiş
  // ============================================================

  const appointmentIncomingCase: ServiceCase = syncTrackingCase({
    id: "case-appt-mercedes-004",
    vehicle_id: "veh-pool-34-ghi-04",
    kind: "accident",
    status: "appointment_pending",
    title: "Kaza bildirimi · Yan darbe",
    subtitle: "Mercedes C200 2021",
    summary:
      "Sağ ön çamurluk ve kapıya çarpma. Kasko aktif. Müşteri randevu talep etti.",
    created_at: isoFromOffset(-3),
    created_at_label: "3 saat önce",
    updated_at: isoFromOffset(-0.2),
    updated_at_label: "15 dk önce",
    request: {
      ...createTrackingDraftForKind("accident", "veh-pool-34-ghi-04"),
      urgency: "today",
      summary:
        "Sağ ön çamurluk ve kapıya çarpma. Kasko aktif. Müşteri randevu talep etti.",
      location_label: "Levent · Büyükdere Cad.",
      notes:
        "Otopark içi manevra sırasında yan darbe. Başka araç hasar görmedi, sürücü sağlam.",
      damage_area: "front_right",
      vehicle_drivable: true,
      towing_required: false,
      kasko_selected: true,
      kasko_brand: "Axa Sigorta",
      sigorta_selected: false,
      report_method: "e_devlet",
      ambulance_contacted: false,
      emergency_acknowledged: false,
      counterparty_vehicle_count: 1,
      counterparty_note: "Karşı taraf park halindeydi, tutanak düzenlendi.",
      valet_requested: true,
      pickup_preference: "valet",
      mileage_km: 38400,
    },
    assigned_technician_id: null,
    preferred_technician_id: "tech-autopro-servis",
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: null,
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: getTrackingServiceSnapshot(
      "tech-autopro-servis",
      "Randevu onayı bekleniyor",
    ),
    documents: [],
    offers: [
      offer(
        "appt-offer-accepted",
        "tech-autopro-servis",
        7800,
        1440,
        "accepted",
        "Kaza onarımı paketi",
        "Çamurluk + kapı + boya uyumlu onarım.",
        ["Kasko uyumlu"],
      ),
    ],
    attachments: [
      attachment("appt-a1", "photo", "Hasar fotoğrafı", "Çamurluk"),
      attachment("appt-a2", "photo", "Kapı detay", ""),
    ],
    events: [
      event(
        "appt-e1",
        "Randevu talebi gönderildi",
        "Müşteri yarın 10:00-13:00 aralığı için randevu talep etti.",
        "15 dk önce",
        "accent",
        "status_update",
      ),
    ],
    thread: {
      id: "appt-thread",
      case_id: "case-appt-mercedes-004",
      preview: "Randevu onayınızı bekleniyor.",
      unread_count: 1,
      messages: [
        message(
          "appt-m1",
          "Naro",
          "system",
          "Yeni randevu talebi: Yarın 10:00-13:00. Onayla veya reddet.",
          "15 dk önce",
        ),
      ],
    },
    workflow_blueprint: "damage_insured",
    wait_state: {
      actor: "technician",
      label: "Usta yanıtı bekleniyor",
      description: "Müşteri randevu talebini gönderdi.",
    },
    last_seen_by_actor: { customer: isoFromOffset(-0.2), technician: null },
    ...emptyWorkflowFields(),
    appointment: {
      id: "appt-pending-001",
      case_id: "case-appt-mercedes-004",
      technician_id: "tech-autopro-servis",
      offer_id: "appt-offer-accepted",
      slot: {
        kind: "tomorrow",
        dateLabel: "Yarın",
        timeWindow: "10:00–13:00",
      },
      note: "Kasko onaylı, aracı sabah bırakırım.",
      status: "pending",
      requested_at: isoFromOffset(-0.2),
      expires_at: isoFromOffset(23.8),
      responded_at: null,
      decline_reason: null,
    },
  });

  // ============================================================
  // INSURANCE CASE — usta tarafından açılmış sigorta dosyası
  // origin='technician', assigned=me
  // ============================================================

  const insuranceCase: ServiceCase = syncTrackingCase({
    id: "case-insurance-audi-005",
    vehicle_id: "veh-pool-34-jkl-05",
    kind: "accident",
    status: "service_in_progress",
    title: "Sigorta dosyası · Tampon darbesi",
    subtitle: "Audi A4 2019",
    summary:
      "Müşteri doğrudan atölyeye geldi. Tampon ve sağ far hasarı; kasko dosyası açıldı.",
    created_at: isoFromOffset(-24),
    created_at_label: "1 gün önce",
    updated_at: isoFromOffset(-2),
    updated_at_label: "2 saat önce",
    request: {
      ...createTrackingDraftForKind("accident", "veh-pool-34-jkl-05"),
      urgency: "today",
      summary:
        "Müşteri doğrudan atölyeye geldi. Tampon ve sağ far hasarı; kasko dosyası açıldı.",
      location_label: "AutoPro Atölye · Maslak",
      notes:
        "Trafik sigortası karşı tarafta; kasko uyumlu tamir için süreç başlatıldı.",
      damage_area: "bumper_front",
      vehicle_drivable: true,
      towing_required: false,
      kasko_selected: true,
      kasko_brand: "Axa Sigorta",
      sigorta_selected: false,
      report_method: "police",
      ambulance_contacted: false,
      emergency_acknowledged: false,
      counterparty_vehicle_count: 1,
      valet_requested: false,
      pickup_preference: "dropoff",
      mileage_km: 82300,
    },
    assigned_technician_id: "tech-autopro-servis",
    preferred_technician_id: "tech-autopro-servis",
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: "₺9.400",
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: getTrackingServiceSnapshot(
      "tech-autopro-servis",
      "Sigorta dosyasını açan usta",
    ),
    documents: [
      document(
        "ins-d1",
        "document",
        "Kasko poliçesi",
        "Müşteri yükledi",
        "Onaylı",
        "1 gün önce",
      ),
      document(
        "ins-d2",
        "photo",
        "Hasar fotoğrafları",
        "Müşteri yükledi",
        "Sigortaya gönderilecek",
        "1 gün önce",
      ),
    ],
    offers: [],
    attachments: [
      attachment("ins-a1", "photo", "Ön tampon detay", ""),
      attachment("ins-a2", "photo", "Sağ far kırık", ""),
    ],
    events: [
      event(
        "ins-e1",
        "Sigorta dosyası açıldı",
        "AutoPro Servis kasko dosyasını hazırladı. Axa Sigorta · Poliçe: AX-2024-87234.",
        "1 gün önce",
        "info",
        "submitted",
      ),
      event(
        "ins-e2",
        "Fotoğraflar eklendi",
        "6 hasar fotoğrafı ve poliçe sayfası sisteme yüklendi.",
        "20 saat önce",
        "info",
      ),
    ],
    thread: {
      id: "ins-thread",
      case_id: "case-insurance-audi-005",
      preview: "Sigorta dosyası hazır.",
      unread_count: 0,
      messages: [
        message(
          "ins-m1",
          "Naro",
          "system",
          "Sigorta dosyası hazırlandı — Axa Sigorta. Belge ve fotoğraflar sigortaya iletilmek üzere dosyada.",
          "1 gün önce",
        ),
      ],
    },
    workflow_blueprint: "damage_insured",
    wait_state: {
      actor: "technician",
      label: "Usta dosyayı ilerletiyor",
      description: "Sigorta iletimi ve onarım paralel.",
    },
    last_seen_by_actor: {
      customer: null,
      technician: isoFromOffset(-2),
    },
    ...emptyWorkflowFields(),
    origin: "technician",
    insurance_claim: {
      policy_number: "AX-2024-87234",
      insurer: "Axa Sigorta",
      coverage_kind: "kasko",
      claim_amount_estimate: 9400,
      status: "submitted",
      customer_name: "Zeynep Aksoy",
      customer_phone: "+90 532 *** 12 84",
    },
  });

  return [
    breakdownCase,
    accidentCase,
    maintenanceCase,
    completedCase,
    poolCase1,
    poolCase2,
    competitionCase,
    appointmentIncomingCase,
    insuranceCase,
  ].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}
