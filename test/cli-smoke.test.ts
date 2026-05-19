import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { isExecutedDirectly, runCli } from "../src/cli.js";
import type { AddressCommandInput, AddressCommandResult } from "../src/commands/address.js";
import type { TransactionCommandInput, TransactionCommandResult } from "../src/commands/tx.js";
import { InvalidAddressError } from "../src/utils/errors.js";

type AddressCommandRunner = (input: AddressCommandInput) => Promise<AddressCommandResult>;
type TransactionCommandRunner = (
  input: TransactionCommandInput,
) => Promise<TransactionCommandResult>;

function createMemoryStream(): {
  output: string;
  write: (chunk: string) => boolean;
} {
  return {
    output: "",
    write(chunk: string): boolean {
      this.output += chunk;
      return true;
    },
  };
}

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
      items: [],
      pagination: {
        page: 2,
        limit: 5,
        total: 0,
        totalPages: 0,
        hasPreviousPage: true,
        hasNextPage: false,
        startIndex: 0,
        endIndex: 0,
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
    vinCount: 0,
    voutCount: 0,
    totalInput: null,
    totalOutput: {
      btc: "49.999 BTC",
      sats: "4,999,900,000 sats",
      valueSats: 4999900000n,
    },
    fee: null,
    inputs: {
      items: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
        startIndex: 0,
        endIndex: 0,
      },
    },
    outputs: {
      items: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
        startIndex: 0,
        endIndex: 0,
      },
    },
  };
}

describe("cli smoke", () => {
  it("detects direct execution through a symlinked bin path", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "btc-utxo-cli-"));
    const targetPath = join(tempDirectory, "cli.js");
    const symlinkPath = join(tempDirectory, "btc-utxo-inspector");

    writeFileSync(targetPath, "#!/usr/bin/env node\n");
    symlinkSync(targetPath, symlinkPath);

    expect(isExecutedDirectly(symlinkPath, pathToFileURL(targetPath).href)).toBe(true);
  });

  it("emits parseable json to stdout for the address command", async () => {
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();
    const inspectAddressCommand = vi.fn<AddressCommandRunner>(() =>
      Promise.resolve(createAddressResult()),
    );

    const exitCode = await runCli(
      [
        "node",
        "cli.js",
        "address",
        "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
        "--json",
        "--source",
        "blockstream",
        "--api-url",
        "https://example.test/api",
        "--page",
        "2",
        "--limit",
        "5",
      ],
      {
        inspectAddressCommand,
        inspectTransactionCommand: vi.fn<TransactionCommandRunner>(() =>
          Promise.resolve(createTransactionResult()),
        ),
        stdout,
        stderr,
      },
    );

    const parsed = JSON.parse(stdout.output) as {
      address: string;
      network: string;
      addressType: string;
      balance: { valueSats: string };
      utxos: {
        items: unknown[];
        pagination: { page: number; limit: number };
      };
    };

    expect(exitCode).toBe(0);
    expect(stderr.output).toBe("");
    expect(parsed.address).toBe("1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
    expect(parsed.network).toBe("mainnet");
    expect(parsed.addressType).toBe("p2pkh");
    expect(parsed.balance.valueSats).toBe("4250000000");
    expect(parsed.utxos.items).toEqual([]);
    expect(parsed.utxos.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 0,
      totalPages: 0,
      hasPreviousPage: true,
      hasNextPage: false,
      startIndex: 0,
      endIndex: 0,
    });
    expect(inspectAddressCommand).toHaveBeenCalledWith({
      address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      source: "blockstream",
      apiUrl: "https://example.test/api",
      page: 2,
      limit: 5,
    });
  });

  it("writes human-readable transaction output to stdout", async () => {
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();

    const exitCode = await runCli(
      ["node", "cli.js", "tx", "2222222222222222222222222222222222222222222222222222222222222222"],
      {
        inspectAddressCommand: vi.fn<AddressCommandRunner>(() =>
          Promise.resolve(createAddressResult()),
        ),
        inspectTransactionCommand: vi.fn<TransactionCommandRunner>(() =>
          Promise.resolve(createTransactionResult()),
        ),
        stdout,
        stderr,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.output).toBe("");
    expect(stdout.output).toContain(
      "Transaction 2222222222222222222222222222222222222222222222222222222222222222",
    );
    expect(stdout.output).toContain("Status confirmed");
    expect(stdout.output).toContain("Output Total 49.999 BTC");
  });

  it("emits parseable json to stdout for the tx command", async () => {
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();

    const exitCode = await runCli(
      [
        "node",
        "cli.js",
        "tx",
        "2222222222222222222222222222222222222222222222222222222222222222",
        "--json",
      ],
      {
        inspectAddressCommand: vi.fn<AddressCommandRunner>(() =>
          Promise.resolve(createAddressResult()),
        ),
        inspectTransactionCommand: vi.fn<TransactionCommandRunner>(() =>
          Promise.resolve(createTransactionResult()),
        ),
        stdout,
        stderr,
      },
    );

    const parsed = JSON.parse(stdout.output) as {
      txid: string;
      confirmationStatus: string;
      totalOutput: { valueSats: string };
      outputs: { pagination: { page: number; limit: number } };
    };

    expect(exitCode).toBe(0);
    expect(stderr.output).toBe("");
    expect(parsed.txid).toBe("2222222222222222222222222222222222222222222222222222222222222222");
    expect(parsed.confirmationStatus).toBe("confirmed");
    expect(parsed.totalOutput.valueSats).toBe("4999900000");
    expect(parsed.outputs.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
      startIndex: 0,
      endIndex: 0,
    });
  });

  it("writes json errors to stderr and returns the mapped exit code", async () => {
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();

    const exitCode = await runCli(["node", "cli.js", "address", "bad", "--json"], {
      inspectAddressCommand: vi.fn<AddressCommandRunner>(() =>
        Promise.reject(new InvalidAddressError("bad")),
      ),
      inspectTransactionCommand: vi.fn<TransactionCommandRunner>(() =>
        Promise.resolve(createTransactionResult()),
      ),
      stdout,
      stderr,
    });

    const parsed = JSON.parse(stderr.output) as {
      error: { code: string; message: string; details: Record<string, unknown> };
    };

    expect(exitCode).toBe(2);
    expect(stdout.output).toBe("");
    expect(Object.keys(parsed)).toEqual(["error"]);
    expect(parsed.error.code).toBe("INVALID_ADDRESS");
    expect(parsed.error.message).toContain("Invalid Bitcoin mainnet address");
    expect(parsed.error.details).toEqual({
      address: "bad",
    });
  });
});
