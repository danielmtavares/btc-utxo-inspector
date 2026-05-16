import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { inspectAddressCommand } from "../src/commands/address.js";
import { inspectTransactionCommand } from "../src/commands/tx.js";
import { createExplorerClient } from "../src/api/provider.js";

function loadFixture(name: string): unknown {
  const fileUrl = new URL(`./fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileUrl, "utf8")) as unknown;
}

function createJsonResponse(body: unknown): Response {
  const headers = new Headers();
  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(body), {
    headers,
    status: 200,
  });
}

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

function createFixtureFetch() {
  const addressFixture = loadFixture("address.json");
  const utxosFixture = loadFixture("utxos.json");
  const transactionFixture = loadFixture("tx.json");

  return vi.fn<typeof fetch>(input => {
    const url = getRequestUrl(input);

    if (url.endsWith("/address/1BoatSLRHtKNngkdXEeobR76b53LETtpyT")) {
      return Promise.resolve(createJsonResponse(addressFixture));
    }

    if (url.endsWith("/address/1BoatSLRHtKNngkdXEeobR76b53LETtpyT/utxo")) {
      return Promise.resolve(createJsonResponse(utxosFixture));
    }

    if (url.endsWith("/tx/2222222222222222222222222222222222222222222222222222222222222222")) {
      return Promise.resolve(createJsonResponse(transactionFixture));
    }

    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("mocked integration", () => {
  it("flows from address command through the provider using fixture-backed responses", async () => {
    const fetchMock = createFixtureFetch();

    const result = await inspectAddressCommand(
      {
        address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
        source: "blockstream",
        apiUrl: "https://example.test/api",
        page: 1,
        limit: 1,
      },
      {
        createClient: () => createExplorerClient({
          source: "blockstream",
          baseUrl: "https://example.test/api",
          fetch: fetchMock,
        }),
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      network: "mainnet",
      addressType: "p2pkh",
      balance: {
        btc: "42.5 BTC",
        sats: "4,250,000,000 sats",
        valueSats: 4250000000n,
      },
    });
    expect(result.utxos.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
    expect(result.utxos.items[0]?.outpoint).toBe(
      "1111111111111111111111111111111111111111111111111111111111111111:0",
    );
  });

  it("flows from tx command through the provider using fixture-backed responses", async () => {
    const fetchMock = createFixtureFetch();

    const result = await inspectTransactionCommand(
      {
        txid: "2222222222222222222222222222222222222222222222222222222222222222",
        source: "blockstream",
        apiUrl: "https://example.test/api",
        page: 1,
        limit: 1,
      },
      {
        createClient: () => createExplorerClient({
          source: "blockstream",
          baseUrl: "https://example.test/api",
          fetch: fetchMock,
        }),
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      txid: "2222222222222222222222222222222222222222222222222222222222222222",
      confirmationStatus: "confirmed",
      totalOutput: {
        btc: "49.999 BTC",
        sats: "4,999,900,000 sats",
        valueSats: 4999900000n,
      },
      fee: {
        btc: "0.001 BTC",
        sats: "100,000 sats",
        valueSats: 100000n,
      },
    });
    expect(result.inputs.pagination.limit).toBe(1);
    expect(result.inputs.items[0]?.prevout?.scriptAddress).toBe(
      "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
    );
  });
});
