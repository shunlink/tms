import { describe, expect, it } from "vitest";
import { resolveReconciliationRecord } from "./reconciliation.service";

describe("resolveReconciliationRecord", () => {
  it("rejects MATCHED without evidence", async () => {
    await expect(
      resolveReconciliationRecord("fake-id", { status: "MATCHED" }, null)
    ).rejects.toThrow(/evidence/);
  });
});
