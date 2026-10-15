import type { SessionUser } from "./auth";
import { isInternalRole } from "./teams";

export function formatAdvanceSourceLabel(source: string): string {
  if (source === "INTERNAL") return "Internal";
  if (source === "SHUNLINK") return "Vendor";
  if (source === "EXTERNAL") return "External";
  return source;
}

export function formatAdvanceRaisedByLabel(
  source: string,
  requestedBy?: { name: string | null } | null
): string {
  if (source === "INTERNAL") {
    return requestedBy?.name ? `Finance — ${requestedBy.name}` : "Internal";
  }
  if (source === "SHUNLINK") return "Vendor";
  return requestedBy?.name ?? "—";
}

export function buildOnBehalfEventRemarks(vendorName: string, actorName: string): string {
  return `Advance request raised on behalf of ${vendorName} by ${actorName}`;
}

/** Internal staff only — vendors and portal users cannot raise on behalf. */
export function assertCanRaiseAdvanceOnBehalf(actor: SessionUser): void {
  if (actor.vendorId) {
    throw new Error("Vendor users cannot raise advances on behalf of vendors");
  }
  if (actor.clientId) {
    throw new Error("Unauthorized");
  }
  if (!isInternalRole(actor.role)) {
    throw new Error("Only internal staff can raise advances on behalf of vendors");
  }
}
