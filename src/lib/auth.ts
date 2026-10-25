import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./ratelimit";
import { normalizeDl } from "./otp";
import { verifyDriverOtpSecure } from "./services/otp.service";
import type { PortalAccessJwtPayload } from "./superadmin/portal-access-session.service";
import {
  LOGIN_PORTAL_MISMATCH_MESSAGE,
  type LoginPortal,
  roleMatchesLoginPortal,
} from "./login-portal";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email / DL / Phone", type: "text" },
        password: { label: "Password / OTP", type: "password" },
        driverLogin: { label: "Driver Login", type: "text" },
        loginPortal: { label: "Login Portal", type: "text" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.email ?? "").trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!identifier || !password) return null;

        const rl = rateLimit(`login:${identifier}`, 8, 5 * 60_000);
        if (!rl.ok) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        // Driver OTP login: identity is the DL number (canonical), OTP proves
        // possession of the registered phone. Phone is NOT a unique key.
        if (credentials?.driverLogin === "1" || credentials?.driverLogin === "true") {
          const dlNumber = normalizeDl(credentials?.email ?? "");
          const driver = await prisma.driver.findUnique({
            where: { dlNumber },
            include: { users: { take: 1 } },
          });
          if (!driver) return null;

          try {
            await verifyDriverOtpSecure({
              driverId: driver.id,
              otp: password,
              purpose: "driver_login",
            });
          } catch {
            return null;
          }

          let user = driver.users[0];
          if (!user) {
            user = await prisma.user.create({
              data: {
                name: driver.name,
                password: await bcrypt.hash(require("crypto").randomUUID(), 10),
                role: "DRIVER",
                driverId: driver.id,
              },
            });
          } else if (!user.isActive) {
            return null;
          }

          const loginPortal = credentials?.loginPortal as LoginPortal | undefined;
          if (loginPortal && !roleMatchesLoginPortal(user.role, loginPortal)) {
            throw new Error(LOGIN_PORTAL_MISMATCH_MESSAGE);
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clientId: user.clientId,
            vendorId: user.vendorId,
            driverId: user.driverId,
          };
        }

        // Staff / client / vendor login: email or phone + password.
        const looksLikePhone = /^\+?[\d\s-]{6,}$/.test(identifier);
        const user = looksLikePhone
          ? await prisma.user.findUnique({ where: { phone: identifier } })
          : await prisma.user.findUnique({ where: { email: identifier } });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        const loginPortal = credentials?.loginPortal as LoginPortal | undefined;
        if (loginPortal && !roleMatchesLoginPortal(user.role, loginPortal)) {
          throw new Error(LOGIN_PORTAL_MISMATCH_MESSAGE);
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId,
          vendorId: user.vendorId,
          driverId: user.driverId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          role?: string;
          clientId?: string | null;
          vendorId?: string | null;
          driverId?: string | null;
        };
        token.role = u.role;
        token.clientId = u.clientId ?? null;
        token.vendorId = u.vendorId ?? null;
        token.driverId = u.driverId ?? null;
        token.portalAccess = null;
      }

      if (trigger === "update" && session) {
        const s = session as {
          portalAccess?: PortalAccessJwtPayload | null;
          clearPortalAccess?: boolean;
        };
        if (s.clearPortalAccess) {
          token.portalAccess = null;
        } else if (s.portalAccess) {
          token.portalAccess = s.portalAccess;
        }
      }

      const pa = token.portalAccess as PortalAccessJwtPayload | null | undefined;
      if (pa?.expiresAt && pa.expiresAt <= Date.now()) {
        token.portalAccess = null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const actorRole = token.role as string;
        const pa = token.portalAccess as PortalAccessJwtPayload | null | undefined;
        const impersonating = pa && pa.expiresAt > Date.now();

        const u = session.user as SessionUser;
        if (impersonating && pa) {
          u.id = pa.targetUserId;
          u.role = pa.targetRole;
          u.email = pa.targetEmail;
          u.name = pa.targetName;
          u.clientId = pa.targetClientId ?? null;
          u.vendorId = pa.targetVendorId ?? null;
          u.driverId = pa.targetDriverId ?? null;
        } else {
          u.role = actorRole;
          u.clientId = (token.clientId as string | null) ?? null;
          u.vendorId = (token.vendorId as string | null) ?? null;
          u.driverId = (token.driverId as string | null) ?? null;
          u.id = token.sub;
        }

        (session as { actor?: SessionUser }).actor = {
          id: token.sub,
          role: actorRole,
          email: (token.email as string | null) ?? null,
          name: (token.name as string | null) ?? null,
          clientId: (token.clientId as string | null) ?? null,
          vendorId: (token.vendorId as string | null) ?? null,
          driverId: (token.driverId as string | null) ?? null,
        };

        (session as { portalAccessJwt?: PortalAccessJwtPayload | null }).portalAccessJwt =
          impersonating ? pa : null;
        (session as { portalAccess?: { sessionId: string; targetEmail: string | null } }).portalAccess =
          impersonating && pa
            ? { sessionId: pa.sessionId, targetEmail: pa.targetEmail }
            : undefined;
      }
      return session;
    },
  },
};

export type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
  clientId?: string | null;
  vendorId?: string | null;
  driverId?: string | null;
  /** Present when Superadmin is viewing an employee portal. */
  actorId?: string;
  portalAccessSessionId?: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const { resolvePortalAccessFromSession } = await import("./auth-portal-access");
  const ctx = await resolvePortalAccessFromSession();
  if (!ctx) return null;

  const effective = ctx.effective;
  return {
    ...effective,
    actorId: ctx.actor.id,
    portalAccessSessionId: ctx.impersonation?.sessionId,
  };
}

/** Authenticated Superadmin (never the impersonated employee). */
export async function getActorSessionUser(): Promise<SessionUser | null> {
  const { getActorFromSession } = await import("./auth-portal-access");
  const actor = await getActorFromSession();
  return actor;
}

export { portalHomeForRole } from "./portal-access";
