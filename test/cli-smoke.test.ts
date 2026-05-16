import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { isExecutedDirectly, runCli } from "../src/cli.js";
import { InvalidAddressError } from "../src/utils/errors.js";
import type { AddressCommandResult } from "../src/commands/address.js";
import type { TransactionCommandResult } from "../src/commands/tx.js";

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
    const inspectAddressCommand = vi.fn(() => Promise.resolve(createAddressResult()));

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
        inspectTransactionCommand: vi.fn(() => Promise.resolve(createTransactionResult())),
        stdout,
        stderr,
      },
    );

    const parsed = JSON.parse(stdout.output) as {
      utxos: { pagination: { page: number; limit: number } };
    };

    expect(exitCode).toBe(0);
    expect(stderr.output).toBe("");
    expect(parsed.utxos.pagination).toEqual({ page: 2, limit: 5, total: 0, totalPages: 0, hasPreviousPage: true, hasNextPage: false, startIndex: 0, endIndex: 0 });
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
        inspectAddressCommand: vi.fn(() => Promise.resolve(createAddressResult())),
        inspectTransactionCommand: vi.fn(() => Promise.resolve(createTransactionResult())),
        stdout,
        stderr,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.output).toBe("");
    expect(stdout.output).toContain("Transaction 2222222222222222222222222222222222222222222222222222222222222222");
  });

  it("writes json errors to stderr and returns the mapped exit code", async () => {
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();

    const exitCode = await runCli(
      ["node", "cli.js", "address", "bad", "--json"],
      {
        inspectAddressCommand: vi.fn(() => Promise.reject(new InvalidAddressError("bad"))),
        inspectTransactionCommand: vi.fn(() => Promise.resolve(createTransactionResult())),
        stdout,
        stderr,
      },
    );

    const parsed = JSON.parse(stderr.output) as {
      error: { code: string; message: string };
    };

    expect(exitCode).toBe(2);
    expect(stdout.output).toBe("");
    expect(parsed.error.code).toBe("INVALID_ADDRESS");
    expect(parsed.error.message).toContain("Invalid Bitcoin mainnet address");
  });
});
