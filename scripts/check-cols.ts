import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) AS cols FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('User','OnboardingCase','AuditLog','RolePermission','Vendor','Client') GROUP BY table_name ORDER BY table_name"
  ) as { table_name: string; cols: string }[];
  for (const r of rows) console.log(r.table_name, "=>", r.cols);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
