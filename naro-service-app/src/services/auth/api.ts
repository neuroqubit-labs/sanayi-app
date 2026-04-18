import { api } from "@/shared/lib/api";

export type OtpRequestPayload = {
  channel: "sms" | "email";
  phone?: string;
  email?: string;
};

export type OtpRequestResponse = {
  delivery_id: string;
  expires_in_seconds: number;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

export const authApi = {
  requestOtp: (payload: OtpRequestPayload) =>
    api<OtpRequestResponse>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ role: "technician", ...payload }),
    }),
  verifyOtp: (payload: { delivery_id: string; code: string }) =>
    api<TokenPair>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
