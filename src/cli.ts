#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command, CommanderError, Option } from "commander";
import { inspectAddressCommand } from "./commands/address.js";
import { inspectTransactionCommand } from "./commands/tx.js";
import { formatHumanAddress, formatHumanTransaction } from "./format/human.js";
import { formatJson } from "./format/json.js";
import { getExitCode, InvalidPaginationError, toErrorEnvelope } from "./utils/errors.js";
import { packageVersion } from "./version.js";
import type { ExplorerSource } from "./api/types.js";
import type { AddressCommandInput, AddressCommandResult } from "./commands/address.js";
import type { TransactionCommandInput, TransactionCommandResult } from "./commands/tx.js";

interface CommonCliOptions {
  json?: boolean;
  source?: ExplorerSource;
  apiUrl?: string;
  limit?: number;
  page?: number;
}

interface CliRuntime {
  inspectAddressCommand?: typeof inspectAddressCommand;
  inspectTransactionCommand?: typeof inspectTransactionCommand;
  stdout?: Pick<typeof process.stdout, "write">;
  stderr?: Pick<typeof process.stderr, "write">;
}

function parseIntegerOption(name: "page" | "limit", value: string): number {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new InvalidPaginationError({ [name]: value });
  }

  return parsedValue;
}

function addCommonCommandOptions(command: Command): Command {
  return command
    .addOption(
      new Option("--source <source>", "Data provider")
        .choices(["blockstream"])
        .default("blockstream"),
    )
    .option("--api-url <url>", "Override provider base URL")
    .option("--json", "Emit JSON to stdout")
    .option("--limit <number>", "Limit paginated items", value => parseIntegerOption("limit", value))
    .option("--page <number>", "Select page number", value => parseIntegerOption("page", value));
}

function createAddressInput(address: string, options: CommonCliOptions): AddressCommandInput {
  const input: AddressCommandInput = { address };

  if (options.source !== undefined) {
    input.source = options.source;
  }

  if (options.apiUrl !== undefined) {
    input.apiUrl = options.apiUrl;
  }

  if (options.page !== undefined) {
    input.page = options.page;
  }

  if (options.limit !== undefined) {
    input.limit = options.limit;
  }

  return input;
}

function createTransactionInput(txid: string, options: CommonCliOptions): TransactionCommandInput {
  const input: TransactionCommandInput = { txid };

  if (options.source !== undefined) {
    input.source = options.source;
  }

  if (options.apiUrl !== undefined) {
    input.apiUrl = options.apiUrl;
  }

  if (options.page !== undefined) {
    input.page = options.page;
  }

  if (options.limit !== undefined) {
    input.limit = options.limit;
  }

  return input;
}

function renderAddressOutput(result: AddressCommandResult, json: boolean): string {
  return json ? formatJson(result) : formatHumanAddress(result);
}

function renderTransactionOutput(result: TransactionCommandResult, json: boolean): string {
  return json ? formatJson(result) : formatHumanTransaction(result);
}

function writeOutput(output: string, stream: Pick<typeof process.stdout, "write">): void {
  stream.write(output);
}

function writeError(error: unknown, json: boolean, stream: Pick<typeof process.stderr, "write">): void {
  if (json) {
    stream.write(formatJson(toErrorEnvelope(error)));
    return;
  }

  if (error instanceof CommanderError) {
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  stream.write(`${message}\n`);
}

function isJsonRequested(argv: readonly string[]): boolean {
  return argv.includes("--json");
}

function getCliExitCode(error: unknown): number {
  if (error instanceof CommanderError) {
    return error.exitCode;
  }

  return getExitCode(error);
}

function resolveRealPath(path: string): string {
  return realpathSync.native(path);
}

export function isExecutedDirectly(cliPath: string | undefined, moduleUrl: string): boolean {
  if (cliPath === undefined) {
    return false;
  }

  const modulePath = fileURLToPath(moduleUrl);

  return resolveRealPath(cliPath) === resolveRealPath(modulePath);
}

export function createCli(runtime: CliRuntime = {}): Command {
  const runAddressCommand = runtime.inspectAddressCommand ?? inspectAddressCommand;
  const runTransactionCommand = runtime.inspectTransactionCommand ?? inspectTransactionCommand;
  const stdout = runtime.stdout ?? process.stdout;
  const program = new Command();

  program.name("btc-utxo-inspector");
  program.description(
    "Inspect Bitcoin mainnet addresses and transactions from the terminal.",
  );
  program.version(packageVersion);
  program.exitOverride();

  addCommonCommandOptions(
    program
      .command("address")
      .description("Inspect a Bitcoin address")
      .argument("<address>", "Bitcoin mainnet address"),
  ).action(async (address: string, options: CommonCliOptions) => {
    const result = await runAddressCommand(createAddressInput(address, options));
    writeOutput(renderAddressOutput(result, options.json ?? false), stdout);
  });

  addCommonCommandOptions(
    program
      .command("tx")
      .description("Inspect a Bitcoin transaction")
      .argument("<txid>", "Bitcoin transaction id"),
  ).action(async (txid: string, options: CommonCliOptions) => {
    const result = await runTransactionCommand(createTransactionInput(txid, options));
    writeOutput(renderTransactionOutput(result, options.json ?? false), stdout);
  });

  return program;
}

export async function runCli(argv: readonly string[], runtime: CliRuntime = {}): Promise<number> {
  const cli = createCli(runtime);
  const stderr = runtime.stderr ?? process.stderr;

  try {
    await cli.parseAsync([...argv]);
    return 0;
  }
  catch (error: unknown) {
    writeError(error, isJsonRequested(argv), stderr);
    return getCliExitCode(error);
  }
}

if (isExecutedDirectly(process.argv[1], import.meta.url)) {
  process.exitCode = await runCli(process.argv);
}
