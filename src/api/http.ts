import { NotFoundError, ProviderUnavailableError } from "../utils/errors.js";
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

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const requestFetch = options.fetch ?? fetch;
  const requestSleep = options.sleep ?? sleepFor;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialBackoffMs = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;

  return {
    async requestJson(request): Promise<unknown> {
      const url = getRequestUrl(request.baseUrl, request.path);

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const abortController = new AbortController();
        const timeoutHandle = setTimeout(() => {
          abortController.abort();
        }, timeoutMs);

        try {
          const response = await requestFetch(url, {
            headers: {
              accept: "application/json",
            },
            method: "GET",
            signal: abortController.signal,
          });

          if (response.ok) {
            return await response.json();
          }

          if (response.status === 404) {
            throw new NotFoundError("Requested resource not found", {
              ...getProviderDetails(request.source, url, { statusCode: response.status }),
            });
          }

          if (isRetryableStatus(response.status) && attempt < maxAttempts) {
            await requestSleep(initialBackoffMs * 2 ** (attempt - 1));
            continue;
          }

          throw new ProviderUnavailableError(
            `Provider request failed with status ${String(response.status)}`,
            {
              ...getProviderDetails(request.source, url, { statusCode: response.status }),
            },
          );
        }
        catch (error: unknown) {
          if (error instanceof NotFoundError || error instanceof ProviderUnavailableError) {
            throw error;
          }

          if (isTimeoutError(error)) {
            if (attempt < maxAttempts) {
              await requestSleep(initialBackoffMs * 2 ** (attempt - 1));
              continue;
            }

            throw new ProviderUnavailableError("Provider request timed out", {
              ...getProviderDetails(request.source, url, { timeoutMs }),
            });
          }

          if (attempt < maxAttempts) {
            await requestSleep(initialBackoffMs * 2 ** (attempt - 1));
            continue;
          }

          const message = error instanceof Error ? error.message : "Unknown network failure";

          throw new ProviderUnavailableError("Provider request failed", {
            ...getProviderDetails(request.source, url, { message }),
          });
        }
        finally {
          clearTimeout(timeoutHandle);
        }
      }

      throw new ProviderUnavailableError("Provider request failed after retries", getProviderDetails(request.source, url));
    },
  };
}
