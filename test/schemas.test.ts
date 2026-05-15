import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BlockstreamAddressSchema,
  BlockstreamTxSchema,
  BlockstreamUtxoSchema,
} from "../src/api/schemas.js";

function loadFixture(name: string): unknown {
  const fileUrl = new URL(`./fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileUrl, "utf8")) as unknown;
}

describe("blockstream schemas", () => {
  it("parses address stats", () => {
    const fixture = loadFixture("address.json");
    const parsed = BlockstreamAddressSchema.parse(fixture);

    expect(parsed.chain_stats.funded_txo_sum).toBe(5250000000);
    expect(parsed.mempool_stats.tx_count).toBe(1);
  });

  it("parses utxos", () => {
    const fixture = loadFixture("utxos.json");
    const parsed = BlockstreamUtxoSchema.array().parse(fixture);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.txid).toBe(
      "1111111111111111111111111111111111111111111111111111111111111111",
    );
  });

  it("parses tx details", () => {
    const fixture = loadFixture("tx.json");
    const parsed = BlockstreamTxSchema.parse(fixture);

    expect(parsed.txid).toBe("2222222222222222222222222222222222222222222222222222222222222222");
    expect(parsed.vin).toHaveLength(1);
    expect(parsed.vout).toHaveLength(1);
  });
});
