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
    return straightRouteBetween(origin, destination, steps);
  }

  function straightRouteBetween(from: { lat: number; lng: number }, to: { lat: number; lng: number }, steps = 24) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        lat: from.lat + t * (to.lat - from.lat),
        lng: from.lng + t * (to.lng - from.lng),
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

  it("returns false when on corridor but closer to drop than pickup (Nagpur-like)", () => {
    const pickup = { lat: 13.0827, lng: 80.2707 };
    const drop = { lat: 21.1702, lng: 72.8311 };
    const current = { lat: 21.1458, lng: 79.0882 };
    const route = straightRouteBetween(pickup, drop);
    const plannedM = 1_673_400;
    expect(
      hasStartedMainRouteOnPoints(current, pickup, drop, plannedM, route)
    ).toBe(false);
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
