import { readJsonBody, resolveApiError } from "@/lib/api-client";
import { normalizeVendorDeliveryZones } from "@/lib/delivery-zones";
import { SIGNUP_LOCKED_PROFILE_FIELDS } from "@/lib/portal-access";

export async function savePortalProfileDraft(
  values: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const { tdsApplicable, deliveryZones: deliveryZonesCsv, ...rest } = values;
  const payload = Object.fromEntries(
    Object.entries(rest).filter(
      ([k]) => !SIGNUP_LOCKED_PROFILE_FIELDS.includes(k as (typeof SIGNUP_LOCKED_PROFILE_FIELDS)[number])
    )
  );
  const body: Record<string, unknown> = { ...payload };
  if (body.businessType === "") body.businessType = null;
  if (tdsApplicable !== undefined) {
    body.tdsApplicable = tdsApplicable === "true";
  }
  if (deliveryZonesCsv !== undefined) {
    const parsed = deliveryZonesCsv
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean);
    body.deliveryZones = normalizeVendorDeliveryZones(parsed);
  }

  const res = await fetch("/api/portal/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJsonBody(res);
  if (!res.ok) {
    return {
      ok: false,
      error: resolveApiError(res, data, "Failed to save your details").message,
    };
  }
  return { ok: true };
}
