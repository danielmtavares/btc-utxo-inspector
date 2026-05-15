import type { AppErrorCode } from "../api/types.js";

export const EXIT_CODES = {
  success: 0,
  unexpectedError: 1,
  invalidInput: 2,
  notFound: 3,
  providerFailure: 4,
  validationFailure: 5,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export interface ErrorEnvelope {
  error: {
    code: AppErrorCode;
    message: string;
    details: Record<string, unknown>;
  };
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly exitCode: ExitCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    exitCode: ExitCode,
    details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export class InvalidAddressError extends AppError {
  constructor(address: string, details: Record<string, unknown> = {}) {
    super(
      "INVALID_ADDRESS",
      `Invalid Bitcoin mainnet address: ${address}`,
      EXIT_CODES.invalidInput,
      { address, ...details },
    );
  }
}

export class InvalidPaginationError extends AppError {
  constructor(details: Record<string, unknown> = {}) {
    super(
      "INVALID_PAGINATION",
      "Invalid pagination parameters",
      EXIT_CODES.invalidInput,
      details,
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Requested resource not found", details: Record<string, unknown> = {}) {
    super("NOT_FOUND", message, EXIT_CODES.notFound, details);
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(message = "Provider unavailable", details: Record<string, unknown> = {}) {
    super("PROVIDER_UNAVAILABLE", message, EXIT_CODES.providerFailure, details);
  }
}

export class ResponseValidationError extends AppError {
  constructor(message = "Provider response validation failed", details: Record<string, unknown> = {}) {
    super(
      "RESPONSE_VALIDATION_FAILURE",
      message,
      EXIT_CODES.validationFailure,
      details,
    );
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getExitCode(error: unknown): ExitCode {
  return isAppError(error) ? error.exitCode : EXIT_CODES.unexpectedError;
}

export function toErrorEnvelope(error: unknown): ErrorEnvelope {
  if (isAppError(error)) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected error";

  return {
    error: {
      code: "UNEXPECTED_ERROR",
      message,
      details: {},
    },
  };
}

