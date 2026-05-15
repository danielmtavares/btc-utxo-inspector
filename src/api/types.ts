export type ExplorerSource = "blockstream";

export type BitcoinNetwork = "mainnet";

export type BitcoinAddressType = "p2pkh" | "p2sh" | "p2wpkh" | "p2wsh" | "p2tr";

export type BitcoinScriptType =
  | "p2pkh"
  | "p2sh"
  | "p2wpkh"
  | "p2wsh"
  | "p2tr"
  | "unknown";

export type ProviderErrorKind =
  | "network"
  | "timeout"
  | "not_found"
  | "validation"
  | "unexpected";

export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  startIndex: number;
  endIndex: number;
}

export interface PaginatedCollection<T> {
  items: T[];
  pagination: PaginationMetadata;
}

export interface AddressStatistics {
  fundedTxoCount: number;
  fundedTxoSats: bigint;
  spentTxoCount: number;
  spentTxoSats: bigint;
  transactionCount: number;
}

export interface ProviderError {
  source: ExplorerSource;
  kind: ProviderErrorKind;
  message: string;
  statusCode?: number;
  endpoint?: string;
  details?: Record<string, unknown>;
}

export interface UtxoStatus {
  confirmed: boolean;
  blockHeight: number | null;
  blockHash: string | null;
  blockTime: number | null;
}

export interface Utxo {
  txid: string;
  vout: number;
  valueSats: bigint;
  status: UtxoStatus;
  scriptPubKeyType: BitcoinScriptType;
  scriptPubKeyAddress: string | null;
}

export interface AddressSummary {
  address: string;
  network: BitcoinNetwork;
  addressType: BitcoinAddressType;
  chainStats: AddressStatistics;
  mempoolStats: AddressStatistics;
  totalReceivedSats: bigint;
  totalSpentSats: bigint;
  balanceSats: bigint;
  utxos: PaginatedCollection<Utxo>;
}

export interface TransactionOutput {
  valueSats: bigint;
  scriptPubKey: string;
  scriptPubKeyAsm: string | null;
  scriptPubKeyType: BitcoinScriptType;
  scriptPubKeyAddress: string | null;
  spent: boolean;
}

export interface TransactionInput {
  txid: string | null;
  vout: number | null;
  isCoinbase: boolean;
  sequence: number;
  scriptSigAsm: string | null;
  witness: string[];
  prevout: TransactionOutput | null;
}

export interface TransactionSummary {
  txid: string;
  version: number;
  locktime: number;
  confirmed: boolean;
  blockHeight: number | null;
  blockHash: string | null;
  blockTime: number | null;
  timestamp: string | null;
  vinCount: number;
  voutCount: number;
  totalInputSats: bigint | null;
  totalOutputSats: bigint;
  feeSats: bigint | null;
  inputs: PaginatedCollection<TransactionInput>;
  outputs: PaginatedCollection<TransactionOutput>;
}

export type AppErrorCode =
  | "INVALID_ADDRESS"
  | "INVALID_PAGINATION"
  | "NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "RESPONSE_VALIDATION_FAILURE"
  | "UNEXPECTED_ERROR";
