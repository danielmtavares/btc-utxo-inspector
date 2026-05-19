import { describe, expect, it } from "vitest";

import {
  EXIT_CODES,
  InvalidAddressError,
  InvalidPaginationError,
  NotFoundError,
  ProviderUnavailableError,
  ResponseValidationError,
  getExitCode,
  toErrorEnvelope,
} from "../src/utils/errors.js";

describe("error helpers", () => {
  it("maps custom errors to exit codes", () => {
    expect(getExitCode(new InvalidAddressError("bad"))).toBe(EXIT_CODES.invalidInput);
    expect(getExitCode(new InvalidPaginationError())).toBe(EXIT_CODES.invalidInput);
    expect(getExitCode(new NotFoundError())).toBe(EXIT_CODES.notFound);
    expect(getExitCode(new ProviderUnavailableError())).toBe(EXIT_CODES.providerFailure);
    expect(getExitCode(new ResponseValidationError())).toBe(EXIT_CODES.validationFailure);
  });

  it("serializes app errors into the error envelope", () => {
    expect(toErrorEnvelope(new InvalidAddressError("bad"))).toEqual({
      error: {
        code: "INVALID_ADDRESS",
        message: "Invalid Bitcoin mainnet address: bad",
        details: { address: "bad" },
      },
    });
  });

  it("falls back to an unexpected error envelope", () => {
    expect(toErrorEnvelope(new Error("boom"))).toEqual({
      error: {
        code: "UNEXPECTED_ERROR",
        message: "boom",
        details: {},
      },
    });
  });
});
