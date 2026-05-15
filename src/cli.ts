#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { packageVersion } from "./version.js";

export function createCli(): Command {
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

const cliPath = process.argv[1];

if (cliPath !== undefined && import.meta.url === pathToFileURL(cliPath).href) {
  await createCli().parseAsync(process.argv);
}
