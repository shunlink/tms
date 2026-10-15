import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { lookupVehicleByRegistration } from "@/lib/services/vehicle.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.view");
  if (denied) return denied;

  try {
    const registrationNumber = new URL(req.url).searchParams.get("registrationNumber");
    if (!registrationNumber?.trim()) {
      return badRequest("Vehicle registration number is required");
    }

    const vehicle = await lookupVehicleByRegistration(registrationNumber);
    if (!vehicle) {
      return ok({ found: false, message: "Vehicle not found" }, 404);
    }

    return ok({ found: true, vehicle });
  } catch (e) {
    return serverError(e);
  }
}
