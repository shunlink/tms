import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { sendDriverOtp } from "@/lib/services/driver.service";
import { headers } from "next/headers";

function clientIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.verify");
  if (denied) return denied;
  try {
    const result = await sendDriverOtp(params.id, clientIp());
    return ok({ ...result, message: "OTP sent successfully." });
  } catch (e) {
    return serverError(e);
  }
}
