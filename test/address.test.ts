import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { InvalidAddressError, InvalidPaginationError } from "../src/utils/errors.js";
import { inspectAddressCommand } from "../src/commands/address.js";
import { formatHumanAddress } from "../src/format/human.js";
import { formatJson } from "../src/format/json.js";
import type { AddressSummary, ExplorerClient } from "../src/api/types.js";

function createExplorerClient(summary: AddressSummary): {
  client: ExplorerClient;
  getAddressSummary: ReturnType<typeof vi.fn>;
} {
  const getAddressSummary = vi.fn(async () => {
    await Promise.resolve();
    return summary;
  });

  return {
    client: {
      getAddressSummary,
      getTransactionSummary: vi.fn(async () => {
        await Promise.resolve();
        throw new Error("Unexpected transaction lookup");
      }),
    },
    getAddressSummary,
  };
}

function createAddressSummary(): AddressSummary {
  return {
    address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
    network: "mainnet",
    addressType: "p2pkh",
    chainStats: {
      fundedTxoCount: 2,
      fundedTxoSats: 5250000000n,
      spentTxoCount: 1,
      spentTxoSats: 1250000000n,
      transactionCount: 3,
    },
    mempoolStats: {
      fundedTxoCount: 1,
      fundedTxoSats: 250000000n,
      spentTxoCount: 0,
      spentTxoSats: 0n,
      transactionCount: 1,
    },
    totalReceivedSats: 5500000000n,
    totalSpentSats: 1250000000n,
    balanceSats: 4250000000n,
    utxos: {
      items: [
        {
          txid: "1111111111111111111111111111111111111111111111111111111111111111",
          vout: 0,
          valueSats: 5000000000n,
          status: {
            confirmed: true,
            blockHeight: 100000,
            blockHash: "0000000000000000000000000000000000000000000000000000000000000000",
            blockTime: 1700000000,
          },
          scriptPubKeyType: "unknown",
          scriptPubKeyAddress: null,
        },
      ],
      pagination: {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
        startIndex: 0,
        endIndex: 1,
      },
    },
  };
}

describe("inspectAddressCommand", () => {
  it("returns normalized balance and utxo data", async () => {
    const summary = createAddressSummary();
    const { client } = createExplorerClient(summary);

    const result = await inspectAddressCommand(
      {
        address: summary.address,
      },
      {
        createClient: () => client,
      },
    );

    expect(result).toMatchObject({
      address: summary.address,
      network: "mainnet",
      addressType: "p2pkh",
      totalReceived: {
        btc: "55 BTC",
        sats: "5,500,000,000 sats",
        valueSats: 5500000000n,
      },
      totalSpent: {
        btc: "12.5 BTC",
        sats: "1,250,000,000 sats",
        valueSats: 1250000000n,
      },
      balance: {
        btc: "42.5 BTC",
        sats: "4,250,000,000 sats",
        valueSats: 4250000000n,
      },
    });
    expect(result.utxos.items[0]).toMatchObject({
      txid: "1111111111111111111111111111111111111111111111111111111111111111",
      vout: 0,
      outpoint: "1111111111111111111111111111111111111111111111111111111111111111:0",
      confirmationStatus: "confirmed",
      confirmed: true,
      blockHeight: 100000,
      scriptType: "unknown",
      amount: {
        btc: "50 BTC",
        sats: "5,000,000,000 sats",
        valueSats: 5000000000n,
      },
    });
  });

  it("matches the human-readable output snapshot", async () => {
    const summary = createAddressSummary();
    const { client } = createExplorerClient(summary);
    const result = await inspectAddressCommand(
      {
        address: summary.address,
      },
      {
        createClient: () => client,
      },
    );

    await expect(formatHumanAddress(result)).toMatchFileSnapshot(
      fileURLToPath(new URL("./snapshots/address-human-output.txt", import.meta.url)),
    );
  });

  it("matches the json output snapshot", async () => {
    const summary = createAddressSummary();
    const { client } = createExplorerClient(summary);
    const result = await inspectAddressCommand(
      {
        address: summary.address,
      },
      {
        createClient: () => client,
      },
    );

    await expect(formatJson(result)).toMatchFileSnapshot(
      fileURLToPath(new URL("./snapshots/address-json-output.json", import.meta.url)),
    );
  });

  it("uses pagination defaults and parsed address metadata", async () => {
    const summary = createAddressSummary();
    const { client, getAddressSummary } = createExplorerClient(summary);

    await inspectAddressCommand(
      {
        address: summary.address,
      },
      {
        createClient: () => client,
      },
    );

    expect(getAddressSummary).toHaveBeenCalledWith({
      address: summary.address,
      addressType: "p2pkh",
      pagination: {
        page: 1,
        limit: 25,
      },
    });
  });

  it("rejects invalid addresses before provider calls", async () => {
    const createClient = vi.fn(() => createExplorerClient(createAddressSummary()).client);

    await expect(
      inspectAddressCommand(
        {
          address: "not-an-address",
        },
        {
          createClient,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidAddressError);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("propagates invalid pagination errors from provider pagination", async () => {
    const summary = createAddressSummary();
    const { client } = createExplorerClient(summary);

    await expect(
      inspectAddressCommand(
        {
          address: summary.address,
          page: 0,
        },
        {
          createClient: () => client,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidPaginationError);
  });
});
