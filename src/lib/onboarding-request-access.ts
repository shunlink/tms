import { ONBOARDING_CASE_STATUS } from "./onboarding-case-status";

export const CLIENT_ONBOARDING_REQUEST_QUEUE_STATUSES = [
  ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
  ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
  ONBOARDING_CASE_STATUS.PENDING_OPS_ONBOARDING,
] as const;

export type ClientOnboardingRequestCase = {
  status: string;
  assignedEmployeeId: string | null;
};

export function isOnboardingRequestsSuperAdmin(role: string | null | undefined) {
  return role === "SUPER_ADMIN";
}

export function canAssignClientOnboardingRequests(role: string | null | undefined) {
  return isOnboardingRequestsSuperAdmin(role);
}

function isAssignedToUser(userId: string, case_: ClientOnboardingRequestCase) {
  return (
    case_.status === ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE &&
    case_.assignedEmployeeId === userId
  );
}

export function canAccessClientOnboardingRequest(
  userId: string,
  isSuperAdmin: boolean,
  case_: ClientOnboardingRequestCase | null | undefined
) {
  if (!case_) return false;
  if (
    !CLIENT_ONBOARDING_REQUEST_QUEUE_STATUSES.includes(
      case_.status as (typeof CLIENT_ONBOARDING_REQUEST_QUEUE_STATUSES)[number]
    )
  ) {
    return false;
  }
  if (isSuperAdmin) return true;
  return isAssignedToUser(userId, case_);
}

export function canCompleteClientOnboardingRequest(
  userId: string,
  _isSuperAdmin: boolean,
  case_: ClientOnboardingRequestCase | null | undefined
) {
  if (!case_) return false;
  if (case_.status === ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION) {
    return false;
  }
  const assigneeCompletable =
    case_.status === ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE ||
    case_.status === ONBOARDING_CASE_STATUS.PENDING_OPS_ONBOARDING;
  if (!assigneeCompletable) return false;
  return case_.assignedEmployeeId === userId;
}
