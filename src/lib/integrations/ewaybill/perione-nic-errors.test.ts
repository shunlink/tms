import { describe, expect, it } from "vitest";
import { extractNicEwayErrorCodes, nicEwayErrorUserMessage } from "./perione-nic-errors";

describe("perione NIC error codes", () => {
  it("parses error 108 from production authenticate envelope", () => {
    const body = {
      status_cd: "0",
      status_desc: '{"errorCodes":"108"}',
      error: {
        message: '{"errorCodes":"108"}',
        error_cd: "0",
        errorCodes: "108",
      },
    };
    expect(extractNicEwayErrorCodes(body)).toContain("108");
    const msg = nicEwayErrorUserMessage(extractNicEwayErrorCodes(body), "Auth failed");
    expect(msg).toMatch(/108/);
    expect(msg).toMatch(/Perione GSP/i);
  });
});
