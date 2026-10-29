import { describe, expect, it } from "vitest";
import {
  buildChartSeries,
  deriveStandingFromEvents,
  extractEventsPayload,
  mergeAuctionEventRows,
  normalizeAuctionBid,
  normalizeEventList,
  parseAuctionBidsResponse,
} from "./auction-bids";

describe("auction bid payloads", () => {
  it("prefers recentEvents for chart data", () => {
    const data = {
      recentEvents: [
        { id: "e1", vendorName: "A", amount: 50000, placedAt: "2026-01-01T10:00:00Z" },
        { id: "e2", vendorName: "B", amount: 48000, placedAt: "2026-01-01T10:05:00Z" },
        { id: "e3", vendorName: "A", amount: 47000, placedAt: "2026-01-01T10:10:00Z" },
      ],
      standingBids: [
        { id: "s1", vendorName: "A", amount: 47000, placedAt: "2026-01-01T10:10:00Z" },
        { id: "s2", vendorName: "B", amount: 48000, placedAt: "2026-01-01T10:05:00Z" },
      ],
    };
    const events = normalizeEventList(extractEventsPayload(data));
    expect(events).toHaveLength(3);
    const chart = buildChartSeries(events);
    expect(chart).toHaveLength(3);
    expect(chart[0].amount).toBe(50000);

    const parsed = parseAuctionBidsResponse({
      ...data,
      requirementStatus: "AUCTION_LIVE",
      routeSummary: "Pune → Mumbai",
      clientCompany: "Acme",
    });
    expect(parsed.events).toHaveLength(3);
    expect(parsed.standing).toHaveLength(2);
    expect(parsed.meta.requirementStatus).toBe("AUCTION_LIVE");
    expect(parsed.standing[0].vendorName).toBe("A");
    expect(parsed.standing[0].amount).toBe(47000);
  });

  it("derives standing by vendorCompanyId when names collide", () => {
    const data = {
      recentEvents: [
        {
          eventId: "e1",
          id: "b1",
          vendorCompanyId: "c1",
          vendorName: "Acme",
          bidAmount: 100,
          occurredAt: "2026-01-01T10:00:00Z",
        },
        {
          eventId: "e2",
          id: "b2",
          vendorCompanyId: "c2",
          vendorName: "Acme",
          bidAmount: 90,
          occurredAt: "2026-01-01T10:01:00Z",
        },
      ],
    };
    const parsed = parseAuctionBidsResponse(data);
    expect(parsed.standing).toHaveLength(2);
    expect(parsed.standing[0].amount).toBe(90);
  });

  it("derives standing from events when standingBids missing", () => {
    const data = {
      recentEvents: [
        { id: "e1", vendorName: "Vendor X", amount: 100, placedAt: "2026-01-01T10:00:00Z" },
        { id: "e2", vendorName: "Vendor X", amount: 90, placedAt: "2026-01-01T10:01:00Z" },
        { id: "e3", vendorName: "Vendor Y", amount: 95, placedAt: "2026-01-01T10:02:00Z" },
      ],
    };
    const parsed = parseAuctionBidsResponse(data);
    expect(parsed.standing).toHaveLength(2);
    expect(parsed.standing[0].amount).toBe(90);
    expect(parsed.standing[1].amount).toBe(95);
  });

  it("merges API history and Pusher without duplicating the same drop", () => {
    const fromApi = normalizeAuctionBid({
      eventId: "evt-64800",
      id: "bid-north",
      vendorCompanyId: "co-north",
      vendorName: "North Star Logistics",
      bidAmount: 64800,
      occurredAt: "2026-10-27T18:51:41.000Z",
    });
    const fromPusher = normalizeAuctionBid({
      id: "bid-north",
      vendorCompanyId: "co-north",
      vendorName: "North Star Logistics",
      bidAmount: 64800,
      occurredAt: "2026-10-27T18:51:41.000Z",
    });
    expect(fromApi).not.toBeNull();
    expect(fromPusher).not.toBeNull();
    const merged = mergeAuctionEventRows([], [fromApi!, fromPusher!]);
    expect(merged).toHaveLength(1);
  });

  it("deriveStandingFromEvents picks lowest per vendor", () => {
    const events = normalizeEventList([
      { vendorName: "A", amount: 100, placedAt: "2026-01-01T10:00:00Z" },
      { vendorName: "A", amount: 80, placedAt: "2026-01-01T10:01:00Z" },
    ]);
    const standing = deriveStandingFromEvents(events);
    expect(standing).toHaveLength(1);
    expect(standing[0].amount).toBe(80);
  });
});
