#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { inspectAddressCommand } from "./commands/address.js";
import { inspectTransactionCommand } from "./commands/tx.js";
import { packageVersion } from "./version.js";

export function createCli(): Command {
  const program = new Command();

  program.name("btc-utxo-inspector");
  program.description(
    "Inspect Bitcoin mainnet addresses and transactions from the terminal.",
  );
  program.version(packageVersion);

  program
    .command("address")
    .description("Inspect a Bitcoin address")
    .argument("<address>", "Bitcoin mainnet address")
    .action(async (address: string) => {
      const result = await inspectAddressCommand({ address });
      console.dir(result, { depth: null });
    });
  program
    .command("tx")
    .description("Inspect a Bitcoin transaction")
    .argument("<txid>", "Bitcoin transaction id")
    .action(async (txid: string) => {
      const result = await inspectTransactionCommand({ txid });
      console.dir(result, { depth: null });
    });

  return program;
}

const cliPath = process.argv[1];

if (cliPath !== undefined && import.meta.url === pathToFileURL(cliPath).href) {
  await createCli().parseAsync(process.argv);
}
