import { describe, expect, it } from "vitest";
import { InvalidPaginationError } from "../src/utils/errors.js";
import { createPaginationMetadata, paginateItems } from "../src/utils/pagination.js";

describe("pagination helpers", () => {
  it("creates pagination metadata", () => {
    expect(createPaginationMetadata(10, 1, 3)).toEqual({
      page: 1,
      limit: 3,
      total: 10,
      totalPages: 4,
      hasPreviousPage: false,
      hasNextPage: true,
      startIndex: 0,
      endIndex: 3,
    });
  });

  it("paginates an array", () => {
    const result = paginateItems([1, 2, 3, 4, 5], { page: 2, limit: 2 });

    expect(result.items).toEqual([3, 4]);
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it("rejects invalid pagination parameters", () => {
    expect(() => createPaginationMetadata(10, 0, 2)).toThrow(InvalidPaginationError);
    expect(() => createPaginationMetadata(10, 1, 0)).toThrow(InvalidPaginationError);
  });
});

