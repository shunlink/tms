import { prisma } from "./prisma";

export class CellTowerNotFoundError extends Error {
  readonly mcc: number;
  readonly mnc: number;
  readonly lac: number;
  readonly cellId: string;

  constructor(mcc: number, mnc: number, lac: number, cellId: bigint) {
    super(`No cell tower coordinates for mcc=${mcc} mnc=${mnc} lac=${lac} cellId=${cellId.toString()}`);
    this.name = "CellTowerNotFoundError";
    this.mcc = mcc;
    this.mnc = mnc;
    this.lac = lac;
    this.cellId = cellId.toString();
  }
}

export function toCellIdBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) {
    throw new Error("cellId must be a non-negative integer");
  }
  return BigInt(s);
}

/** Resolve approximate lat/lng from local OpenCelliD data (see Phase 5 ingest). */
export async function resolveCellTower(
  mcc: number,
  mnc: number,
  lac: number,
  cellId: bigint | number | string
): Promise<{ lat: number; lng: number }> {
  const cellIdBig = toCellIdBigInt(cellId);
  const row = await prisma.cellTower.findUnique({
    where: {
      mcc_mnc_lac_cellId: { mcc, mnc, lac, cellId: cellIdBig },
    },
    select: { lat: true, lng: true },
  });
  if (!row) {
    throw new CellTowerNotFoundError(mcc, mnc, lac, cellIdBig);
  }
  return { lat: row.lat, lng: row.lng };
}
