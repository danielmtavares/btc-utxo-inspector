import type { PaginatedCollection, PaginationInput, PaginationMetadata } from "../api/types.js";
import { InvalidPaginationError } from "./errors.js";

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new InvalidPaginationError({ [name]: value });
  }
}

export function createPaginationMetadata(
  total: number,
  page: number,
  limit: number,
): PaginationMetadata {
  assertPositiveInteger("page", page);
  assertPositiveInteger("limit", limit);

  if (!Number.isInteger(total) || total < 0) {
    throw new InvalidPaginationError({ total });
  }

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const startIndex = total === 0 ? 0 : Math.min((page - 1) * limit, total);
  const endIndex = total === 0 ? 0 : Math.min(startIndex + limit, total);

  return {
    page,
    limit,
    total,
    totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
    hasNextPage: totalPages > 0 && page < totalPages,
    startIndex,
    endIndex,
  };
}

export function paginateItems<T>(
  items: readonly T[],
  options: PaginationInput,
): PaginatedCollection<T> {
  const metadata = createPaginationMetadata(items.length, options.page, options.limit);

  if (items.length === 0) {
    return {
      items: [],
      pagination: metadata,
    };
  }

  const start = metadata.startIndex;
  const end = metadata.endIndex;

  return {
    items: items.slice(start, end),
    pagination: metadata,
  };
}
