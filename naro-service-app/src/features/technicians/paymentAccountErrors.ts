import { ApiError } from "@naro/mobile-core";

export function apiErrorType(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body;
  if (!body || typeof body !== "object") return null;

  const detail = (body as { detail?: unknown }).detail;
  if (detail && typeof detail === "object") {
    const type = (detail as { type?: unknown }).type;
    return typeof type === "string" ? type : null;
  }

  const type = (body as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

export function isPaymentAccountRequiredError(error: unknown): boolean {
  return apiErrorType(error) === "payment_account_required";
}

export function paymentAccountRequiredMessage(action: string): string {
  return `${action} için ödeme hesabını tamamlaman gerekiyor. Profil > Ödeme hesabı bölümünden başvuruyu gönderebilirsin.`;
}
