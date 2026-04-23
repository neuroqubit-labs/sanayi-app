import {
  TokenPairSchema,
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerify,
  type TokenPair,
} from "@naro/domain";
import { create } from "zustand";

import type { ApiClient } from "./api";
import type { SessionRepository, SessionSnapshot } from "./session";
import { mockDelay } from "./mock";

export type BootstrapState = "hydrating" | "anonymous" | "authenticated" | "blocked";

export type AuthStoreState<TStatus extends string = string> = SessionSnapshot<TStatus> & {
  hydrated: boolean;
  bootstrapState: BootstrapState;
  hydrate: () => Promise<void>;
  setSession: (session: Partial<SessionSnapshot<TStatus>>) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setApprovalStatus: (status: TStatus | null) => Promise<void>;
  clear: () => Promise<void>;
};

type CreateAuthStoreOptions<TStatus extends string> = {
  repository: SessionRepository<TStatus>;
  isMockAuthEnabled?: boolean;
  mockSession?: Partial<SessionSnapshot<TStatus>>;
  evaluateBootstrapState?: (session: SessionSnapshot<TStatus>) => Exclude<BootstrapState, "hydrating">;
};

type OtpAuthApiOptions = {
  apiClient: ApiClient;
  role: OtpRequest["role"];
  isMockAuthEnabled?: boolean;
  mockOtpResponse: OtpRequestResponse;
  mockTokens: TokenPair;
};

function getInitialSession<TStatus extends string>(): SessionSnapshot<TStatus> {
  return {
    accessToken: null,
    refreshToken: null,
    approvalStatus: null,
  };
}

function defaultBootstrapState<TStatus extends string>(
  session: SessionSnapshot<TStatus>,
): Exclude<BootstrapState, "hydrating"> {
  return session.accessToken ? "authenticated" : "anonymous";
}

function withBootstrapState<TStatus extends string>(
  session: SessionSnapshot<TStatus>,
  hydrated: boolean,
  evaluateBootstrapState: (session: SessionSnapshot<TStatus>) => Exclude<BootstrapState, "hydrating">,
): Pick<AuthStoreState<TStatus>, "accessToken" | "refreshToken" | "approvalStatus" | "hydrated" | "bootstrapState"> {
  return {
    ...session,
    hydrated,
    bootstrapState: hydrated ? evaluateBootstrapState(session) : "hydrating",
  };
}

export function createAuthStore<TStatus extends string = string>(
  options: CreateAuthStoreOptions<TStatus>,
) {
  const {
    repository,
    isMockAuthEnabled = false,
    mockSession,
    evaluateBootstrapState = defaultBootstrapState,
  } = options;

  return create<AuthStoreState<TStatus>>((set, get) => ({
    ...withBootstrapState(getInitialSession<TStatus>(), false, evaluateBootstrapState),
    hydrate: async () => {
      let session = await repository.read();

      if (!session.accessToken && !session.refreshToken && isMockAuthEnabled && mockSession) {
        session = {
          ...session,
          ...mockSession,
          approvalStatus: mockSession.approvalStatus ?? session.approvalStatus,
        };
      }

      set(withBootstrapState(session, true, evaluateBootstrapState));
    },
    setSession: async (nextSession) => {
      const current = get();
      const session = {
        accessToken:
          nextSession.accessToken === undefined ? current.accessToken : nextSession.accessToken,
        refreshToken:
          nextSession.refreshToken === undefined
            ? current.refreshToken
            : nextSession.refreshToken,
        approvalStatus:
          nextSession.approvalStatus === undefined
            ? current.approvalStatus
            : nextSession.approvalStatus,
      };

      await repository.write(session);
      set(withBootstrapState(session, true, evaluateBootstrapState));
    },
    setTokens: (accessToken, refreshToken) => {
      return get().setSession({ accessToken, refreshToken });
    },
    setApprovalStatus: (approvalStatus) => {
      return get().setSession({ approvalStatus });
    },
    clear: async () => {
      await repository.clear();
      set(withBootstrapState(getInitialSession<TStatus>(), true, evaluateBootstrapState));
    },
  }));
}

export function createOtpAuthApi(options: OtpAuthApiOptions) {
  const { apiClient, role, isMockAuthEnabled = false, mockOtpResponse, mockTokens } = options;

  return {
    requestOtp: (payload: Omit<OtpRequest, "role">) => {
      if (isMockAuthEnabled) {
        return mockDelay(mockOtpResponse);
      }

      return apiClient<OtpRequestResponse>("/auth/otp/request", {
        method: "POST",
        body: { role, ...payload },
        // Public endpoint — `requireAuth` suppression bypass.
        auth: false,
      });
    },
    verifyOtp: async (payload: OtpVerify) => {
      if (isMockAuthEnabled) {
        return mockDelay(mockTokens);
      }

      const body = await apiClient<TokenPair>("/auth/otp/verify", {
        method: "POST",
        body: payload,
        auth: false,
      });

      return TokenPairSchema.parse(body);
    },
  };
}
