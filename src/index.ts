export { packageVersion } from "./version.js";
export { createCli } from "./cli.js";
export {
  inspectAddressCommand,
} from "./commands/address.js";
export type {
  AddressSummaryRequest,
  AddressStatistics,
  AddressSummary,
  AppErrorCode,
  BitcoinAddressType,
  BitcoinNetwork,
  BitcoinScriptType,
  ExplorerClient,
  ExplorerSource,
  PaginatedCollection,
  PaginationInput,
  PaginationMetadata,
  ProviderError,
  ProviderErrorKind,
  TransactionSummaryRequest,
  TransactionInput,
  TransactionOutput,
  TransactionSummary,
  Utxo,
  UtxoStatus,
} from "./api/types.js";
export type {
  AddressAmountSummary,
  AddressCommandInput,
  AddressCommandResult,
  AddressCommandUtxo,
} from "./commands/address.js";
export {
  createBlockstreamClient,
  DEFAULT_BLOCKSTREAM_API_URL,
} from "./api/blockstream.js";
export {
  createExplorerClient,
} from "./api/provider.js";
export {
  createHttpClient,
  DEFAULT_INITIAL_BACKOFF_MS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./api/http.js";
export {
  parseBitcoinMainnetAddress,
  isBitcoinMainnetAddress,
} from "./utils/address.js";
export {
  AppError,
  EXIT_CODES,
  InvalidAddressError,
  InvalidPaginationError,
  NotFoundError,
  ProviderUnavailableError,
  ResponseValidationError,
  getExitCode,
  toErrorEnvelope,
} from "./utils/errors.js";
export {
  createPaginationMetadata,
  paginateItems,
} from "./utils/pagination.js";
export {
  btcToSats,
  formatBtcAmount,
  formatSatsAmount,
  satsToBtcString,
} from "./utils/sats.js";
