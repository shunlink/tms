import { describe, expect, it } from "vitest";
import { clientOnboardEntryPath, onboardingCreatedByLabel } from "./client-onboarding";

describe("clientOnboardEntryPath", () => {
  it("routes incomplete clients to the unified onboarding form", () => {
    expect(clientOnboardEntryPath("PENDING")).toBe("/onboard/client");
    expect(clientOnboardEntryPath("REJECTED")).toBe("/onboard/client");
  });

  it("routes approved or submitted clients to the portal", () => {
    expect(clientOnboardEntryPath("APPROVED")).toBe("/portal/client");
    expect(clientOnboardEntryPath("PENDING_APPROVAL")).toBe("/portal/client");
    expect(clientOnboardEntryPath("PARTIAL_SUBMISSION")).toBe("/portal/client");
  });
});

describe("onboardingCreatedByLabel", () => {
  it("maps preference to labels", () => {
    expect(onboardingCreatedByLabel("SELF")).toBe("Client");
    expect(onboardingCreatedByLabel("SHUNLINK")).toBe("Team");
  });
});
