import { NextResponse } from "next/server";
import { authorize, requireAuth } from "@/lib/api";
import { getActorSessionUser } from "@/lib/auth";
import {
  getCompanySettingsFormState,
  updateCompanySettings,
  type CompanySettingsFormState,
} from "@/lib/services/company-settings.service";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;
  const settings = await getCompanySettingsFormState();
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const actor = await getActorSessionUser();
  if (!actor || actor.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json()) as Partial<CompanySettingsFormState>;
  const profile = await updateCompanySettings(body, actor);
  const settings = await getCompanySettingsFormState();
  return NextResponse.json({ profile, settings });
}
