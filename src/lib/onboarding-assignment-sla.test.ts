import { describe, expect, it } from "vitest";
import { CLIENT_ONBOARDING_ASSIGNMENT_SLA_MS } from "./services/onboarding.service";

describe("CLIENT_ONBOARDING_ASSIGNMENT_SLA_MS", () => {
  it("is 24 hours", () => {
    expect(CLIENT_ONBOARDING_ASSIGNMENT_SLA_MS).toBe(24 * 60 * 60 * 1000);
  });
});
