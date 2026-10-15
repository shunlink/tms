import "next-auth";
import "next-auth/jwt";

import type { PortalAccessJwtPayload } from "@/lib/superadmin/portal-access-session.service";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      clientId?: string | null;
      vendorId?: string | null;
      driverId?: string | null;
    };
    actor?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      role?: string;
    };
    portalAccess?: {
      sessionId: string;
      targetEmail: string | null;
    };
    portalAccessJwt?: PortalAccessJwtPayload | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    clientId?: string | null;
    vendorId?: string | null;
    driverId?: string | null;
    portalAccess?: PortalAccessJwtPayload | null;
  }
}
