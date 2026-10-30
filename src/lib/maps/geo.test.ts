import { describe, expect, it } from "vitest";
import {
  hasStartedMainRoute,
  hasStartedMainRouteOnPoints,
  PICKUP_REACHED_RADIUS_M,
} from "./geo";

describe("hasStartedMainRoute", () => {
  const origin = { lat: 19.076, lng: 72.8777 };
  const destination = { lat: 21.1458, lng: 79.0882 };
  const plannedM = 795_000;

  function straightRoute(steps = 24) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        lat: origin.lat + t * (destination.lat - origin.lat),
        lng: origin.lng + t * (destination.lng - origin.lng),
      });
    }
    return pts;
  }

  it("returns true at pickup geofence", () => {
    expect(hasStartedMainRoute(origin, origin, destination, plannedM, [])).toBe(true);
  });

  it("returns false when near drop but far from pickup (pre-pickup B→C)", () => {
    const current = { lat: 21.12, lng: 79.05 };
    expect(hasStartedMainRoute(current, origin, destination, plannedM, [])).toBe(false);
  });

  it("returns false when approaching pickup on corridor (Nashik-like)", () => {
    const current = { lat: 20.015, lng: 73.753 };
    const route = straightRoute();
    expect(hasStartedMainRouteOnPoints(current, origin, destination, plannedM, route)).toBe(false);
  });

  it("returns true when well past pickup on planned route", () => {
    const route = straightRoute();
    const current = {
      lat: origin.lat + 0.55 * (destination.lat - origin.lat),
      lng: origin.lng + 0.55 * (destination.lng - origin.lng),
    };
    expect(hasStartedMainRouteOnPoints(current, origin, destination, plannedM, route)).toBe(
      true
    );
  });

  it("uses pickup radius constant", () => {
    expect(PICKUP_REACHED_RADIUS_M).toBe(4_000);
  });
});
