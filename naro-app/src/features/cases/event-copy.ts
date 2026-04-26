import type { CaseEventType, CaseTone } from "@naro/domain";
import {
  AlertTriangle,
  Archive,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  CircleDollarSign,
  CircleOff,
  FileCheck2,
  FileText,
  Gauge,
  Handshake,
  Hourglass,
  Info,
  MessageCircle,
  Package,
  Paperclip,
  Receipt,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Truck,
  Undo2,
  Upload,
  UserCheck,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";

/**
 * Timeline event copy kataloğu — F-P0-1 (2026-04-23 lifecycle integrity
 * audit L3-P0-1). BE `append_event()` çağrılarında `title` + `body` zaten
 * Türkçe dolduruluyor; bu helper fallback + icon + tone override için.
 *
 * Kullanım:
 * - `event.title` dolu gelirse onu kullan (BE primary source)
 * - Dolu gelmezse `getEventCopy(type).title`
 * - `getEventIcon(type)` ProcessTimelineCard'ta per-event icon için
 * - `getEventTone(type)` BE tone yoksa fallback
 */

type EventMeta = {
  title: string;
  body: string;
  icon: LucideIcon;
  tone: CaseTone;
};

const EVENT_META: Record<CaseEventType, EventMeta> = {
  // Case lifecycle
  submitted: {
    title: "Vaka açıldı",
    body: "Talep platformda oluşturuldu, eşleşme başladı",
    icon: Sparkles,
    tone: "info",
  },
  status_update: {
    title: "Durum güncellendi",
    body: "Vaka akışı bir sonraki adıma geçti",
    icon: Info,
    tone: "info",
  },
  completed: {
    title: "Vaka tamamlandı",
    body: "İş tamamlandı, vaka kapandı",
    icon: CheckCircle2,
    tone: "success",
  },
  cancelled: {
    title: "Vaka iptal edildi",
    body: "Vaka kullanıcı veya admin tarafından iptal edildi",
    icon: XCircle,
    tone: "critical",
  },
  archived: {
    title: "Vaka arşivlendi",
    body: "Vaka arşive alındı",
    icon: Archive,
    tone: "neutral",
  },

  // Offers
  offer_received: {
    title: "Yeni teklif geldi",
    body: "Bir usta teklifini iletti",
    icon: Handshake,
    tone: "accent",
  },
  offer_accepted: {
    title: "Teklif kabul edildi",
    body: "Seçilen teklif onaylandı, randevu adımı başladı",
    icon: CheckCircle2,
    tone: "success",
  },
  offer_rejected: {
    title: "Teklif reddedildi",
    body: "Teklif kullanıcı tarafından reddedildi",
    icon: CircleOff,
    tone: "warning",
  },
  offer_withdrawn: {
    title: "Teklif geri çekildi",
    body: "Usta teklifini geri çekti",
    icon: Undo2,
    tone: "warning",
  },

  // Appointment
  appointment_requested: {
    title: "Randevu talebi iletildi",
    body: "Usta onayı bekleniyor",
    icon: CalendarClock,
    tone: "info",
  },
  appointment_approved: {
    title: "Randevu onaylandı",
    body: "Planlanan saatte işlem başlayacak",
    icon: CalendarCheck,
    tone: "success",
  },
  appointment_declined: {
    title: "Randevu reddedildi",
    body: "Usta randevuyu kabul etmedi; alternatifler gösterildi",
    icon: CalendarX,
    tone: "critical",
  },
  appointment_cancelled: {
    title: "Randevu iptal edildi",
    body: "Randevu iptal alındı",
    icon: CalendarX,
    tone: "warning",
  },
  appointment_expired: {
    title: "Randevu süresi doldu",
    body: "Usta zamanında yanıt vermedi",
    icon: Hourglass,
    tone: "warning",
  },
  appointment_counter: {
    title: "Randevu karşı teklif",
    body: "Usta farklı bir saat önerdi",
    icon: CalendarClock,
    tone: "accent",
  },

  // Technician match
  technician_selected: {
    title: "Usta seçildi",
    body: "Vaka seçilen ustaya atandı",
    icon: UserCheck,
    tone: "success",
  },
  technician_unassigned: {
    title: "Usta atama kaldırıldı",
    body: "Vaka tekrar eşleşme havuzuna düştü",
    icon: UserX,
    tone: "warning",
  },

  // Approvals + delivery
  parts_requested: {
    title: "Parça/kapsam onayı geldi",
    body: "Usta kapsam değişikliği paylaştı, onayın bekleniyor",
    icon: Package,
    tone: "warning",
  },
  parts_approved: {
    title: "Parça onayı verildi",
    body: "İş onaylanan kapsamla devam ediyor",
    icon: CheckCircle2,
    tone: "success",
  },
  parts_rejected: {
    title: "Parça talebi reddedildi",
    body: "Onaylanmayan kapsam uygulanmadan iş sürecek",
    icon: CircleOff,
    tone: "warning",
  },
  invoice_shared: {
    title: "Fatura paylaşıldı",
    body: "Usta faturayı paylaştı, onayın bekleniyor",
    icon: Receipt,
    tone: "info",
  },
  invoice_approved: {
    title: "Fatura onaylandı",
    body: "İş tamamlanmaya hazırlanıyor",
    icon: FileCheck2,
    tone: "success",
  },
  invoice_issued: {
    title: "E-arşiv fatura düzenlendi",
    body: "Fatura sisteme işlendi",
    icon: FileText,
    tone: "info",
  },

  // Thread + docs + evidence
  message: {
    title: "Yeni mesaj",
    body: "Vaka thread'ine mesaj eklendi",
    icon: MessageCircle,
    tone: "accent",
  },
  document_added: {
    title: "Belge eklendi",
    body: "Vaka dosyalarına yeni belge eklendi",
    icon: Paperclip,
    tone: "info",
  },
  evidence_added: {
    title: "Kanıt eklendi",
    body: "Fotoğraf/video kanıtı yüklendi",
    icon: Upload,
    tone: "info",
  },

  // Tow lifecycle
  tow_stage_requested: {
    title: "Çekici aşaması talep edildi",
    body: "Operatör aşama güncelliyor",
    icon: Truck,
    tone: "info",
  },
  tow_stage_committed: {
    title: "Çekici aşaması güncellendi",
    body: "Operatör yeni aşamayı onayladı",
    icon: Truck,
    tone: "success",
  },
  tow_evidence_added: {
    title: "Çekici kanıtı eklendi",
    body: "Teslim alma/bırakma fotoğrafı yüklendi",
    icon: Upload,
    tone: "info",
  },
  tow_fare_captured: {
    title: "Çekici ücreti kesinleşti",
    body: "Nihai tutar hesaplandı",
    icon: Gauge,
    tone: "info",
  },

  // Billing
  payment_initiated: {
    title: "Ödeme başlatıldı",
    body: "Tahsilat akışı devreye girdi",
    icon: CircleDollarSign,
    tone: "info",
  },
  payment_authorized: {
    title: "Ödeme yetkisi alındı",
    body: "Kart yetkisi başarılı, pre-auth tutuluyor",
    icon: ShieldCheck,
    tone: "success",
  },
  payment_captured: {
    title: "Ödeme çekildi",
    body: "Tutar hesabına yansıdı",
    icon: CheckCircle2,
    tone: "success",
  },
  payment_refunded: {
    title: "Ödeme iade edildi",
    body: "Tutar karta iade edildi",
    icon: RefreshCw,
    tone: "info",
  },
  billing_state_changed: {
    title: "Ödeme durumu değişti",
    body: "Billing aşaması güncellendi",
    icon: CircleDollarSign,
    tone: "info",
  },

  // Insurance
  insurance_claim_submitted: {
    title: "Sigorta dosyası açıldı",
    body: "Kasko/trafik dosyası sigortaya iletildi",
    icon: ShieldCheck,
    tone: "info",
  },
  insurance_claim_accepted: {
    title: "Sigorta dosyası kabul edildi",
    body: "Sigorta dosyayı değerlendirmeye aldı",
    icon: ShieldCheck,
    tone: "success",
  },
  insurance_claim_paid: {
    title: "Sigorta ödemesi yapıldı",
    body: "Sigorta tutarı hesabına yansıdı",
    icon: CircleDollarSign,
    tone: "success",
  },
  insurance_claim_rejected: {
    title: "Sigorta dosyası reddedildi",
    body: "Sigorta dosyayı kabul etmedi",
    icon: ShieldX,
    tone: "critical",
  },
};

const FALLBACK_META: EventMeta = {
  title: "Vaka güncellemesi",
  body: "",
  icon: AlertTriangle,
  tone: "info",
};

export function getEventMeta(type: CaseEventType): EventMeta {
  return EVENT_META[type] ?? FALLBACK_META;
}

export function getEventCopy(type: CaseEventType): {
  title: string;
  body: string;
} {
  const meta = getEventMeta(type);
  return { title: meta.title, body: meta.body };
}

export function getEventIcon(type: CaseEventType): LucideIcon {
  return getEventMeta(type).icon;
}

export function getEventFallbackTone(type: CaseEventType): CaseTone {
  return getEventMeta(type).tone;
}
