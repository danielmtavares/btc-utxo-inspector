#!/usr/bin/env node
import { Command } from "commander";
import { packageVersion } from "./version.js";

export function createCli() {
  const program = new Command();

  program.name("btc-utxo-inspector");
  program.description(
    "Inspect Bitcoin mainnet addresses and transactions from the terminal.",
  );
  program.version(packageVersion);

  program.command("address").description("Inspect a Bitcoin address");
  program.command("tx").description("Inspect a Bitcoin transaction");

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await createCli().parseAsync(process.argv);
}
