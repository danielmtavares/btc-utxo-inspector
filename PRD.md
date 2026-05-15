# BTC UTXO Inspector - Product Requirements Document

**Version:** 0.1
**Status:** Draft
**Author:** Daniel

---

## 1. Overview

`btc-utxo-inspector` is a CLI tool written in TypeScript that inspects a Bitcoin mainnet address and summarizes its UTXOs and balance. It also supports looking up individual transactions by txid. It is designed to be installable, testable, and readable — demonstrating clean API design, typed data modeling, reusable library exports, and developer-facing CLI ergonomics.

---

## 2. User Stories

### Developer / CLI User
- As a developer, I want to pass a Bitcoin address and immediately see its balance breakdown, so I can audit it without navigating a block explorer UI.
- As a developer, I want to list all UTXOs for an address, so I can understand the unspent output distribution.
- As a developer, I want invalid Bitcoin addresses rejected before the CLI calls an external API, so failures are fast and clear.
- As a developer, I want to look up a specific transaction by its txid, so I can inspect inputs, outputs, fees, and confirmation status.
- As a developer, I want to output results as JSON, so I can pipe the CLI into scripts or other tooling.
- As a developer, I want clear, readable terminal output by default, so the tool is usable interactively without flags.
- As a developer, I want to install the CLI locally with a single command and have it work immediately, so I can evaluate or use it without friction.
- As a developer, I want a clear README with example commands and output, so I can understand the tool's scope without reading the source.
- As a developer, I want typed API responses, reusable library functions, and tested utility logic, so I can trust the output and extend the tool with confidence.

---

## 3. MVP Features

### MVP Scope

**Included**
- Bitcoin mainnet address inspection only
- Address balance and UTXO summaries
- Transaction lookup by txid
- Human-readable terminal output by default
- JSON output with `--json`
- Blockstream Esplora provider implementation
- Provider abstraction for future providers
- Local invalid-address validation before provider calls
- Mocked integration tests using deterministic fixtures
- Publish-ready package with CLI binary and reusable library exports

**Not Included**
- Testnet, signet, regtest, or wallet import support
- Address-level recent transaction history
- mempool.space provider implementation
- Live public API calls in automated tests
- npm publishing as part of MVP completion

### Commands

| Command | Description |
|---|---|
| `btc-utxo-inspector address <address>` | Fetch and display address balance and UTXO summary |
| `btc-utxo-inspector tx <txid>` | Fetch and display transaction details |

### Command Contracts

`btc-utxo-inspector address <address>`
- Validates the address locally as a supported Bitcoin mainnet address before any provider request.
- Fetches address stats and UTXOs from the configured provider.
- Displays balance fields and paginated UTXOs only.
- Does not display recent transaction history.

`btc-utxo-inspector tx <txid>`
- Fetches one transaction from the configured provider.
- Displays transaction-level details, including inputs and outputs.
- Displays fee only when the provider directly returns fee data.

### Address Summary Output
- Bitcoin address
- Total received in BTC and sats
- Total spent in BTC and sats
- Current balance in BTC and sats
- Paginated UTXO list with:
  - Amount in BTC and sats
  - `txid:vout` reference
  - Confirmation status
  - Block height, when confirmed
  - Script type, when available

Large UTXO sets must be limited by default and support pagination flags so the CLI remains readable and script-friendly. Address output does not include recent transaction activity; transaction details are handled by `tx <txid>`.

### Transaction Summary Output
- Transaction ID
- Confirmation status and block height
- Timestamp, when available
- Input count and full input details
- Output count and full output details
- Total input value, when available directly from the provider
- Total output value
- Fee in sats and BTC, only when provided directly by the API

Large input or output sets must be limited by default and support pagination flags.

### Flags
- `--json` — emit machine-readable JSON to stdout
- `--source blockstream` — select the data provider; Blockstream is the only implemented MVP provider
- `--api-url <url>` — override the provider base URL for tests, local mocks, and future network support
- `--limit <number>` — limit displayed UTXOs, inputs, outputs, or other pageable collections
- `--page <number>` — select a page for pageable collections

Human-readable terminal output is the default. JSON is selected only with `--json`; no separate table/json format flag is required for MVP.

Errors must be written to stderr. When `--json` is set, errors must be emitted as JSON.

### Pagination
- `--limit` defaults to `25`.
- `--page` defaults to `1` and is 1-based.
- Pagination applies to address UTXOs and transaction inputs/outputs.
- JSON output must include pagination metadata for paginated collections:

```json
{
  "page": 1,
  "limit": 25,
  "total": 100,
  "hasNextPage": true
}
```

### Data Source
- Primary MVP provider: Blockstream Esplora public API (`https://blockstream.info/api`)
- The codebase must define a provider abstraction so additional providers, such as mempool.space, can be added later without changing command behavior.
- Provider responses must be normalized into internal domain models before rendering output.
- The provider base URL must be configurable for tests, local mocks, and future testnet support.
- HTTP requests must support timeout and retry behavior with exponential backoff.

### Retry and Timeout Behavior
- Request timeout defaults to 10 seconds.
- Retry attempts default to 3 total attempts.
- Backoff should be exponential, starting around 250ms.
- Retry only network errors, timeouts, and 5xx provider responses.
- Do not retry invalid input, local validation failures, 404 not found responses, or zod response validation failures.

### Address Support
- Bitcoin mainnet only for MVP.
- Supported address formats:
  - Legacy P2PKH (`1...`)
  - Nested SegWit P2SH (`3...`)
  - Native SegWit P2WPKH/P2WSH (`bc1q...`)
  - Taproot P2TR (`bc1p...`)
- Invalid addresses must be rejected locally before any provider request is made.

### Exit Codes
- `0` — success
- `1` — unexpected runtime error
- `2` — invalid input, including invalid Bitcoin address or malformed txid
- `3` — requested address or transaction not found
- `4` — provider failure, including network failure, timeout after retries, or retryable provider outage
- `5` — response validation failure
- Exit codes should be documented in the README.

### JSON Error Shape

When `--json` is set, errors must be emitted to stderr using this shape:

```json
{
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Invalid Bitcoin mainnet address",
    "details": {}
  }
}
```

Error `code` values should be stable strings suitable for scripting.

### Public Library Exports

The package should expose reusable library functions and types for:
- Address validation
- Sats/BTC formatting and conversion
- Provider client creation
- Address summary fetching
- Transaction fetching
- Normalized domain types

---

## 4. Tech Stack

### Core
| Tool | Purpose |
|---|---|
| TypeScript | Primary language |
| Node.js 24.15.0+ | Runtime |
| `commander` | CLI argument and flag parsing |
| Native `fetch` | HTTP requests (built into Node 24.15.0+) |
| `zod` | Runtime validation of API responses |
| `chalk` | Terminal color and styling |
| `tsx` | Run TypeScript directly during development |
| `tsup` | Bundle and compile for distribution |
| `vitest` | Unit and integration testing |

### Stack Notes & Pitfalls

**`zod` for API response validation**
Using `zod` to validate the shape of API responses is a strong signal for a TypeScript SDK role — it mirrors the kind of defensive data modeling you'd write in a production SDK. The tradeoff is a small bundle size cost, but for a CLI it's negligible and the practice is worth demonstrating.

**`commander` vs `yargs` vs `meow`**
`commander` is the most straightforward for a small CLI with a few subcommands. `yargs` is more powerful but adds complexity you don't need at MVP. `meow` is minimal but requires more manual subcommand handling. Stick with `commander`.

**Native `fetch` vs `undici`**
Node 24.15.0 ships with `fetch` natively — no additional dependency needed. `undici` gives you more control over HTTP internals but is overkill for simple GET requests to a public API. Use native `fetch` unless you hit limitations.

**`tsx` vs `ts-node`**
`tsx` is faster, has fewer configuration quirks, and works cleanly with modern ESM setups. Prefer it over `ts-node` for local development.

**`tsup` for packaging**
`tsup` is minimal, fast, and produces clean CJS/ESM output. It's the right tool for a library or CLI at this scale. If you want dual CJS/ESM output for maximum compatibility, `tsup` handles it out of the box.

**ESM vs CJS**
This is the most likely source of friction in the project. Node 24.15.0, `tsx`, and modern TypeScript all default toward ESM, but several common packages (including older versions of `commander`) have had CJS/ESM compatibility quirks. Recommendation: target ESM output, use `"type": "module"` in `package.json`, and test your `tsup` output before you consider the project done. If you hit import/export issues, this is where to look first.

**Public API rate limits**
Blockstream Esplora is a public, unauthenticated API. It's suitable for a portfolio CLI but may impose rate limits. This is worth noting in the README so reviewers understand the scope. Automated tests must use mocks and deterministic fixtures rather than live public API calls.

**Provider abstraction**
Only Blockstream Esplora is implemented for MVP, but command handlers should depend on normalized domain models rather than provider-specific response shapes. This keeps future mempool.space or testnet support from leaking into CLI rendering logic.

---

## 5. Success Criteria

The MVP is complete when:

- [ ] Local `npm install` installs dependencies cleanly
- [ ] Local package execution exposes the CLI binary successfully
- [ ] `btc-utxo-inspector address <address>` returns correct, readable output
- [ ] `btc-utxo-inspector tx <txid>` returns correct, readable output
- [ ] `--json` flag emits valid, parseable JSON to stdout
- [ ] `--json` errors emit valid, parseable JSON to stderr
- [ ] Invalid Bitcoin mainnet addresses are rejected before provider requests
- [ ] Unit tests cover sats conversion, address validation, API response normalization, pagination, retry/backoff behavior, and address summary logic
- [ ] Snapshot tests verify expected human-readable and JSON output
- [ ] Integration tests use mocked provider/API responses and deterministic fixtures
- [ ] At least one end-to-end CLI smoke test passes against mocked Bitcoin address and txid fixtures
- [ ] README includes install steps, example commands, and example output
- [ ] All public functions and API types are typed (no `any`)
- [ ] Strict TypeScript settings are enabled
- [ ] Package is publish-ready
- [ ] Package exposes both a CLI binary and reusable library functions
- [ ] Repo looks intentional, not scaffolded and abandoned

**Fixture note:** choose representative Bitcoin mainnet address and txid fixture values, but keep automated tests mocked and deterministic.
