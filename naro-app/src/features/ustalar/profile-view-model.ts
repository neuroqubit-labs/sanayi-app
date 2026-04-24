import type {
  ProofPreviewItem,
  ProviderType,
  TechnicianPublicView,
} from "./schemas";
import type { TechnicianCta } from "./technician-cta";

export const PROVIDER_TYPE_LABEL: Record<ProviderType, string> = {
  usta: "Usta",
  cekici: "Çekici",
  oto_aksesuar: "Oto aksesuar",
  kaporta_boya: "Kaporta & boya",
  lastik: "Lastik",
  oto_elektrik: "Oto elektrik",
};

export const VERIFIED_META: Record<
  "basic" | "verified" | "premium",
  { label: string; tone: "info" | "accent" | "success" }
> = {
  basic: { label: "Yeni", tone: "info" },
  verified: { label: "Doğrulandı", tone: "accent" },
  premium: { label: "Premium", tone: "success" },
};

export type DecisionTone = "success" | "info" | "warning" | "neutral";

export function getActiveProviderType(
  profile: Pick<TechnicianPublicView, "active_provider_type" | "provider_type">,
): ProviderType {
  return profile.active_provider_type ?? profile.provider_type;
}

export function getProviderLabel(providerType: ProviderType): string {
  return PROVIDER_TYPE_LABEL[providerType] ?? "Servis";
}

export function getSecondaryProviderLabels(profile: TechnicianPublicView) {
  const activeType = getActiveProviderType(profile);
  return profile.secondary_provider_types
    .filter((type) => type !== activeType)
    .map((type) => PROVIDER_TYPE_LABEL[type])
    .filter((label): label is string => Boolean(label));
}

export function getRatingLabel(profile: TechnicianPublicView) {
  return profile.rating_bayesian !== null
    ? profile.rating_bayesian.toFixed(1)
    : "Yeni";
}

export function getPrimaryMediaUrl(item: ProofPreviewItem) {
  return (
    item.media.thumb_url ??
    item.media.preview_url ??
    item.media.download_url ??
    null
  );
}

export function buildFitCopy(profile: TechnicianPublicView, cta: TechnicianCta) {
  const providerType = getActiveProviderType(profile);
  const providerLabel = getProviderLabel(providerType);
  const domains = profile.fit_summary?.service_domains ?? [];
  const tags = profile.fit_summary?.procedure_tags ?? [];
  const firstDomain = domains[0]?.label;
  const firstTag = tags[0];

  if (cta.mode === "ready") {
    return {
      title: "Vakanla uyumlu",
      body:
        firstDomain || firstTag
          ? `${providerLabel} profili bu vaka için uygun görünüyor. Öne çıkan alan: ${firstDomain ?? firstTag}.`
          : `${providerLabel} profili aktif vakanın temel servis tipiyle uyumlu.`,
      tone: "success" as DecisionTone,
    };
  }

  if (cta.mode === "mismatch") {
    return {
      title: "Vakanla uyumlu değil",
      body: "Bu profil bu vaka için doğru servis tipi değil.",
      tone: "warning" as DecisionTone,
    };
  }

  return {
    title: "Hangi işler için uygun?",
    body:
      firstDomain || firstTag
        ? `${providerLabel}: ${[firstDomain, firstTag].filter(Boolean).join(" · ")} işleri için öne çıkıyor.`
        : providerDecisionCopy(providerType),
    tone: "info" as DecisionTone,
  };
}

export function buildFitSignals(profile: TechnicianPublicView) {
  const domains = profile.fit_summary?.service_domains ?? [];
  const tags = profile.fit_summary?.procedure_tags ?? [];
  const brands = profile.fit_summary?.brand_coverage ?? [];

  return [
    ...domains.slice(0, 3).map((item) => item.label),
    ...tags.slice(0, 3),
    ...brands.slice(0, 2).map((item) => item.label),
  ].slice(0, 6);
}

export function buildTrustMetrics(profile: TechnicianPublicView) {
  const trust = profile.trust_summary;
  const approvedCertificateCount = trust?.approved_certificate_count ?? 0;
  return [
    {
      key: "rating",
      value: getRatingLabel(profile),
      label:
        profile.rating_bayesian !== null
          ? `${profile.rating_count} yorum`
          : "Puan bekliyor",
      tone: "warning" as DecisionTone,
    },
    {
      key: "response",
      value: profile.response_time_p50_minutes
        ? `${profile.response_time_p50_minutes} dk`
        : "—",
      label: profile.response_time_p50_minutes ? "Ort. yanıt" : "Yanıt",
      tone: "success" as DecisionTone,
    },
    {
      key: "jobs",
      value:
        profile.completed_jobs_30d > 0
          ? profile.completed_jobs_30d.toString()
          : "—",
      label: profile.completed_jobs_30d > 0 ? "30 günde iş" : "Yeni servis",
      tone: "info" as DecisionTone,
    },
    {
      key: "certificates",
      value: approvedCertificateCount > 0 ? `${approvedCertificateCount}` : "—",
      label: approvedCertificateCount > 0 ? "Onaylı belge" : "Belge bekliyor",
      tone: "neutral" as DecisionTone,
    },
  ];
}

export function buildOperationItems(profile: TechnicianPublicView) {
  const operations = profile.operations;
  const location = operations?.location_summary ?? profile.location_summary;
  const items: string[] = [];

  const locationLabel = [
    location.primary_district_label,
    location.city_label,
  ]
    .filter(Boolean)
    .join(" · ");
  if (locationLabel) {
    items.push(
      location.service_radius_km
        ? `${locationLabel} · ${location.service_radius_km} km`
        : locationLabel,
    );
  }
  if (operations?.working_hours) items.push(operations.working_hours);
  if (operations?.mobile_service) items.push("Mobil servis");
  if (operations?.valet_service) items.push("Vale / pickup");
  if (operations?.on_site_repair) items.push("Yerinde teşhis");
  if (operations?.towing_coordination) items.push("Çekici koordinasyonu");
  if (operations?.weekend_service) items.push("Hafta sonu hizmet");
  if (operations?.emergency_service) items.push("Acil iş kabulü");
  if (operations?.max_concurrent_jobs) {
    items.push(`${operations.max_concurrent_jobs} eş zamanlı iş kapasitesi`);
  }

  return items.slice(0, 6);
}

export function providerDecisionCopy(providerType: ProviderType) {
  switch (providerType) {
    case "cekici":
      return "Çekici için mesafe, müsaitlik, ekipman ve tahmini varış kritik.";
    case "oto_elektrik":
      return "Elektrik işlerinde teşhis, marka bilgisi ve garanti sinyalleri öne çıkar.";
    case "kaporta_boya":
      return "Kaporta-boya tarafında önce/sonra kanıtı, sigorta ve teslim süreci önemlidir.";
    case "lastik":
      return "Lastik tarafında stok, mobil hizmet, balans ve hızlı teslim belirleyicidir.";
    case "oto_aksesuar":
      return "Aksesuar işlerinde ürün uyumu, işçilik kanıtı ve net teslim süresi önemlidir.";
    case "usta":
    default:
      return "Genel usta profilinde uzmanlık, marka kapsamı ve yakın iş kanıtı belirleyici olur.";
  }
}
