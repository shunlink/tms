/**
 * Idempotent: upserts Permission rows, role templates, and default Access Role bundles.
 * Safe on production (does not delete users or business data).
 *
 *   npx tsx scripts/sync-permissions.ts
 *   docker compose exec app npx tsx scripts/sync-permissions.ts
 */
import { ensurePermissions } from "../src/lib/services/permission.service";

async function main() {
  await ensurePermissions();
  console.log("Permissions and default access role bundles synced.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
