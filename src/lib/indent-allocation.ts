/**
 * Vendor allocation gate — single source of truth for "can this indent have a
 * vendor allocated right now?".
 *
 * BIDDING: only after the indent has been released to vendors.
 * MANUAL:  from the very start of the finance queue (Draft onwards). The user
 *          picks the vendor and rate by hand, so waiting for bidding/advance is
 *          unnecessary — the advance can still be recorded afterwards.
 *
 * Kept dependency-free (no Prisma/`server-only`) so it is safe to unit test.
 */

/** Statuses where a bid-winning quote can be converted into an allocation. */
export const ALLOCATABLE_STATUSES_BIDDING = [
  "RELEASED_TO_VENDORS",
  "QUOTING",
  "VENDOR_ALLOCATED",
  "PLACEMENT_PENDING",
] as const;

/**
 * Statuses where an operator may manually allocate a vendor. Includes every
 * pre-allocation status exposed by `setAllocationMode` (Draft … Advance paid)
 * so manual allocation never blocks with "cannot be allocated".
 */
export const ALLOCATABLE_STATUSES_MANUAL = [
  "DRAFT",
  "WAITING_FOR_ADVANCE",
  "ADVANCE_PENDING",
  "ADVANCE_PAID",
  ...ALLOCATABLE_STATUSES_BIDDING,
] as const;

/**
 * Whether a vendor may be allocated for an indent in `status` under the given
 * `allocationMode`. Unknown/legacy modes fall back to the stricter BIDDING set.
 */
export function isAllocatableStatus(
  allocationMode: string | null | undefined,
  status: string
): boolean {
  const allowed: readonly string[] =
    allocationMode === "MANUAL" ? ALLOCATABLE_STATUSES_MANUAL : ALLOCATABLE_STATUSES_BIDDING;
  return allowed.includes(status);
}
