import { describe, expect, it } from "vitest";
import { computeConnectionStatus } from "./useConnectionStatus";

describe("computeConnectionStatus", () => {
  it("e' unconfigured se mancano URL/key, indipendentemente dal resto", () => {
    expect(computeConnectionStatus(false, true, true)).toBe("unconfigured");
    expect(computeConnectionStatus(false, false, false)).toBe("unconfigured");
  });

  it("e' offline se configurato ma senza connessione Internet", () => {
    expect(computeConnectionStatus(true, false, true)).toBe("offline");
    expect(computeConnectionStatus(true, false, false)).toBe("offline");
  });

  it("e' error se configurato, online, ma il DB non risponde", () => {
    expect(computeConnectionStatus(true, true, false)).toBe("error");
  });

  it("e' online se configurato, online e il DB risponde", () => {
    expect(computeConnectionStatus(true, true, true)).toBe("online");
  });
});
