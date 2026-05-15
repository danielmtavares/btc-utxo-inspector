import { z } from "zod";
import { ResponseValidationError } from "../utils/errors.js";
import { paginateItems } from "../utils/pagination.js";
import {
  BlockstreamAddressSchema,
  BlockstreamTxSchema,
  BlockstreamUtxoSchema,
} from "./schemas.js";
import {
  createHttpClient,
  DEFAULT_INITIAL_BACKOFF_MS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./http.js";
import type {
  AddressStatistics,
  AddressSummary,
  AddressSummaryRequest,
  BitcoinScriptType,
  ExplorerClient,
  TransactionInput,
  TransactionOutput,
  TransactionSummary,
  TransactionSummaryRequest,
  Utxo,
  UtxoStatus,
} from "./types.js";

export const DEFAULT_BLOCKSTREAM_API_URL = "https://blockstream.info/api";

type FetchLike = typeof fetch;
type SleepFn = (milliseconds: number) => Promise<void>;

export interface BlockstreamClientOptions {
  baseUrl?: string;
  fetch?: FetchLike;
  sleep?: SleepFn;
  timeoutMs?: number;
  maxAttempts?: number;
  initialBackoffMs?: number;
}

function toScriptType(value: string): BitcoinScriptType {
  switch (value) {
    case "p2pkh":
    case "p2sh":
    case "p2wpkh":
    case "p2wsh":
    case "p2tr":
      return value;
    default:
      return "unknown";
  }
}

function toAddressStatistics(stats: z.infer<typeof BlockstreamAddressSchema.shape.chain_stats>): AddressStatistics {
  return {
    fundedTxoCount: stats.funded_txo_count,
    fundedTxoSats: BigInt(stats.funded_txo_sum),
    spentTxoCount: stats.spent_txo_count,
    spentTxoSats: BigInt(stats.spent_txo_sum),
    transactionCount: stats.tx_count,
  };
}

function toUtxoStatus(status: z.infer<typeof BlockstreamUtxoSchema.shape.status>): UtxoStatus {
  return {
    confirmed: status.confirmed,
    blockHeight: status.block_height ?? null,
    blockHash: status.block_hash ?? null,
    blockTime: status.block_time ?? null,
  };
}

function toTransactionOutput(
  output: z.infer<typeof BlockstreamTxSchema.shape.vout>[number]
    | z.infer<typeof BlockstreamTxSchema.shape.vin>[number]["prevout"],
): TransactionOutput {
  if (output === null || output === undefined) {
    throw new ResponseValidationError("Transaction output data is missing");
  }

  return {
    valueSats: BigInt(output.value),
    scriptPubKey: output.scriptpubkey,
    scriptPubKeyAsm: output.scriptpubkey_asm,
    scriptPubKeyType: toScriptType(output.scriptpubkey_type),
    scriptPubKeyAddress: output.scriptpubkey_address ?? null,
    spent: null,
  };
}

function toTransactionInput(input: z.infer<typeof BlockstreamTxSchema.shape.vin>[number]): TransactionInput {
  return {
    txid: input.txid ?? null,
    vout: input.vout ?? null,
    isCoinbase: input.is_coinbase ?? input.coinbase !== undefined,
    sequence: input.sequence,
    scriptSigAsm: input.scriptsig_asm ?? null,
    witness: input.witness ?? [],
    prevout: input.prevout ? toTransactionOutput(input.prevout) : null,
  };
}

function toTimestamp(blockTime: number | null): string | null {
  if (blockTime === null) {
    return null;
  }

  return new Date(blockTime * 1000).toISOString();
}

function parseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  payload: unknown,
  resource: string,
): z.infer<TSchema> {
  const result = schema.safeParse(payload);

  if (result.success) {
    return result.data;
  }

  throw new ResponseValidationError(`Invalid Blockstream response for ${resource}`, {
    issues: z.treeifyError(result.error),
  });
}

export function createBlockstreamClient(options: BlockstreamClientOptions = {}): ExplorerClient {
  const httpClientOptions = {
    timeoutMs: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    initialBackoffMs: options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS,
  };

  if (options.fetch !== undefined) {
    Object.assign(httpClientOptions, { fetch: options.fetch });
  }

  if (options.sleep !== undefined) {
    Object.assign(httpClientOptions, { sleep: options.sleep });
  }

  const httpClient = createHttpClient(httpClientOptions);
  const baseUrl = options.baseUrl ?? DEFAULT_BLOCKSTREAM_API_URL;

  return {
    async getAddressSummary(request: AddressSummaryRequest): Promise<AddressSummary> {
      const addressPayload = await httpClient.requestJson({
        source: "blockstream",
        baseUrl,
        path: `/address/${request.address}`,
      });
      const utxosPayload = await httpClient.requestJson({
        source: "blockstream",
        baseUrl,
        path: `/address/${request.address}/utxo`,
      });
      const addressResponse = parseWithSchema(
        BlockstreamAddressSchema,
        addressPayload,
        "address summary",
      );
      const utxoResponse = parseWithSchema(
        z.array(BlockstreamUtxoSchema),
        utxosPayload,
        "address utxos",
      );
      const chainStats = toAddressStatistics(addressResponse.chain_stats);
      const mempoolStats = toAddressStatistics(addressResponse.mempool_stats);
      const normalizedUtxos: Utxo[] = utxoResponse.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        valueSats: BigInt(utxo.value),
        status: toUtxoStatus(utxo.status),
        scriptPubKeyType: "unknown",
        scriptPubKeyAddress: null,
      }));
      const totalReceivedSats = chainStats.fundedTxoSats + mempoolStats.fundedTxoSats;
      const totalSpentSats = chainStats.spentTxoSats + mempoolStats.spentTxoSats;

      return {
        address: request.address,
        network: "mainnet",
        addressType: request.addressType,
        chainStats,
        mempoolStats,
        totalReceivedSats,
        totalSpentSats,
        balanceSats: totalReceivedSats - totalSpentSats,
        utxos: paginateItems(normalizedUtxos, request.pagination),
      };
    },

    async getTransactionSummary(request: TransactionSummaryRequest): Promise<TransactionSummary> {
      const transactionPayload = await httpClient.requestJson({
        source: "blockstream",
        baseUrl,
        path: `/tx/${request.txid}`,
      });
      const transaction = parseWithSchema(
        BlockstreamTxSchema,
        transactionPayload,
        "transaction details",
      );
      const inputs = transaction.vin.map(toTransactionInput);
      const outputs = transaction.vout.map(toTransactionOutput);
      const totalInputSats = transaction.vin.every(input => input.prevout !== undefined && input.prevout !== null)
        ? transaction.vin.reduce<bigint>((total, input) => total + BigInt(input.prevout?.value ?? 0), 0n)
        : null;
      const totalOutputSats = transaction.vout.reduce<bigint>(
        (total, output) => total + BigInt(output.value),
        0n,
      );

      return {
        txid: transaction.txid,
        version: transaction.version,
        locktime: transaction.locktime,
        confirmed: transaction.status.confirmed,
        blockHeight: transaction.status.block_height ?? null,
        blockHash: transaction.status.block_hash ?? null,
        blockTime: transaction.status.block_time ?? null,
        timestamp: toTimestamp(transaction.status.block_time ?? null),
        vinCount: transaction.vin.length,
        voutCount: transaction.vout.length,
        totalInputSats,
        totalOutputSats,
        feeSats: transaction.fee === undefined ? null : BigInt(transaction.fee),
        inputs: paginateItems(inputs, request.pagination),
        outputs: paginateItems(outputs, request.pagination),
      };
    },
  };
}
