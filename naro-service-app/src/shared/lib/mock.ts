import { mockDelay } from "@naro/mobile-core";

import { env, type ApprovalStatus } from "@/runtime";

export const IS_MOCK_AUTH = env.mockAuth;

export const MOCK_APPROVAL: ApprovalStatus = env.mockApproval;

export { mockDelay };
