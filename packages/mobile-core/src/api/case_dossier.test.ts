import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api";

import { fetchCaseDossier } from "./case_dossier";

const dossierFixture = {
  shell: {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "maintenance",
    status: "matching",
    urgency: "planned",
    origin: "customer",
    title: "Periyodik bakım",
    subtitle: null,
    summary: "Yağ ve filtre bakımı",
    location_label: "Kadıköy",
    wait_state: {
      actor: "technician",
      label: "Teklif bekleniyor",
      description: null,
    },
    created_at: "2026-04-26T09:00:00Z",
    updated_at: "2026-04-26T09:01:00Z",
    closed_at: null,
  },
  vehicle: {
    plate: "34 ABC 123",
    make: "Volkswagen",
    model: "Passat",
    year: 2019,
    fuel_type: "diesel",
    vin: null,
    current_km: 84000,
  },
  kind_detail: {
    kind: "maintenance",
    maintenance_category: "periodic",
    maintenance_detail: { oil: true },
    maintenance_tier: "standard",
    service_style_preference: null,
    mileage_km: 84000,
    valet_requested: false,
    pickup_preference: null,
    price_preference: null,
  },
  attachments: [],
  evidence: [],
  documents: [],
  matches: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      technician_user_id: "33333333-3333-4333-8333-333333333333",
      score: "88.50",
      reason_label: "Bakım işlerinde uygun",
      match_badge: "Bu vakaya uygun",
      visibility_state: "shown_to_customer",
    },
  ],
  notifications: [],
  offers: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      technician_user_id: "33333333-3333-4333-8333-333333333333",
      technician_display_label: "Kadıköy Servis",
      amount: "3500.00",
      currency: "TRY",
      status: "pending",
      slot_proposal: null,
      created_at: "2026-04-26T09:15:00Z",
    },
  ],
  appointment: null,
  assignment: null,
  approvals: [],
  payment_snapshot: {
    billing_state: null,
    estimate_amount: "3500.00",
    total_amount: null,
    preauth_held: null,
    captured: null,
    refunded: null,
    last_event_at: null,
  },
  tow_snapshot: null,
  milestones: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      milestone_key: "matching",
      title: "Teklif aşaması",
      description: null,
      actor: "technician",
      status: "active",
      order: 1,
    },
  ],
  tasks: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      task_key: "review_offers",
      kind: "review_offers",
      title: "Teklifleri değerlendir",
      description: null,
      actor: "customer",
      status: "active",
      urgency: "now",
      cta_label: "Teklifleri gör",
      helper_label: null,
      milestone_key: "matching",
    },
  ],
  timeline_summary: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      event_type: "submitted",
      title: "Vaka oluşturuldu",
      tone: "info",
      actor_user_id: null,
      context_summary: null,
      occurred_at: "2026-04-26T09:00:00Z",
    },
  ],
  viewer: {
    role: "customer",
    is_matched_to_me: false,
    match_reason_label: null,
    match_badge: null,
    is_notified_to_me: false,
    has_offer_from_me: false,
    can_send_offer: false,
    can_notify_to_me: false,
    other_match_count: 0,
    competitor_offer_average: null,
    competitor_offer_count: 0,
  },
};

describe("case dossier api", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses the backend dossier contract through the shared Zod schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(dossierFixture)),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const apiClient = createApiClient({
      baseUrl: "https://api.example.com",
    });

    const dossier = await fetchCaseDossier(
      apiClient,
      "11111111-1111-4111-8111-111111111111",
    );

    expect(dossier.shell.title).toBe("Periyodik bakım");
    expect(dossier.matches[0]?.match_badge).toBe("Bu vakaya uygun");
    expect(dossier.milestones[0]?.milestone_key).toBe("matching");
    expect(dossier.tasks[0]?.task_key).toBe("review_offers");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/cases/11111111-1111-4111-8111-111111111111/dossier",
    );
  });
});
