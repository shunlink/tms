import { describe, expect, it } from "vitest";
import {
  canAccessClientOnboardingRequest,
  canAssignClientOnboardingRequests,
  canCompleteClientOnboardingRequest,
  isOnboardingRequestsSuperAdmin,
} from "./onboarding-request-access";
import { ONBOARDING_CASE_STATUS } from "./onboarding-case-status";

describe("onboarding request access", () => {
  it("identifies Super Admin for queue ownership", () => {
    expect(isOnboardingRequestsSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isOnboardingRequestsSuperAdmin("ADMIN")).toBe(false);
    expect(canAssignClientOnboardingRequests("SUPER_ADMIN")).toBe(true);
    expect(canAssignClientOnboardingRequests("OPERATIONS")).toBe(false);
  });

  it("allows Super Admin to view any queue case", () => {
    expect(
      canAccessClientOnboardingRequest("sa-1", true, {
        status: ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
        assignedEmployeeId: null,
      })
    ).toBe(true);
    expect(
      canAccessClientOnboardingRequest("sa-1", true, {
        status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
        assignedEmployeeId: "emp-1",
      })
    ).toBe(true);
  });

  it("denies non–Super Admin access to unassigned partial submissions", () => {
    expect(
      canAccessClientOnboardingRequest("emp-1", false, {
        status: ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
        assignedEmployeeId: null,
      })
    ).toBe(false);
  });

  it("restricts employees to assigned cases only", () => {
    expect(
      canAccessClientOnboardingRequest("emp-1", false, {
        status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
        assignedEmployeeId: "emp-2",
      })
    ).toBe(false);
    expect(
      canAccessClientOnboardingRequest("emp-1", false, {
        status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
        assignedEmployeeId: "emp-1",
      })
    ).toBe(true);
  });

  it("does not allow ops completion on partial submissions", () => {
    expect(
      canCompleteClientOnboardingRequest("sa-1", true, {
        status: ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
        assignedEmployeeId: null,
      })
    ).toBe(false);
  });

  it("allows only the assignee to complete assigned onboarding", () => {
    expect(
      canCompleteClientOnboardingRequest("emp-1", false, {
        status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
        assignedEmployeeId: "emp-1",
      })
    ).toBe(true);
    expect(
      canCompleteClientOnboardingRequest("sa-1", true, {
        status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
        assignedEmployeeId: "emp-1",
      })
    ).toBe(false);
    expect(
      canCompleteClientOnboardingRequest("emp-2", false, {
        status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
        assignedEmployeeId: "emp-1",
      })
    ).toBe(false);
  });
});
