import { createExplorerClient } from "../api/provider.js";
import type { ExplorerClient, ExplorerSource, PaginationInput } from "../api/types.js";
import { InvalidPaginationError } from "../utils/errors.js";
import { formatBtcAmount, formatSatsAmount } from "../utils/sats.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;

export interface AmountSummary {
  btc: string;
  sats: string;
  valueSats: bigint;
}

export interface CommandClientInput {
  source?: ExplorerSource;
  apiUrl?: string;
}

export interface CommandClientDependencies {
  createClient?: (options: { source?: ExplorerSource; baseUrl?: string }) => ExplorerClient;
}

export interface PaginationCommandInput {
  page?: number;
  limit?: number;
}

export function createAmountSummary(valueSats: bigint): AmountSummary {
  return {
    btc: formatBtcAmount(valueSats),
    sats: formatSatsAmount(valueSats),
    valueSats,
  };
}

export function getPagination(input: PaginationCommandInput): PaginationInput {
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

export function resolveClient(
  input: CommandClientInput,
  dependencies: CommandClientDependencies,
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
