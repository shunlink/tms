import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { suggestVehiclesByRegistrationPrefix } from "@/lib/services/vehicle.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.view");
  if (denied) return denied;

  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const suggestions = await suggestVehiclesByRegistrationPrefix(q, 5);
    return ok({
      suggestions: suggestions.map((v) => ({
        id: v.id,
        value: v.registrationNumber,
        label: [v.registrationNumber, v.vehicleTypeCode.replace(/_/g, " "), [v.make, v.model].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(" · "),
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}
