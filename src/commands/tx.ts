import type {
  BitcoinScriptType,
  PaginatedCollection,
  TransactionInput,
  TransactionOutput,
} from "../api/types.js";
import {
  createAmountSummary,
  getPagination,
  resolveClient,
} from "./shared.js";
import type {
  AmountSummary,
  CommandClientDependencies,
  CommandClientInput,
} from "./shared.js";

export interface TransactionCommandInput extends CommandClientInput {
  txid: string;
  page?: number;
  limit?: number;
}

export interface TransactionCommandPrevout {
  amount: AmountSummary;
  scriptPubKey: string;
  scriptPubKeyAsm: string | null;
  scriptType: BitcoinScriptType;
  scriptAddress: string | null;
  spent: boolean | null;
}

export interface TransactionCommandInputItem {
  txid: string | null;
  vout: number | null;
  outpoint: string | null;
  isCoinbase: boolean;
  sequence: number;
  scriptSigAsm: string | null;
  witness: string[];
  prevout: TransactionCommandPrevout | null;
}

export interface TransactionCommandOutputItem {
  amount: AmountSummary;
  scriptPubKey: string;
  scriptPubKeyAsm: string | null;
  scriptType: BitcoinScriptType;
  scriptAddress: string | null;
  spent: boolean | null;
}

export interface TransactionCommandResult {
  txid: string;
  version: number;
  locktime: number;
  confirmationStatus: "confirmed" | "unconfirmed";
  confirmed: boolean;
  blockHeight: number | null;
  blockHash: string | null;
  blockTime: number | null;
  timestamp: string | null;
  vinCount: number;
  voutCount: number;
  totalInput: AmountSummary | null;
  totalOutput: AmountSummary;
  fee: AmountSummary | null;
  inputs: PaginatedCollection<TransactionCommandInputItem>;
  outputs: PaginatedCollection<TransactionCommandOutputItem>;
}

function createOutpoint(txid: string | null, vout: number | null): string | null {
  if (txid === null || vout === null) {
    return null;
  }

  return `${txid}:${String(vout)}`;
}

function mapPrevout(prevout: TransactionOutput | null): TransactionCommandPrevout | null {
  if (prevout === null) {
    return null;
  }

  return {
    amount: createAmountSummary(prevout.valueSats),
    scriptPubKey: prevout.scriptPubKey,
    scriptPubKeyAsm: prevout.scriptPubKeyAsm,
    scriptType: prevout.scriptPubKeyType,
    scriptAddress: prevout.scriptPubKeyAddress,
    spent: prevout.spent,
  };
}

function mapInputCollection(
  inputs: PaginatedCollection<TransactionInput>,
): PaginatedCollection<TransactionCommandInputItem> {
  return {
    items: inputs.items.map(input => ({
      txid: input.txid,
      vout: input.vout,
      outpoint: createOutpoint(input.txid, input.vout),
      isCoinbase: input.isCoinbase,
      sequence: input.sequence,
      scriptSigAsm: input.scriptSigAsm,
      witness: input.witness,
      prevout: mapPrevout(input.prevout),
    })),
    pagination: inputs.pagination,
  };
}

function mapOutputCollection(
  outputs: PaginatedCollection<TransactionOutput>,
): PaginatedCollection<TransactionCommandOutputItem> {
  return {
    items: outputs.items.map(output => ({
      amount: createAmountSummary(output.valueSats),
      scriptPubKey: output.scriptPubKey,
      scriptPubKeyAsm: output.scriptPubKeyAsm,
      scriptType: output.scriptPubKeyType,
      scriptAddress: output.scriptPubKeyAddress,
      spent: output.spent,
    })),
    pagination: outputs.pagination,
  };
}

function getConfirmationStatus(confirmed: boolean): "confirmed" | "unconfirmed" {
  return confirmed ? "confirmed" : "unconfirmed";
}

function mapOptionalAmount(valueSats: bigint | null): AmountSummary | null {
  if (valueSats === null) {
    return null;
  }

  return createAmountSummary(valueSats);
}

export async function inspectTransactionCommand(
  input: TransactionCommandInput,
  dependencies: CommandClientDependencies = {},
): Promise<TransactionCommandResult> {
  const pagination = getPagination(input);
  const client = resolveClient(input, dependencies);
  const summary = await client.getTransactionSummary({
    txid: input.txid,
    pagination,
  });

  return {
    txid: summary.txid,
    version: summary.version,
    locktime: summary.locktime,
    confirmationStatus: getConfirmationStatus(summary.confirmed),
    confirmed: summary.confirmed,
    blockHeight: summary.blockHeight,
    blockHash: summary.blockHash,
    blockTime: summary.blockTime,
    timestamp: summary.timestamp,
    vinCount: summary.vinCount,
    voutCount: summary.voutCount,
    totalInput: mapOptionalAmount(summary.totalInputSats),
    totalOutput: createAmountSummary(summary.totalOutputSats),
    fee: mapOptionalAmount(summary.feeSats),
    inputs: mapInputCollection(summary.inputs),
    outputs: mapOutputCollection(summary.outputs),
  };
}
