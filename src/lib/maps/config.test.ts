import { describe, expect, it } from "vitest";
import { mapsProvider, isRoutingConfigured } from "./config";

describe("maps config HERE", () => {
  it("recognizes here provider and routing key", () => {
    const prevProvider = process.env.MAPS_PROVIDER;
    const prevKey = process.env.HERE_API_KEY;
    process.env.MAPS_PROVIDER = "here";
    process.env.HERE_API_KEY = "secret";
    expect(mapsProvider()).toBe("here");
    expect(isRoutingConfigured()).toBe(true);
    process.env.MAPS_PROVIDER = prevProvider;
    process.env.HERE_API_KEY = prevKey;
  });
});
