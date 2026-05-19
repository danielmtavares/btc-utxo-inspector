import { describe, expect, it } from "vitest";

import type { AddressCommandResult } from "../src/commands/address.js";
import type { TransactionCommandResult } from "../src/commands/tx.js";
import { formatHumanAddress, formatHumanTransaction } from "../src/format/human.js";
import { formatJson } from "../src/format/json.js";

function createAddressResult(): AddressCommandResult {
  return {
    address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
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
    utxos: {
      items: [
        {
          txid: "1111111111111111111111111111111111111111111111111111111111111111",
          vout: 0,
          outpoint: "1111111111111111111111111111111111111111111111111111111111111111:0",
          amount: {
            btc: "50 BTC",
            sats: "5,000,000,000 sats",
            valueSats: 5000000000n,
          },
          confirmationStatus: "confirmed",
          confirmed: true,
          blockHeight: 100000,
          scriptType: "unknown",
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

function createTransactionResult(): TransactionCommandResult {
  return {
    txid: "2222222222222222222222222222222222222222222222222222222222222222",
    version: 2,
    locktime: 0,
    confirmationStatus: "confirmed",
    confirmed: true,
    blockHeight: 100001,
    blockHash: "0000000000000000000000000000000000000000000000000000000000000001",
    blockTime: 1700001000,
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
    inputs: {
      items: [
        {
          txid: "1111111111111111111111111111111111111111111111111111111111111111",
          vout: 0,
          outpoint: "1111111111111111111111111111111111111111111111111111111111111111:0",
          isCoinbase: false,
          sequence: 4294967295,
          scriptSigAsm: "",
          witness: [],
          prevout: {
            amount: {
              btc: "50 BTC",
              sats: "5,000,000,000 sats",
              valueSats: 5000000000n,
            },
            scriptPubKey: "76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac",
            scriptPubKeyAsm: "",
            scriptType: "p2pkh",
            scriptAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
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
          amount: {
            btc: "49.999 BTC",
            sats: "4,999,900,000 sats",
            valueSats: 4999900000n,
          },
          scriptPubKey: "0014...",
          scriptPubKeyAsm: "",
          scriptType: "p2wpkh",
          scriptAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080",
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

describe("formatters", () => {
  it("formats address results for humans", () => {
    const output = formatHumanAddress(createAddressResult());

    expect(output).toContain("Address 1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
    expect(output).toContain("Balance 42.5 BTC");
    expect(output).toContain("UTXOs");
  });

  it("formats transaction results for humans", () => {
    const output = formatHumanTransaction(createTransactionResult());

    expect(output).toContain(
      "Transaction 2222222222222222222222222222222222222222222222222222222222222222",
    );
    expect(output).toContain("Fee 0.001 BTC");
    expect(output).toContain("Outputs 1");
  });

  it("formats parseable json and stringifies bigint values", () => {
    const output = formatJson(createAddressResult());
    const parsed = JSON.parse(output) as { balance: { valueSats: string } };

    expect(parsed.balance.valueSats).toBe("4250000000");
  });
});
