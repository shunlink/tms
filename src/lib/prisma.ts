import { PrismaClient } from "@prisma/client";
import { bumpDataVersion } from "./data-version";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const ROW_WRITE_ACTIONS = new Set(["create", "createMany", "update", "upsert", "delete"]);
const BULK_WRITE_ACTIONS = new Set(["updateMany", "deleteMany"]);

function createClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  client.$use(async (params, next) => {
    const result = await next(params);
    if (ROW_WRITE_ACTIONS.has(params.action)) {
      bumpDataVersion();
    } else if (BULK_WRITE_ACTIONS.has(params.action) && (result as { count?: number })?.count) {
      bumpDataVersion();
    }
    return result;
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
