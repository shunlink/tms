import type { PermissionKey } from "./permissions";

export type RouteExtensionRule = {
  pattern: RegExp;
  permission?: PermissionKey;
  permissionsAny?: PermissionKey[];
  superAdminOnly?: boolean;
  /** Also enforce nav item gates (team menu + roles[]) for this href. */
  navHref?: string;
};

/** Checked before nav prefix matching; first match wins. */
export const ROUTE_EXTENSION_RULES: RouteExtensionRule[] = [
  { pattern: /^\/settings\/security(?:\/|$)/, superAdminOnly: true },
  { pattern: /^\/indents\/new(?:\/|$)/, permission: "indent.create", navHref: "/indents" },
  { pattern: /^\/trips\/new(?:\/|$)/, permission: "trip.view", navHref: "/trips" },
  { pattern: /^\/invoices\/new(?:\/|$)/, permission: "invoice.create", navHref: "/invoices" },
  { pattern: /^\/requirements\/new(?:\/|$)/, permission: "requirement.create", navHref: "/requirements" },
  { pattern: /^\/clients\/new(?:\/|$)/, permission: "client.edit", navHref: "/clients" },
  { pattern: /^\/clients\/[^/]+\/edit(?:\/|$)/, permission: "client.edit", navHref: "/clients" },
  { pattern: /^\/vendors\/new(?:\/|$)/, permission: "vendor.edit", navHref: "/vendors" },
  { pattern: /^\/vendors\/[^/]+\/edit(?:\/|$)/, permission: "vendor.edit", navHref: "/vendors" },
  { pattern: /^\/vehicles\/new(?:\/|$)/, permission: "vehicle.edit", navHref: "/vehicles" },
  { pattern: /^\/vehicles\/[^/]+\/edit(?:\/|$)/, permission: "vehicle.edit", navHref: "/vehicles" },
  { pattern: /^\/drivers\/new(?:\/|$)/, permission: "driver.create", navHref: "/drivers" },
  { pattern: /^\/finance\/trips\/[^/]+(?:\/|$)/, permissionsAny: ["payment.view", "invoice.view"] },
  { pattern: /^\/advance-payments(?:\/|$)/, permission: "advance.view" },
  { pattern: /^\/balance-payments(?:\/|$)/, permission: "payment.view" },
  { pattern: /^\/outbound-payments(?:\/|$)/, permission: "payment.view" },
  { pattern: /^\/accounting\/chart-of-accounts(?:\/|$)/, permission: "accounting.coa.view" },
  { pattern: /^\/accounting\/reconciliation(?:\/|$)/, permission: "accounting.reconcile.view" },
  { pattern: /^\/bidding-management(?:\/|$)/, permission: "dashboard.view" },
  { pattern: /^\/permissions(?:\/|$)/, permission: "dashboard.view" },
];
