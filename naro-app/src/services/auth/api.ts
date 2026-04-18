import {
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerify,
  type TokenPair,
  TokenPairSchema,
} from "@naro/domain";

import { api } from "@/shared/lib/api";
import { IS_MOCK_AUTH, mockDelay } from "@/shared/lib/mock";

export type { OtpRequest, OtpRequestResponse, OtpVerify, TokenPair };

const MOCK_OTP_RESPONSE: OtpRequestResponse = {
  delivery_id: "mock-delivery",
  expires_in_seconds: 300,
};

const MOCK_TOKENS: TokenPair = {
  access_token: "mock-access-token-customer",
  refresh_token: "mock-refresh-token-customer",
  token_type: "bearer",
};

export const authApi = {
  requestOtp: (payload: Omit<OtpRequest, "role">) => {
    if (IS_MOCK_AUTH) return mockDelay(MOCK_OTP_RESPONSE);
    return api<OtpRequestResponse>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ role: "customer", ...payload }),
    });
  },
  verifyOtp: async (payload: OtpVerify) => {
    if (IS_MOCK_AUTH) return mockDelay(MOCK_TOKENS);
    const body = await api<TokenPair>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return TokenPairSchema.parse(body);
  },
};
