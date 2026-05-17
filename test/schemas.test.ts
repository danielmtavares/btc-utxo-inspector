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

    expect(parsed.address).toBe("1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
    expect(parsed.chain_stats.funded_txo_sum).toBe(5250000000);
    expect(parsed.mempool_stats.tx_count).toBe(1);
  });

  it("parses live Blockstream address responses", () => {
    const parsed = BlockstreamAddressSchema.parse({
      address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      chain_stats: {
        funded_txo_count: 84,
        funded_txo_sum: 907923,
        spent_txo_count: 84,
        spent_txo_sum: 907923,
        tx_count: 146,
      },
      mempool_stats: {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 0,
      },
    });

    expect(parsed.address).toBe("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
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

  it("parses genesis coinbase transactions", () => {
    const parsed = BlockstreamTxSchema.parse({
      txid: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      version: 1,
      locktime: 0,
      vin: [
        {
          txid: "0000000000000000000000000000000000000000000000000000000000000000",
          vout: 4294967295,
          prevout: null,
          scriptsig:
            "04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73",
          scriptsig_asm:
            "OP_PUSHBYTES_4 ffff001d OP_PUSHBYTES_1 04 OP_PUSHBYTES_69 5468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73",
          is_coinbase: true,
          sequence: 4294967295,
        },
      ],
      vout: [
        {
          scriptpubkey:
            "4104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac",
          scriptpubkey_asm:
            "OP_PUSHBYTES_65 04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f OP_CHECKSIG",
          scriptpubkey_type: "p2pk",
          value: 5000000000,
        },
      ],
      size: 204,
      weight: 816,
      fee: 0,
      status: {
        confirmed: true,
        block_height: 0,
        block_hash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
        block_time: 1231006505,
      },
    });

    expect(parsed.status.block_height).toBe(0);
    expect(parsed.vin[0]?.is_coinbase).toBe(true);
  });
});
