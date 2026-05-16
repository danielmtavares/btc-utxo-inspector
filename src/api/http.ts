import { NotFoundError, ProviderUnavailableError, ResponseValidationError } from "../utils/errors.js";
import type { ExplorerSource } from "./types.js";

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_INITIAL_BACKOFF_MS = 250;

type FetchLike = typeof fetch;
type SleepFn = (milliseconds: number) => Promise<void>;

export interface HttpClientOptions {
  fetch?: FetchLike;
  sleep?: SleepFn;
  timeoutMs?: number;
  maxAttempts?: number;
  initialBackoffMs?: number;
}

export interface JsonRequestOptions {
  source: ExplorerSource;
  baseUrl: string;
  path: string;
}

export interface HttpClient {
  requestJson(options: JsonRequestOptions): Promise<unknown>;
}

interface ResolvedHttpClientOptions {
  fetch: FetchLike;
  sleep: SleepFn;
  timeoutMs: number;
  maxAttempts: number;
  initialBackoffMs: number;
}

interface RequestContext {
  source: ExplorerSource;
  url: string;
}

function sleepFor(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function getRequestUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRetryableStatus(statusCode: number): boolean {
  return statusCode >= 500 && statusCode < 600;
}

function getProviderDetails(
  source: ExplorerSource,
  url: string,
  extraDetails: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    source,
    endpoint: url,
    ...extraDetails,
  };
}

function resolveHttpClientOptions(options: HttpClientOptions): ResolvedHttpClientOptions {
  return {
    fetch: options.fetch ?? fetch,
    sleep: options.sleep ?? sleepFor,
    timeoutMs: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    initialBackoffMs: options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS,
  };
}

function createRequestContext(request: JsonRequestOptions): RequestContext {
  return {
    source: request.source,
    url: getRequestUrl(request.baseUrl, request.path),
  };
}

function getBackoffDelay(initialBackoffMs: number, attempt: number): number {
  return initialBackoffMs * 2 ** (attempt - 1);
}

function hasRemainingAttempts(attempt: number, maxAttempts: number): boolean {
  return attempt < maxAttempts;
}

async function waitForRetry(
  sleep: SleepFn,
  initialBackoffMs: number,
  attempt: number,
): Promise<void> {
  await sleep(getBackoffDelay(initialBackoffMs, attempt));
}

function createRequestInit(signal: AbortSignal): RequestInit {
  return {
    headers: {
      accept: "application/json",
    },
    method: "GET",
    signal,
  };
}

function throwHttpErrorResponse(
  response: Response,
  context: RequestContext,
): never {
  if (response.status === 404) {
    throw new NotFoundError("Requested resource not found", {
      ...getProviderDetails(context.source, context.url, { statusCode: response.status }),
    });
  }

  throw new ProviderUnavailableError(
    `Provider request failed with status ${String(response.status)}`,
    {
      ...getProviderDetails(context.source, context.url, { statusCode: response.status }),
    },
  );
}

async function performRequestAttempt(
  context: RequestContext,
  options: ResolvedHttpClientOptions,
): Promise<Response> {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort();
  }, options.timeoutMs);

  try {
    return await options.fetch(context.url, createRequestInit(abortController.signal));
  }
  finally {
    clearTimeout(timeoutHandle);
  }
}

async function retryAttempt(
  options: ResolvedHttpClientOptions,
  attempt: number,
): Promise<void> {
  await waitForRetry(options.sleep, options.initialBackoffMs, attempt);
}

async function retryOnStatusCode(
  response: Response,
  options: ResolvedHttpClientOptions,
  attempt: number,
): Promise<boolean> {
  if (!isRetryableStatus(response.status)) {
    return false;
  }

  if (!hasRemainingAttempts(attempt, options.maxAttempts)) {
    return false;
  }

  await retryAttempt(options, attempt);
  return true;
}

function throwTimeoutError(context: RequestContext, timeoutMs: number): never {
  throw new ProviderUnavailableError("Provider request timed out", {
    ...getProviderDetails(context.source, context.url, { timeoutMs }),
  });
}

function throwNetworkError(context: RequestContext, error: unknown): never {
  const message = error instanceof Error ? error.message : "Unknown network failure";

  throw new ProviderUnavailableError("Provider request failed", {
    ...getProviderDetails(context.source, context.url, { message }),
  });
}

async function parseJsonResponse(response: Response, context: RequestContext): Promise<unknown> {
  try {
    return await response.json();
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to parse JSON response";

    throw new ResponseValidationError("Provider returned invalid JSON", {
      ...getProviderDetails(context.source, context.url, { message }),
    });
  }
}

async function handleAttemptError(
  context: RequestContext,
  error: unknown,
  options: ResolvedHttpClientOptions,
  attempt: number,
): Promise<void> {
  if (
    error instanceof NotFoundError
    || error instanceof ProviderUnavailableError
    || error instanceof ResponseValidationError
  ) {
    throw error;
  }

  if (hasRemainingAttempts(attempt, options.maxAttempts)) {
    await retryAttempt(options, attempt);
    return;
  }

  if (isTimeoutError(error)) {
    throwTimeoutError(context, options.timeoutMs);
  }

  throwNetworkError(context, error);
}

async function executeRequestWithRetries(
  context: RequestContext,
  options: ResolvedHttpClientOptions,
): Promise<unknown> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = await performRequestAttempt(context, options);

      if (response.ok) {
        return await parseJsonResponse(response, context);
      }

      if (await retryOnStatusCode(response, options, attempt)) {
        continue;
      }

      throwHttpErrorResponse(response, context);
    }
    catch (error: unknown) {
      await handleAttemptError(context, error, options, attempt);
    }
  }

  throw new ProviderUnavailableError(
    "Provider request failed after retries",
    getProviderDetails(context.source, context.url),
  );
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const resolvedOptions = resolveHttpClientOptions(options);

  return {
    async requestJson(request): Promise<unknown> {
      return await executeRequestWithRetries(
        createRequestContext(request),
        resolvedOptions,
      );
    },
  };
}
