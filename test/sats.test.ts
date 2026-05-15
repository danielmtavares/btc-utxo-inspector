import { describe, expect, it } from "vitest";
import { btcToSats, formatBtcAmount, formatSatsAmount, satsToBtcString } from "../src/utils/sats.js";

describe("sats helpers", () => {
  it("converts sats to btc strings", () => {
    expect(satsToBtcString(0n)).toBe("0");
    expect(satsToBtcString(1n)).toBe("0.00000001");
    expect(satsToBtcString(123456789n)).toBe("1.23456789");
  });

  it("formats btc and sats amounts", () => {
    expect(formatBtcAmount(100000000n)).toBe("1 BTC");
    expect(formatSatsAmount(123456789n)).toBe("123,456,789 sats");
  });

  it("converts btc strings to sats", () => {
    expect(btcToSats("0")).toBe(0n);
    expect(btcToSats("1")).toBe(100000000n);
    expect(btcToSats("1.23456789")).toBe(123456789n);
  });
});

