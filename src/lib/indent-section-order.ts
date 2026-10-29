export type IndentDetailSection =
  | "quotes"
  | "allocation"
  | "form"
  | "tracking"
  | "advance"
  | "release"
  | "pod"
  | "events"
  | "history"
  | "documents";

const DEFAULT_ORDER: IndentDetailSection[] = [
  "allocation",
  "form",
  "advance",
  "quotes",
  "release",
  "tracking",
  "pod",
  "events",
  "history",
  "documents",
];

/** Returns indent detail card order based on current workflow stage. */
export function getIndentSectionOrder(
  status: string,
  options?: { biddingHandoff?: boolean },
): IndentDetailSection[] {
  if (options?.biddingHandoff && status === "PLACEMENT_PENDING") {
    return ["allocation", "form", "release", "tracking", "pod", "events", "history", "advance"];
  }
  const quoting = ["RELEASED_TO_VENDORS", "QUOTING"];
  const placement = ["PLACEMENT_PENDING", "VENDOR_ALLOCATED"];
  const executed = ["VEHICLE_PLACED", "DRIVER_ASSIGNED", "IN_TRANSIT", "DELIVERED", "POD_PENDING", "POD_RECEIVED", "COMPLETED"];

  if (quoting.includes(status)) {
    return ["quotes", "allocation", "release", "form", "tracking", "pod", "events", "history", "advance"];
  }
  if (placement.includes(status)) {
    return ["allocation", "form", "quotes", "release", "tracking", "pod", "events", "history", "advance"];
  }
  if (executed.includes(status)) {
    return ["allocation", "form", "tracking", "quotes", "release", "pod", "events", "history", "advance"];
  }
  return DEFAULT_ORDER.filter((s) => s !== "documents");
}
