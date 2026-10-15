import { Prisma } from "@prisma/client";

export type FormattedError = {
  status: number;
  message: string;
  isSchemaMismatch: boolean;
};

/** Map Prisma / DB errors to safe API responses */
export function formatPrismaError(e: unknown): FormattedError {
  const msg = e instanceof Error ? e.message : String(e);

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2021": // table does not exist
      case "P2022": // column does not exist
        return {
          status: 503,
          message: "Database schema is out of date. Run: npm run db:migrate",
          isSchemaMismatch: true,
        };
      case "P2002":
        return { status: 409, message: "A record with this value already exists", isSchemaMismatch: false };
      case "P2003":
        // Foreign-key violation — commonly a stale session writing an old user id.
        return {
          status: 409,
          message: "A linked record no longer exists — please sign out and sign in again.",
          isSchemaMismatch: false,
        };
      case "P2025":
        return { status: 404, message: "Record not found", isSchemaMismatch: false };
    }
  }

  // Stale Prisma client: code references a field the generated client doesn't know.
  if (msg.includes("Unknown argument")) {
    return {
      status: 503,
      message: "Database schema is out of date. Run: npm run db:migrate",
      isSchemaMismatch: true,
    };
  }

  return {
    status: 500,
    message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : msg,
    isSchemaMismatch: false,
  };
}

export function logQueryError(context: string, e: unknown) {
  const formatted = formatPrismaError(e);
  console.error(`[query:${context}]`, e);
  if (formatted.isSchemaMismatch) {
    console.error(`[query:${context}] Schema mismatch — run npm run db:migrate`);
  }
}
