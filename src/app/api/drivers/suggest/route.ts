import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { suggestDriversByDlPrefix } from "@/lib/services/driver.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.view");
  if (denied) return denied;

  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const suggestions = await suggestDriversByDlPrefix(q, 5);
    return ok({
      suggestions: suggestions.map((d) => ({
        id: d.id,
        value: d.dlNumber,
        label: [d.dlNumber, d.name, d.phone].filter(Boolean).join(" · "),
        name: d.name,
        phone: d.phone,
        deviceType: d.deviceType,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}
