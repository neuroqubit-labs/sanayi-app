import type { ServiceRequestKind } from "@naro/domain";

import { ACCIDENT_FLOW } from "./AccidentFlow";
import { BREAKDOWN_FLOW } from "./BreakdownFlow";
import { MAINTENANCE_FLOW } from "./MaintenanceFlow";
import { TOWING_FLOW } from "./TowingFlow";
import type { ComposerFlow } from "./types";

export const COMPOSER_FLOWS: Record<ServiceRequestKind, ComposerFlow> = {
  accident: ACCIDENT_FLOW,
  towing: TOWING_FLOW,
  breakdown: BREAKDOWN_FLOW,
  maintenance: MAINTENANCE_FLOW,
};

export function getComposerFlow(kind: ServiceRequestKind): ComposerFlow {
  return COMPOSER_FLOWS[kind];
}

export type { ComposerFlow, ComposerStep, ComposerStepRenderProps } from "./types";
