import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapTrackingPingDto, listTripTrackingPings, getTripForClient, getTripForVendor } from "./tracking.service";

vi.mock("../prisma", () => ({
  prisma: {
    trackingPing: {
      findMany: vi.fn(),
    },
    trip: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import type { TrackingPing, Trip } from "@prisma/client";

describe("mapTrackingPingDto", () => {
  it("maps ping fields to API shape", () => {
    const at = new Date("2026-01-15T10:30:00.000Z");
    const dto = mapTrackingPingDto({
      id: "p1",
      lat: 18.5,
      lng: 73.8,
      source: "GPS",
      accuracyMeters: 12,
      note: "On highway",
      recordedAt: at,
    });
    expect(dto.id).toBe("p1");
    expect(dto.recordedAt).toBe(at.toISOString());
    expect(dto.createdAt).toBe(at.toISOString());
  });
});

describe("portal trip visibility helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTripForClient scopes by clientId", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({
      id: "t1",
      clientId: "c1",
      status: "IN_TRANSIT",
    } as Trip);
    const row = await getTripForClient("c1", "t1");
    expect(row?.id).toBe("t1");
    expect(prisma.trip.findFirst).toHaveBeenCalledWith({
      where: { id: "t1", clientId: "c1" },
      select: { id: true, clientId: true, status: true },
    });
  });

  it("getTripForVendor scopes by vendorId", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({
      id: "t1",
      vendorId: "v1",
      status: "IN_TRANSIT",
    } as Trip);
    const row = await getTripForVendor("v1", "t1");
    expect(row?.id).toBe("t1");
    expect(prisma.trip.findFirst).toHaveBeenCalledWith({
      where: { id: "t1", vendorId: "v1" },
      select: { id: true, vendorId: true, status: true },
    });
  });

  it("getTripForClient returns null when trip belongs to another client", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null);
    const row = await getTripForClient("c-other", "t1");
    expect(row).toBeNull();
  });
});

describe("listTripTrackingPings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries by tripId descending", async () => {
    const at = new Date();
    vi.mocked(prisma.trackingPing.findMany).mockResolvedValue([
      {
        id: "p1",
        lat: 1,
        lng: 2,
        source: "GPS",
        accuracyMeters: null,
        note: null,
        recordedAt: at,
        driverId: null,
        indentId: null,
        tripId: "trip-1",
        provider: null,
      } as TrackingPing,
    ]);
    const rows = await listTripTrackingPings("trip-1", 50);
    expect(rows).toHaveLength(1);
    expect(prisma.trackingPing.findMany).toHaveBeenCalledWith({
      where: { tripId: "trip-1" },
      orderBy: { recordedAt: "desc" },
      take: 50,
    });
  });
});
