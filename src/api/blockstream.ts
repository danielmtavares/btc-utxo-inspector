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

type BlockstreamAddressResponse = z.infer<typeof BlockstreamAddressSchema>;
type BlockstreamUtxoResponse = z.infer<typeof BlockstreamUtxoSchema>;
type BlockstreamTransactionResponse = z.infer<typeof BlockstreamTxSchema>;

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

function createHttpClientOptions(options: BlockstreamClientOptions) {
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

  return httpClientOptions;
}

function getBaseUrl(options: BlockstreamClientOptions): string {
  return options.baseUrl ?? DEFAULT_BLOCKSTREAM_API_URL;
}

function normalizeUtxo(utxo: BlockstreamUtxoResponse): Utxo {
  return {
    txid: utxo.txid,
    vout: utxo.vout,
    valueSats: BigInt(utxo.value),
    status: toUtxoStatus(utxo.status),
    scriptPubKeyType: "unknown",
    scriptPubKeyAddress: null,
  };
}

function toBalanceSummary(
  chainStats: AddressStatistics,
  mempoolStats: AddressStatistics,
): Pick<AddressSummary, "totalReceivedSats" | "totalSpentSats" | "balanceSats"> {
  const totalReceivedSats = chainStats.fundedTxoSats + mempoolStats.fundedTxoSats;
  const totalSpentSats = chainStats.spentTxoSats + mempoolStats.spentTxoSats;

  return {
    totalReceivedSats,
    totalSpentSats,
    balanceSats: totalReceivedSats - totalSpentSats,
  };
}

function toAddressSummary(
  request: AddressSummaryRequest,
  addressResponse: BlockstreamAddressResponse,
  utxos: BlockstreamUtxoResponse[],
): AddressSummary {
  const chainStats = toAddressStatistics(addressResponse.chain_stats);
  const mempoolStats = toAddressStatistics(addressResponse.mempool_stats);
  const normalizedUtxos = utxos.map(normalizeUtxo);

  return {
    address: request.address,
    network: "mainnet",
    addressType: request.addressType,
    chainStats,
    mempoolStats,
    ...toBalanceSummary(chainStats, mempoolStats),
    utxos: paginateItems(normalizedUtxos, request.pagination),
  };
}

function getTotalInputSats(transaction: BlockstreamTransactionResponse): bigint | null {
  if (!transaction.vin.every(input => input.prevout !== undefined && input.prevout !== null)) {
    return null;
  }

  return transaction.vin.reduce<bigint>(
    (total, input) => total + BigInt(input.prevout?.value ?? 0),
    0n,
  );
}

function getTotalOutputSats(transaction: BlockstreamTransactionResponse): bigint {
  return transaction.vout.reduce<bigint>(
    (total, output) => total + BigInt(output.value),
    0n,
  );
}

function toTransactionSummary(
  request: TransactionSummaryRequest,
  transaction: BlockstreamTransactionResponse,
): TransactionSummary {
  const inputs = transaction.vin.map(toTransactionInput);
  const outputs = transaction.vout.map(toTransactionOutput);

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
    totalInputSats: getTotalInputSats(transaction),
    totalOutputSats: getTotalOutputSats(transaction),
    feeSats: transaction.fee === undefined ? null : BigInt(transaction.fee),
    inputs: paginateItems(inputs, request.pagination),
    outputs: paginateItems(outputs, request.pagination),
  };
}

function createBlockstreamRequestPath(resource: "address" | "utxo" | "tx", value: string): string {
  switch (resource) {
    case "address":
      return `/address/${value}`;
    case "utxo":
      return `/address/${value}/utxo`;
    case "tx":
      return `/tx/${value}`;
  }
}

async function fetchBlockstreamResource<TSchema extends z.ZodType>(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
  path: string,
  schema: TSchema,
  resource: string,
): Promise<z.infer<TSchema>> {
  const payload = await httpClient.requestJson({
    source: "blockstream",
    baseUrl,
    path,
  });

  return parseWithSchema(schema, payload, resource);
}

async function fetchAddressResponse(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
  address: string,
): Promise<BlockstreamAddressResponse> {
  return await fetchBlockstreamResource(
    httpClient,
    baseUrl,
    createBlockstreamRequestPath("address", address),
    BlockstreamAddressSchema,
    "address summary",
  );
}

async function fetchUtxosResponse(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
  address: string,
): Promise<BlockstreamUtxoResponse[]> {
  return await fetchBlockstreamResource(
    httpClient,
    baseUrl,
    createBlockstreamRequestPath("utxo", address),
    z.array(BlockstreamUtxoSchema),
    "address utxos",
  );
}

async function fetchTransactionResponse(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
  txid: string,
): Promise<BlockstreamTransactionResponse> {
  return await fetchBlockstreamResource(
    httpClient,
    baseUrl,
    createBlockstreamRequestPath("tx", txid),
    BlockstreamTxSchema,
    "transaction details",
  );
}

async function getAddressSummary(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
  request: AddressSummaryRequest,
): Promise<AddressSummary> {
  const [addressResponse, utxosResponse] = await Promise.all([
    fetchAddressResponse(httpClient, baseUrl, request.address),
    fetchUtxosResponse(httpClient, baseUrl, request.address),
  ]);

  return toAddressSummary(request, addressResponse, utxosResponse);
}

async function getTransactionSummary(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
  request: TransactionSummaryRequest,
): Promise<TransactionSummary> {
  const transaction = await fetchTransactionResponse(httpClient, baseUrl, request.txid);
  return toTransactionSummary(request, transaction);
}

export function createBlockstreamClient(options: BlockstreamClientOptions = {}): ExplorerClient {
  const httpClient = createHttpClient(createHttpClientOptions(options));
  const baseUrl = getBaseUrl(options);

  return {
    async getAddressSummary(request: AddressSummaryRequest): Promise<AddressSummary> {
      return await getAddressSummary(httpClient, baseUrl, request);
    },

    async getTransactionSummary(request: TransactionSummaryRequest): Promise<TransactionSummary> {
      return await getTransactionSummary(httpClient, baseUrl, request);
    },
  };
}
