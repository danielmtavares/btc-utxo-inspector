import chalk from "chalk";

import type { AddressCommandResult } from "../commands/address.js";
import type { AmountSummary } from "../commands/shared.js";
import type { TransactionCommandResult } from "../commands/tx.js";

function formatAmount(label: string, amount: AmountSummary): string {
  return `${chalk.bold(label)} ${amount.btc} (${amount.sats})`;
}

function formatPaginationLine(
  label: string,
  page: number,
  totalPages: number,
  total: number,
): string {
  return `${chalk.bold(label)} ${chalk.bold("Page")} ${String(page)}/${String(totalPages || 1)} ${chalk.bold("Items")} ${String(total)}`;
}

function formatBlockLine(blockHeight: number | null, timestamp: string | null): string {
  const blockLabel = blockHeight === null ? "unconfirmed" : String(blockHeight);

  if (timestamp === null) {
    return `${chalk.bold("Block")} ${blockLabel}`;
  }

  return `${chalk.bold("Block")} ${blockLabel} ${chalk.bold("Time")} ${timestamp}`;
}

function formatAddressUtxoLine(result: AddressCommandResult, index: number): string {
  const utxo = result.utxos.items[index];

  if (utxo === undefined) {
    return "";
  }

  const parts = [
    `${String(index + 1)}.`,
    utxo.outpoint,
    utxo.amount.btc,
    `(${utxo.amount.sats})`,
    utxo.confirmationStatus,
  ];

  if (utxo.blockHeight !== null) {
    parts.push(`block ${String(utxo.blockHeight)}`);
  }

  parts.push(utxo.scriptType);
  return parts.join(" ");
}

function formatTransactionInputLine(result: TransactionCommandResult, index: number): string {
  const input = result.inputs.items[index];

  if (input === undefined) {
    return "";
  }

  const parts = [`${String(index + 1)}.`, input.outpoint ?? "coinbase"];

  if (input.prevout !== null) {
    parts.push(input.prevout.amount.btc, `(${input.prevout.amount.sats})`);
  }

  return parts.join(" ");
}

function formatTransactionOutputLine(result: TransactionCommandResult, index: number): string {
  const output = result.outputs.items[index];

  if (output === undefined) {
    return "";
  }

  const parts = [
    `${String(index + 1)}.`,
    output.amount.btc,
    `(${output.amount.sats})`,
    output.scriptType,
  ];

  if (output.scriptAddress !== null) {
    parts.push(output.scriptAddress);
  }

  return parts.join(" ");
}

export function formatHumanAddress(result: AddressCommandResult): string {
  const lines = [
    chalk.bold(`Address ${result.address}`),
    `${chalk.bold("Network")} ${result.network} ${chalk.bold("Type")} ${result.addressType}`,
    formatAmount("Received", result.totalReceived),
    formatAmount("Spent", result.totalSpent),
    formatAmount("Balance", result.balance),
    formatPaginationLine(
      "UTXOs",
      result.utxos.pagination.page,
      result.utxos.pagination.totalPages,
      result.utxos.pagination.total,
    ),
  ];

  if (result.utxos.items.length === 0) {
    lines.push("0 items");
  } else {
    for (let index = 0; index < result.utxos.items.length; index += 1) {
      lines.push(formatAddressUtxoLine(result, index));
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatHumanTransaction(result: TransactionCommandResult): string {
  const lines = [
    chalk.bold(`Transaction ${result.txid}`),
    `${chalk.bold("Status")} ${result.confirmationStatus}`,
    formatBlockLine(result.blockHeight, result.timestamp),
    `${chalk.bold("Version")} ${String(result.version)} ${chalk.bold("Locktime")} ${String(result.locktime)}`,
    result.totalInput === null
      ? `${chalk.bold("Input Total")} unavailable`
      : formatAmount("Input Total", result.totalInput),
    formatAmount("Output Total", result.totalOutput),
    result.fee === null ? `${chalk.bold("Fee")} unavailable` : formatAmount("Fee", result.fee),
    `${chalk.bold("Inputs")} ${String(result.vinCount)}`,
    formatPaginationLine(
      "Inputs",
      result.inputs.pagination.page,
      result.inputs.pagination.totalPages,
      result.inputs.pagination.total,
    ),
  ];

  if (result.inputs.items.length === 0) {
    lines.push("0 items");
  } else {
    for (let index = 0; index < result.inputs.items.length; index += 1) {
      lines.push(formatTransactionInputLine(result, index));
    }
  }

  lines.push(`${chalk.bold("Outputs")} ${String(result.voutCount)}`);

  if (result.outputs.items.length === 0) {
    lines.push("0 items");
  } else {
    for (let index = 0; index < result.outputs.items.length; index += 1) {
      lines.push(formatTransactionOutputLine(result, index));
    }
  }

  lines.push(
    formatPaginationLine(
      "Outputs",
      result.outputs.pagination.page,
      result.outputs.pagination.totalPages,
      result.outputs.pagination.total,
    ),
  );

  return `${lines.join("\n")}\n`;
}
