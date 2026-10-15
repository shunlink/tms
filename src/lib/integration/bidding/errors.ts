export class BiddingIntegrationError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "BiddingIntegrationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function partyNotLinkedError(party: "CLIENT" | "VENDOR") {
  return new BiddingIntegrationError(
    `${party === "CLIENT" ? "Client" : "Vendor"} not linked to Bidding company`,
    "PARTY_NOT_LINKED",
    404,
    { party }
  );
}
