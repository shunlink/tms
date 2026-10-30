import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("./trip-route.service", () => ({
  ensureTripRouteGeocoded: vi.fn().mockResolvedValue(undefined),
  getTripRouteSnapshot: vi.fn(),
}));

vi.mock("./tracking.service", () => ({
  listTripTrackingPings: vi.fn().mockResolvedValue([]),
}));

vi.mock("../maps/config", () => ({
  mapsProvider: vi.fn(() => "here"),
  isRoutingConfigured: vi.fn(() => true),
}));

import { getTripMapDisplay } from "./trip-map-display.service";
import { getTripRouteSnapshot } from "./trip-route.service";
import { listTripTrackingPings } from "./tracking.service";

describe("getTripMapDisplay", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.mocked(listTripTrackingPings).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aggregates planned and remaining routes when on main haul", async () => {
    vi.mocked(getTripRouteSnapshot).mockResolvedValue({
      tripId: "trip-1",
      routeFrom: "Mumbai",
      routeTo: "Delhi",
      origin: { lat: 19.0, lng: 72.0 },
      destination: { lat: 28.6, lng: 77.2 },
      currentLocation: { lat: 22.0, lng: 75.0 },
      lastPingAt: "2026-01-01T12:00:00.000Z",
      expectedEndAt: "2026-01-02T06:00:00.000Z",
      routeGeocodedAt: "2026-01-01T10:00:00.000Z",
      dispatchedAt: "2026-01-01T08:00:00.000Z",
    });
    vi.mocked(listTripTrackingPings).mockResolvedValue([
      {
        id: "p1",
        lat: 19.0,
        lng: 72.0,
        source: "GPS",
        recordedAt: "2026-01-01T12:00:00.000Z",
        createdAt: "2026-01-01T12:00:00.000Z",
      },
    ]);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [
                { polyline: "planned-poly", summary: { duration: 36000, length: 1400000 } },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [
                { polyline: "remaining-poly", summary: { duration: 7200, length: 250000 } },
              ],
            },
          ],
        }),
      });

    process.env.HERE_API_KEY = "test-key";

    const display = await getTripMapDisplay("trip-1");
    expect(display).not.toBeNull();
    expect(display!.plannedRoute?.polylines).toEqual(["planned-poly"]);
    expect(display!.remaining?.polylines).toEqual(["remaining-poly"]);
    expect(display!.remaining?.distanceMeters).toBe(250000);
    expect(display!.remaining?.onMainRoute).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses full pickup-drop distance while approaching pickup", async () => {
    vi.mocked(getTripRouteSnapshot).mockResolvedValue({
      tripId: "trip-3",
      routeFrom: "Mumbai",
      routeTo: "Nagpur",
      origin: { lat: 19.076, lng: 72.8777 },
      destination: { lat: 21.1458, lng: 79.0882 },
      currentLocation: { lat: 19.076, lng: 72.8777 },
      lastPingAt: null,
      expectedEndAt: null,
      routeGeocodedAt: null,
      dispatchedAt: null,
    });
    vi.mocked(listTripTrackingPings).mockResolvedValue([
      {
        id: "p1",
        lat: 19.25,
        lng: 72.65,
        source: "GPS",
        recordedAt: "2026-01-01T12:00:00.000Z",
        createdAt: "2026-01-01T12:00:00.000Z",
      },
    ]);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [
                { polyline: "planned-poly", summary: { duration: 36000, length: 788700 } },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [{ polyline: "approach-poly", summary: { duration: 3240, length: 21600 } }],
            },
          ],
        }),
      });

    const display = await getTripMapDisplay("trip-3");
    expect(display!.remaining?.onMainRoute).toBe(false);
    expect(display!.remaining?.distanceMeters).toBe(788700);
    expect(display!.remaining?.durationSeconds).toBe(36000);
    expect(display!.remaining?.polylines).toEqual(["planned-poly"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses full B→C remaining when ping is near drop but far from pickup", async () => {
    vi.mocked(getTripRouteSnapshot).mockResolvedValue({
      tripId: "trip-4",
      routeFrom: "Mumbai",
      routeTo: "Nagpur",
      origin: { lat: 19.076, lng: 72.8777 },
      destination: { lat: 21.1458, lng: 79.0882 },
      currentLocation: { lat: 21.12, lng: 79.05 },
      lastPingAt: null,
      expectedEndAt: null,
      routeGeocodedAt: null,
      dispatchedAt: null,
    });
    vi.mocked(listTripTrackingPings).mockResolvedValue([
      {
        id: "p1",
        lat: 21.12,
        lng: 79.05,
        source: "GPS",
        recordedAt: "2026-01-01T12:00:00.000Z",
        createdAt: "2026-01-01T12:00:00.000Z",
      },
    ]);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [
                { polyline: "planned-poly", summary: { duration: 36000, length: 795100 } },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [{ polyline: "approach-poly", summary: { duration: 3240, length: 21600 } }],
            },
          ],
        }),
      });

    const display = await getTripMapDisplay("trip-4");
    expect(display!.remaining?.onMainRoute).toBe(false);
    expect(display!.remaining?.distanceMeters).toBe(795100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("marks geocode incomplete when origin or destination missing", async () => {
    vi.mocked(getTripRouteSnapshot).mockResolvedValue({
      tripId: "trip-2",
      routeFrom: "Mumbai",
      routeTo: "Delhi",
      origin: null,
      destination: { lat: 28.6, lng: 77.2 },
      currentLocation: null,
      lastPingAt: null,
      expectedEndAt: null,
      routeGeocodedAt: null,
      dispatchedAt: null,
    });

    const display = await getTripMapDisplay("trip-2");
    expect(display?.geocodeIncomplete).toBe(true);
    expect(display?.plannedRoute).toBeNull();
  });
});
