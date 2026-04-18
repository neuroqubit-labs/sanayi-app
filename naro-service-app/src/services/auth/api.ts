import {
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerify,
  type TokenPair,
  TokenPairSchema,
} from "@naro/domain";

import { api } from "@/shared/lib/api";

export type { OtpRequest, OtpRequestResponse, OtpVerify, TokenPair };

export const authApi = {
  requestOtp: (payload: Omit<OtpRequest, "role">) =>
    api<OtpRequestResponse>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ role: "technician", ...payload }),
    }),
  verifyOtp: async (payload: OtpVerify) => {
    const body = await api<TokenPair>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return TokenPairSchema.parse(body);
  },
};
