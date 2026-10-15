import { prisma } from "./prisma";

/**
 * Resolves `LookupCatalog` codes to their human display labels, so messages show
 * "17 ft Truck" rather than "TRUCK_17FT". Keys are "<CATEGORY>:<CODE>".
 */
export async function resolveLookupLabels(
  entries: Array<[category: string, code: string | null | undefined]>
): Promise<Map<string, string>> {
  const wanted = entries.filter((e): e is [string, string] => !!e[1]);
  if (wanted.length === 0) return new Map<string, string>();

  const rows = await prisma.lookupCatalog.findMany({
    where: { OR: wanted.map(([category, code]) => ({ category, code })) },
    select: { category: true, code: true, label: true },
  });
  return new Map(rows.map((r) => [`${r.category}:${r.code}`, r.label]));
}

/** Label for one code, falling back to the raw code when the lookup is missing. */
export function labelOf(
  labels: Map<string, string>,
  category: string,
  code?: string | null
): string | null {
  if (!code) return null;
  return labels.get(`${category}:${code}`) ?? code;
}
