import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createBlockstreamClient, DEFAULT_BLOCKSTREAM_API_URL } from "../src/api/blockstream.js";
import { createExplorerClient } from "../src/api/provider.js";
import { createHttpClient } from "../src/api/http.js";
import { NotFoundError, ProviderUnavailableError, ResponseValidationError } from "../src/utils/errors.js";

function loadFixture(name: string): unknown {
  const fileUrl = new URL(`./fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileUrl, "utf8")) as unknown;
}

function createJsonResponse(body: unknown, status = 200): Response {
  const headers = new Headers();
  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(body), {
    headers,
    status,
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

function createResolvedSleepMock() {
  return vi.fn<(milliseconds: number) => Promise<void>>(async () => {
    await Promise.resolve();
  });
}

function createStaticFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(() => Promise.resolve(createJsonResponse(body, status)));
}

function createAddressFetch(addressFixture: unknown, utxosFixture: unknown) {
  return vi.fn<typeof fetch>(input => {
    const url = getRequestUrl(input);

    if (url.endsWith("/address/1BoatSLRHtKNngkdXEeobR76b53LETtpyT")) {
      return Promise.resolve(createJsonResponse(addressFixture));
    }

    if (url.endsWith("/address/1BoatSLRHtKNngkdXEeobR76b53LETtpyT/utxo")) {
      return Promise.resolve(createJsonResponse(utxosFixture));
    }

    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("blockstream client", () => {
  it("normalizes address summaries and paginates utxos", async () => {
    const addressFixture = loadFixture("address.json");
    const utxosFixture = loadFixture("utxos.json");
    const fetchMock = createAddressFetch(addressFixture, utxosFixture);
    const client = createBlockstreamClient({
      fetch: fetchMock,
    });
    const summary = await client.getAddressSummary({
      address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      addressType: "p2pkh",
      pagination: {
        page: 1,
        limit: 1,
      },
    });

    expect(summary.network).toBe("mainnet");
    expect(summary.totalReceivedSats).toBe(5500000000n);
    expect(summary.totalSpentSats).toBe(1250000000n);
    expect(summary.balanceSats).toBe(4250000000n);
    expect(summary.utxos.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
    expect(summary.utxos.items[0]).toMatchObject({
      txid: "1111111111111111111111111111111111111111111111111111111111111111",
      vout: 0,
      scriptPubKeyType: "p2pkh",
      scriptPubKeyAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
    });
  });

  it("normalizes transaction summaries", async () => {
    const txFixture = loadFixture("tx.json");
    const fetchMock = createStaticFetch(txFixture);
    const client = createBlockstreamClient({
      fetch: fetchMock,
    });
    const summary = await client.getTransactionSummary({
      txid: "2222222222222222222222222222222222222222222222222222222222222222",
      pagination: {
        page: 1,
        limit: 10,
      },
    });

    expect(summary.txid).toBe("2222222222222222222222222222222222222222222222222222222222222222");
    expect(summary.totalInputSats).toBe(5000000000n);
    expect(summary.totalOutputSats).toBe(4999900000n);
    expect(summary.feeSats).toBe(100000n);
    expect(summary.timestamp).toBe("2023-11-14T22:30:00.000Z");
    expect(summary.inputs.items[0]?.prevout).toMatchObject({
      scriptPubKeyType: "p2pkh",
      scriptPubKeyAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
    });
    expect(summary.outputs.items[0]).toMatchObject({
      scriptPubKeyType: "p2wpkh",
      scriptPubKeyAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080",
    });
  });

  it("uses the configured base URL through the provider factory", async () => {
    const fetchMock = createStaticFetch(loadFixture("tx.json"));
    const client = createExplorerClient({
      baseUrl: "https://example.test/esplora",
      fetch: fetchMock,
    });

    await client.getTransactionSummary({
      txid: "2222222222222222222222222222222222222222222222222222222222222222",
      pagination: {
        page: 1,
        limit: 1,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/esplora/tx/2222222222222222222222222222222222222222222222222222222222222222",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("rejects unsupported explorer sources", () => {
    expect(() =>
      createExplorerClient({
        source: "mempool" as never,
      }),
    ).toThrow("Unsupported explorer source: mempool");
  });

  it("surfaces validation failures from malformed provider responses", async () => {
    const fetchMock = createStaticFetch({ nope: true });
    const client = createBlockstreamClient({
      fetch: fetchMock,
    });

    await expect(
      client.getTransactionSummary({
        txid: "bad",
        pagination: {
          page: 1,
          limit: 1,
        },
      }),
    ).rejects.toBeInstanceOf(ResponseValidationError);
  });
});

describe("http client", () => {
  it("raises response validation failures for invalid json responses", async () => {
    const headers = new Headers();
    headers.set("content-type", "application/json");
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response("not-json", {
          headers,
          status: 200,
        }),
      ),
    );
    const sleepMock = createResolvedSleepMock();
    const client = createHttpClient({
      fetch: fetchMock,
      sleep: sleepMock,
    });

    await expect(
      client.requestJson({
        source: "blockstream",
        baseUrl: DEFAULT_BLOCKSTREAM_API_URL,
        path: "/tx/not-json",
      }),
    ).rejects.toBeInstanceOf(ResponseValidationError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("retries retryable 5xx failures with exponential backoff", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ error: "temporary" }, 503))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }));
    const sleepMock = createResolvedSleepMock();
    const client = createHttpClient({
      fetch: fetchMock,
      sleep: sleepMock,
      maxAttempts: 3,
      initialBackoffMs: 250,
    });

    const response = await client.requestJson({
      source: "blockstream",
      baseUrl: DEFAULT_BLOCKSTREAM_API_URL,
      path: "/tx/test",
    });

    expect(response).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledWith(250);
  });

  it("does not retry not found responses", async () => {
    const fetchMock = createStaticFetch({ error: "missing" }, 404);
    const sleepMock = createResolvedSleepMock();
    const client = createHttpClient({
      fetch: fetchMock,
      sleep: sleepMock,
    });

    await expect(
      client.requestJson({
        source: "blockstream",
        baseUrl: DEFAULT_BLOCKSTREAM_API_URL,
        path: "/tx/missing",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("retries network failures and then raises provider unavailability", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("socket hang up"))
      .mockRejectedValueOnce(new TypeError("socket hang up"))
      .mockRejectedValueOnce(new TypeError("socket hang up"));
    const sleepMock = createResolvedSleepMock();
    const client = createHttpClient({
      fetch: fetchMock,
      sleep: sleepMock,
      maxAttempts: 3,
      initialBackoffMs: 200,
    });

    await expect(
      client.requestJson({
        source: "blockstream",
        baseUrl: DEFAULT_BLOCKSTREAM_API_URL,
        path: "/tx/fail",
      }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 200);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 400);
  });
});

describe.runIf(process.env.LIVE_API_TESTS === "1")("live blockstream api (opt-in)", () => {
  it("calls live address endpoints and prints normalized output", async () => {
    const client = createBlockstreamClient();
    const summary = await client.getAddressSummary({
      address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      addressType: "p2pkh",
      pagination: {
        page: 1,
        limit: 5,
      },
    });

    console.log("LIVE_ADDRESS_SUMMARY", {
      address: summary.address,
      network: summary.network,
      addressType: summary.addressType,
      totalReceivedSats: summary.totalReceivedSats.toString(),
      totalSpentSats: summary.totalSpentSats.toString(),
      balanceSats: summary.balanceSats.toString(),
      utxoCount: summary.utxos.pagination.total,
      sampleUtxos: summary.utxos.items.map(utxo => ({
        outpoint: `${utxo.txid}:${String(utxo.vout)}`,
        valueSats: utxo.valueSats.toString(),
        status: utxo.status,
      })),
    });

    expect(summary.address).toBe("1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
    expect(summary.network).toBe("mainnet");
  });

  it("calls live tx endpoint and prints normalized output", async () => {
    const client = createBlockstreamClient();
    const summary = await client.getTransactionSummary({
      txid: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      pagination: {
        page: 1,
        limit: 5,
      },
    });

    console.log("LIVE_TX_SUMMARY", {
      txid: summary.txid,
      confirmationStatus: summary.confirmed ? "confirmed" : "unconfirmed",
      confirmed: summary.confirmed,
      blockHeight: summary.blockHeight,
      blockTime: summary.blockTime,
      timestamp: summary.timestamp,
      totalInputSats: summary.totalInputSats?.toString() ?? null,
      totalOutputSats: summary.totalOutputSats.toString(),
      feeSats: summary.feeSats?.toString() ?? null,
      inputCount: summary.inputs.pagination.total,
      outputCount: summary.outputs.pagination.total,
      sampleOutputs: summary.outputs.items.map((output, index) => ({
        index,
        valueSats: output.valueSats.toString(),
        scriptType: output.scriptPubKeyType,
        scriptAddress: output.scriptPubKeyAddress,
      })),
    });

    expect(summary.txid).toBe("4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b");
  });
});
