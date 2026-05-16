import { createExplorerClient } from "../api/provider.js";
import { formatBtcAmount, formatSatsAmount } from "../utils/sats.js";
import { parseBitcoinMainnetAddress } from "../utils/address.js";
import { InvalidPaginationError } from "../utils/errors.js";
import type {
  BitcoinAddressType,
  BitcoinNetwork,
  BitcoinScriptType,
  ExplorerClient,
  ExplorerSource,
  PaginatedCollection,
  PaginationInput,
  Utxo,
} from "../api/types.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;

export interface AddressAmountSummary {
  btc: string;
  sats: string;
  valueSats: bigint;
}

export interface AddressCommandUtxo {
  txid: string;
  vout: number;
  outpoint: string;
  amount: AddressAmountSummary;
  confirmationStatus: "confirmed" | "unconfirmed";
  confirmed: boolean;
  blockHeight: number | null;
  scriptType: BitcoinScriptType;
}

export interface AddressCommandResult {
  address: string;
  network: BitcoinNetwork;
  addressType: BitcoinAddressType;
  totalReceived: AddressAmountSummary;
  totalSpent: AddressAmountSummary;
  balance: AddressAmountSummary;
  utxos: PaginatedCollection<AddressCommandUtxo>;
}

export interface AddressCommandInput {
  address: string;
  source?: ExplorerSource;
  apiUrl?: string;
  page?: number;
  limit?: number;
}

interface AddressCommandDependencies {
  createClient?: (options: {
    source?: ExplorerSource;
    baseUrl?: string;
  }) => ExplorerClient;
}

function createAmountSummary(valueSats: bigint): AddressAmountSummary {
  return {
    btc: formatBtcAmount(valueSats),
    sats: formatSatsAmount(valueSats),
    valueSats,
  };
}

function getPagination(input: AddressCommandInput): PaginationInput {
  const page = input.page ?? DEFAULT_PAGE;
  const limit = input.limit ?? DEFAULT_LIMIT;

  if (!Number.isInteger(page) || page <= 0) {
    throw new InvalidPaginationError({ page });
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new InvalidPaginationError({ limit });
  }

  return { page, limit };
}

function mapUtxoCollection(
  utxos: PaginatedCollection<Utxo>,
): PaginatedCollection<AddressCommandUtxo> {
  return {
    items: utxos.items.map(utxo => ({
      txid: utxo.txid,
      vout: utxo.vout,
      outpoint: `${utxo.txid}:${String(utxo.vout)}`,
      amount: createAmountSummary(utxo.valueSats),
      confirmationStatus: utxo.status.confirmed ? "confirmed" : "unconfirmed",
      confirmed: utxo.status.confirmed,
      blockHeight: utxo.status.blockHeight,
      scriptType: utxo.scriptPubKeyType,
    })),
    pagination: utxos.pagination,
  };
}

function resolveClient(
  input: AddressCommandInput,
  dependencies: AddressCommandDependencies,
): ExplorerClient {
  const createClient = dependencies.createClient ?? createExplorerClient;
  const options: {
    source?: ExplorerSource;
    baseUrl?: string;
  } = {};

  if (input.source !== undefined) {
    options.source = input.source;
  }

  if (input.apiUrl !== undefined) {
    options.baseUrl = input.apiUrl;
  }

  return createClient(options);
}

export async function inspectAddressCommand(
  input: AddressCommandInput,
  dependencies: AddressCommandDependencies = {},
): Promise<AddressCommandResult> {
  const parsedAddress = parseBitcoinMainnetAddress(input.address);
  const client = resolveClient(input, dependencies);
  const summary = await client.getAddressSummary({
    address: parsedAddress.address,
    addressType: parsedAddress.type,
    pagination: getPagination(input),
  });

  return {
    address: summary.address,
    network: summary.network,
    addressType: summary.addressType,
    totalReceived: createAmountSummary(summary.totalReceivedSats),
    totalSpent: createAmountSummary(summary.totalSpentSats),
    balance: createAmountSummary(summary.balanceSats),
    utxos: mapUtxoCollection(summary.utxos),
  };
}
