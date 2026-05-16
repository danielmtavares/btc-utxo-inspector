# BTC UTXO Inspector - Development Task List

Below is the MVP task list derived from the PRD and `architecture.md`. It is organized as implementation work items rather than a required PR sequence. The PRD defines the MVP commands, outputs, flags, data source, stack, and success criteria; the architecture doc shows the proposed data flow and build order.

## Proposed File Structure

```text
btc-utxo-inspector/
  src/
    cli.ts
    index.ts
    api/
      http.ts
      blockstream.ts
      provider.ts
      schemas.ts
      types.ts
    commands/
      address.ts
      tx.ts
    format/
      human.ts
      json.ts
    utils/
      address.ts
      errors.ts
      pagination.ts
      sats.ts
  test/
    fixtures/
      address.json
      tx.json
      utxos.json
    snapshots/
    address-validation.test.ts
    sats.test.ts
    pagination.test.ts
    address.test.ts
    tx.test.ts
    blockstream.test.ts
    cli-smoke.test.ts
    integration-mock.test.ts
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  README.md
```

## Task 1 - Scaffold TypeScript CLI Project

**Goal:** Create the repo foundation, strict TypeScript setup, local CLI binary, and reusable public exports.

* [x] Initialize npm project
  * Create/edit: `package.json`
* [x] Target Node.js 24.15.0+ and ESM (`"type": "module"`, `engines` field)
  * Edit: `package.json`
* [x] Configure TypeScript strict mode for ESM (`module` / `moduleResolution` aligned with Node 24.15.0)
  * Create/edit: `tsconfig.json`
* [x] Add dependencies: `commander`, `zod`, `chalk`
  * Edit: `package.json`
* [x] Add dev dependencies: `typescript`, `tsx`, `tsup`, `vitest`
  * Edit: `package.json`
* [x] Add linting with Microsoft-aligned TypeScript naming conventions
  * Create/edit: `eslint.config.js`
  * Edit: `package.json`
* [x] Configure build, typecheck, test, dev, and local CLI scripts
  * Edit: `package.json`
* [x] Add CLI entry file with shebang
  * Create: `src/cli.ts`
* [x] Add public export entry for reusable library functions
  * Create: `src/index.ts`
* [x] Add basic help/version output
  * Edit: `src/cli.ts`
* [x] Verify local command runs with `tsx` or npm script execution
  * Edit: `package.json`

## Task 2 - Core Types, Validation, Pagination, and Sats Utilities

**Goal:** Establish typed domain modeling and local utility logic before network/command logic.

* [x] Define normalized domain types
  * Create: `src/api/types.ts`
  * Include: `AddressSummary`, `Utxo`, `TransactionSummary`, `TransactionInput`, `TransactionOutput`, `ExplorerSource`, pagination metadata, and provider error types
* [x] Define Blockstream Esplora response schemas with `zod`
  * Create: `src/api/schemas.ts`
* [x] Add Bitcoin mainnet address validation
  * Create: `src/utils/address.ts`
  * Support: legacy P2PKH, P2SH address encoding, native SegWit, and Taproot
* [x] Add sats/BTC conversion helpers
  * Create: `src/utils/sats.ts`
* [x] Add pagination helpers for UTXOs, inputs, and outputs
  * Create: `src/utils/pagination.ts`
* [x] Add reusable error helpers and exit-code mapping
  * Create: `src/utils/errors.ts`
* [x] Add unit tests for sats formatting
  * Create: `test/sats.test.ts`
* [x] Add unit tests for address validation
  * Create: `test/address-validation.test.ts`
* [x] Add unit tests for pagination behavior
  * Create: `test/pagination.test.ts`
* [x] Add fixture folder
  * Create: `test/fixtures/`

This supports the PRD’s goal of typed API responses, local invalid-address rejection, tested utility logic, and no public `any` types.

## Task 3 - Blockstream Provider and HTTP Layer

**Goal:** Isolate network calls, retry/timeout behavior, validation, and normalization from CLI commands.

* [x] Define explorer client interface and provider factory
  * Create: `src/api/provider.ts`
  * Map `ExplorerSource` to concrete clients; only `blockstream` is implemented for MVP
* [x] Implement shared HTTP client with timeout support
  * Create: `src/api/http.ts`
* [x] Add exponential backoff retry behavior for retryable provider failures
  * Edit: `src/api/http.ts`
* [x] Implement Blockstream Esplora client
  * Create: `src/api/blockstream.ts`
  * Default base URL: `https://blockstream.info/api`
* [x] Support configurable provider base URL
  * Edit: `src/api/provider.ts`
  * Edit: `src/api/blockstream.ts`
* [x] Add functions to fetch address stats and UTXOs
  * Edit: `src/api/blockstream.ts`
* [x] Add function to fetch transaction details
  * Edit: `src/api/blockstream.ts`
* [x] Validate all raw API responses with `zod`
  * Edit: `src/api/blockstream.ts`
  * Edit: `src/api/schemas.ts`
* [x] Normalize raw API responses into shared internal types
  * Edit: `src/api/blockstream.ts`
  * Edit: `src/api/types.ts`
* [x] Add fixture-based tests for API normalization
  * Create: `test/blockstream.test.ts`
  * Create/edit: `test/fixtures/address.json`
  * Create/edit: `test/fixtures/utxos.json`
  * Create/edit: `test/fixtures/tx.json`

Provider abstraction is required for future mempool.space or testnet support, but mempool.space is not implemented in the MVP.

## Task 4 - Address Command

**Goal:** Implement `btc-utxo-inspector address <address>`.

* [x] Add address command module
  * Create: `src/commands/address.ts`
* [x] Wire address command into CLI
  * Edit: `src/cli.ts`
* [x] Reject invalid Bitcoin mainnet addresses before provider calls
  * Edit: `src/commands/address.ts`
  * Edit: `src/utils/address.ts`
* [x] Fetch address stats and UTXOs via the Blockstream provider abstraction
  * Edit: `src/commands/address.ts`
  * Edit: `src/api/provider.ts`
* [x] Compute total received, total spent, and current balance in BTC and sats
  * Edit: `src/commands/address.ts`
* [x] Include paginated UTXO details: amount, `txid:vout`, confirmation status, block height, and script type when available
  * Edit: `src/commands/address.ts`
  * Edit: `src/utils/pagination.ts`
* [x] Return normalized command result instead of printing directly
  * Edit: `src/commands/address.ts`
* [x] Add address summary unit tests
  * Create: `test/address.test.ts`

Address command scope: show balance plus UTXOs only. Transaction details remain scoped to `tx <txid>`.

## Task 5 - Transaction Command

**Goal:** Implement `btc-utxo-inspector tx <txid>`.

* [x] Add transaction command module
  * Create: `src/commands/tx.ts`
* [x] Wire tx command into CLI
  * Edit: `src/cli.ts`
* [x] Fetch transaction by txid via the Blockstream provider abstraction
  * Edit: `src/commands/tx.ts`
  * Edit: `src/api/provider.ts`
* [x] Include confirmation status, block height, and timestamp when available
  * Edit: `src/commands/tx.ts`
* [x] Include full input and output details with pagination for large transactions
  * Edit: `src/commands/tx.ts`
  * Edit: `src/utils/pagination.ts`
* [x] Include total input value only when available directly from the provider
  * Edit: `src/commands/tx.ts`
* [x] Include total output value
  * Edit: `src/commands/tx.ts`
* [x] Include fee in sats and BTC only when provided directly by the API
  * Edit: `src/commands/tx.ts`
* [x] Add transaction summary tests
  * Create: `test/tx.test.ts`

## Task 6 - Output Formatting, CLI Flags, and Errors

**Goal:** Add clean human-readable and JSON output modes and wire all MVP flags.

* [x] Add human-readable formatter using `chalk`
  * Create: `src/format/human.ts`
* [x] Add JSON formatter
  * Create: `src/format/json.ts`
* [x] Support `--json`
  * Edit: `src/cli.ts`
* [x] Support `--source blockstream`
  * Edit: `src/cli.ts`
  * Edit: `src/commands/address.ts`
  * Edit: `src/commands/tx.ts`
* [x] Support `--api-url <url>`
  * Edit: `src/cli.ts`
  * Edit: `src/api/provider.ts`
* [x] Support `--limit <number>` and `--page <number>` with PRD defaults of `25` and `1`
  * Edit: `src/cli.ts`
  * Edit: `src/commands/address.ts`
  * Edit: `src/commands/tx.ts`
* [x] Ensure JSON output is valid parseable stdout
  * Edit: `src/format/json.ts`
  * Create/update: `test/cli-smoke.test.ts`
* [x] Emit JSON errors to stderr when `--json` is set
  * Edit: `src/cli.ts`
  * Edit: `src/utils/errors.ts`
* [x] Keep all errors on stderr
  * Edit: `src/cli.ts`
  * Edit: `src/utils/errors.ts`
* [x] Map invalid address, not found, provider failure, validation failure, and unexpected errors to non-zero exit codes
  * Edit: `src/utils/errors.ts`
  * Edit: `src/cli.ts`

## Task 7 - Packaging and Local Installability

**Goal:** Make the CLI package publish-ready and runnable as a local tool.

* [x] Configure `tsup` for ESM output and public library exports
  * Create: `tsup.config.ts`
* [x] Add `bin` entry for `btc-utxo-inspector`
  * Edit: `package.json`
* [x] Add package `exports` for reusable library functions
  * Edit: `package.json`
  * Edit: `src/index.ts`
* [x] Ensure built CLI keeps executable shebang
  * Edit: `src/cli.ts`
  * Edit: `tsup.config.ts`
* [x] Verify local install/execution flow
  * Edit if needed: `package.json`
* [x] Add package metadata required for publish-readiness
  * Edit: `package.json`

This maps to the PRD success criteria around local `npm install`, package execution, publish-readiness, CLI binary exposure, and reusable library exports.

## Task 8 - Tests, Snapshots, Mocked Integration, and Quality Gate

**Goal:** Prove the repo works end-to-end and catches output regressions.

* [x] Add Vitest config
  * Create: `vitest.config.ts`
* [x] Add snapshot tests for human-readable output
  * Create/edit: `test/address.test.ts`
  * Create/edit: `test/tx.test.ts`
  * Create: `test/snapshots/`
* [x] Add snapshot tests for JSON output
  * Create/edit: `test/address.test.ts`
  * Create/edit: `test/tx.test.ts`
* [x] Add CLI smoke test
  * Create: `test/cli-smoke.test.ts`
* [x] Verify address command contains expected fields
  * Edit: `test/cli-smoke.test.ts`
* [x] Verify tx command contains expected fields
  * Edit: `test/cli-smoke.test.ts`
* [x] Verify `--json` emits parseable JSON
  * Edit: `test/cli-smoke.test.ts`
* [x] Verify `--json` errors emit parseable JSON to stderr
  * Edit: `test/cli-smoke.test.ts`
* [x] Verify JSON error output matches the PRD error envelope shape
  * Edit: `test/cli-smoke.test.ts`
  * Edit: `src/utils/errors.ts`
* [x] Add mocked provider/API integration tests
  * Create: `test/integration-mock.test.ts`
  * Use deterministic Bitcoin mainnet-shaped address and txid fixtures without calling live public APIs
* [x] Add `typecheck`, `test`, `lint`, and `build` scripts
  * Edit: `package.json`
* [x] Run full local quality gate:
  * `npm run typecheck`
  * `npm run lint`
  * `npm test`
  * `npm run build`
* [x] Confirm no `any` in public functions and API types
  * Review: `src/api/types.ts`, `src/index.ts`, command modules, formatters

## Task 9 - README and Portfolio Polish

**Goal:** Make the repo readable and evaluable without reading the source.

* [x] Write project overview
  * Edit: `README.md`
* [x] Explain why the project exists
  * Edit: `README.md`
* [x] Add local install and execution instructions
  * Edit: `README.md`
* [x] Add address command examples
  * Edit: `README.md`
* [x] Add tx command examples
  * Edit: `README.md`
* [x] Add JSON output examples (`--json`)
  * Edit: `README.md`
* [x] Document `--source blockstream`, `--api-url`, `--limit`, and `--page`
  * Edit: `README.md`
* [x] Document exit codes
  * Edit: `README.md`
* [x] Add note about public API usage, rate limits, timeout, and retry behavior
  * Edit: `README.md`
* [x] Add example terminal output for default human-readable mode
  * Edit: `README.md`
* [x] Add “Not included in MVP” section
  * Edit: `README.md`
* [x] Add future improvements section
  * Edit: `README.md`
