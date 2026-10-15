// Pure business logic shared by queries/API and covered by unit tests.

export function computeMargin(clientRate: number, vendorRate: number): number {
  return clientRate - vendorRate;
}

export type AgeBucket = "current" | "d30" | "d60" | "d90";

export function ageBucket(days: number): AgeBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  return "d90";
}

export type MatchInput = {
  vehicleType: string;
  requirementType: string;
  rating: number;
  laneCount: number;
  busy: boolean;
};

export function scoreMatch(input: MatchInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (input.vehicleType === input.requirementType) {
    score += 4;
    reasons.push("Exact vehicle type");
  } else if (input.vehicleType.split("_")[0] === input.requirementType.split("_")[0]) {
    score += 1;
    reasons.push("Similar vehicle type");
  }

  score += input.rating;
  if (input.rating >= 4) reasons.push(`High-rated vendor (${input.rating.toFixed(1)}★)`);

  if (input.laneCount > 0) {
    score += input.laneCount * 1.5;
    reasons.push(`Ran this lane ${input.laneCount}x`);
  }

  if (!input.busy) {
    score += 2;
    reasons.push("Available now");
  } else {
    reasons.push("Currently on a trip");
  }

  return { score: Math.round(score * 10) / 10, reasons };
}

export function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const NOTIFY_MESSAGES: Record<string, string> = {
  DISPATCHED: "has been dispatched",
  IN_TRANSIT: "is in transit",
  DELIVERED: "has been delivered",
  POD_RECEIVED: "POD has been received",
  INVOICED: "has been invoiced",
  CLOSED: "has been closed",
};

export function notificationMessage(status: string): string | null {
  return NOTIFY_MESSAGES[status] ?? null;
}
