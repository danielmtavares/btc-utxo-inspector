import { describe, expect, it, vi } from "vitest";
import { InvalidPaginationError } from "../src/utils/errors.js";
import { inspectTransactionCommand } from "../src/commands/tx.js";
import type { ExplorerClient, TransactionSummary } from "../src/api/types.js";

function createExplorerClient(summary: TransactionSummary): {
  client: ExplorerClient;
  getTransactionSummary: ReturnType<typeof vi.fn>;
} {
  const getTransactionSummary = vi.fn(async () => {
    await Promise.resolve();
    return summary;
  });

  return {
    client: {
      getAddressSummary: vi.fn(async () => {
        await Promise.resolve();
        throw new Error("Unexpected address lookup");
      }),
      getTransactionSummary,
    },
    getTransactionSummary,
  };
}

function createTransactionSummary(): TransactionSummary {
  return {
    txid: "2222222222222222222222222222222222222222222222222222222222222222",
    version: 2,
    locktime: 0,
    confirmed: true,
    blockHeight: 100001,
    blockHash: "0000000000000000000000000000000000000000000000000000000000000001",
    blockTime: 1700001000,
    timestamp: "2023-11-14T22:30:00.000Z",
    vinCount: 1,
    voutCount: 1,
    totalInputSats: 5000000000n,
    totalOutputSats: 4999900000n,
    feeSats: 100000n,
    inputs: {
      items: [
        {
          txid: "1111111111111111111111111111111111111111111111111111111111111111",
          vout: 0,
          isCoinbase: false,
          sequence: 4294967295,
          scriptSigAsm: "",
          witness: [],
          prevout: {
            valueSats: 5000000000n,
            scriptPubKey: "76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac",
            scriptPubKeyAsm: "OP_DUP OP_HASH160 89abcdefabbaabbaabbaabbaabbaabbaabbaabba OP_EQUALVERIFY OP_CHECKSIG",
            scriptPubKeyType: "p2pkh",
            scriptPubKeyAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
            spent: null,
          },
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
    outputs: {
      items: [
        {
          valueSats: 4999900000n,
          scriptPubKey: "001489abcdefabbaabbaabbaabbaabbaabbaabbaabba",
          scriptPubKeyAsm: "OP_0 89abcdefabbaabbaabbaabbaabbaabbaabbaabba",
          scriptPubKeyType: "p2wpkh",
          scriptPubKeyAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080",
          spent: null,
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

describe("inspectTransactionCommand", () => {
  it("returns normalized transaction details", async () => {
    const summary = createTransactionSummary();
    const { client } = createExplorerClient(summary);

    const result = await inspectTransactionCommand(
      {
        txid: summary.txid,
      },
      {
        createClient: () => client,
      },
    );

    expect(result).toMatchObject({
      txid: summary.txid,
      version: 2,
      locktime: 0,
      confirmationStatus: "confirmed",
      confirmed: true,
      blockHeight: 100001,
      timestamp: "2023-11-14T22:30:00.000Z",
      vinCount: 1,
      voutCount: 1,
      totalInput: {
        btc: "50 BTC",
        sats: "5,000,000,000 sats",
        valueSats: 5000000000n,
      },
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
    expect(result.inputs.items[0]).toMatchObject({
      outpoint: "1111111111111111111111111111111111111111111111111111111111111111:0",
      isCoinbase: false,
      prevout: {
        scriptType: "p2pkh",
        scriptAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
        amount: {
          btc: "50 BTC",
          sats: "5,000,000,000 sats",
        },
      },
    });
    expect(result.outputs.items[0]).toMatchObject({
      scriptType: "p2wpkh",
      scriptAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080",
      amount: {
        btc: "49.999 BTC",
        sats: "4,999,900,000 sats",
      },
    });
  });

  it("uses pagination defaults", async () => {
    const summary = createTransactionSummary();
    const { client, getTransactionSummary } = createExplorerClient(summary);

    await inspectTransactionCommand(
      {
        txid: summary.txid,
      },
      {
        createClient: () => client,
      },
    );

    expect(getTransactionSummary).toHaveBeenCalledWith({
      txid: summary.txid,
      pagination: {
        page: 1,
        limit: 25,
      },
    });
  });

  it("keeps optional totals nullable when provider cannot supply them", async () => {
    const summary = createTransactionSummary();
    summary.totalInputSats = null;
    summary.feeSats = null;
    const { client } = createExplorerClient(summary);

    const result = await inspectTransactionCommand(
      {
        txid: summary.txid,
      },
      {
        createClient: () => client,
      },
    );

    expect(result.totalInput).toBeNull();
    expect(result.fee).toBeNull();
  });

  it("rejects invalid pagination before provider calls", async () => {
    const summary = createTransactionSummary();
    const createClient = vi.fn(() => createExplorerClient(summary).client);

    await expect(
      inspectTransactionCommand(
        {
          txid: summary.txid,
          limit: 0,
        },
        {
          createClient,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidPaginationError);
    expect(createClient).not.toHaveBeenCalled();
  });
});
