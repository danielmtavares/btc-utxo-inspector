# btc-utxo-inspector

A CLI for inspecting Bitcoin mainnet addresses and transactions from the terminal.

It summarizes:

- address balances in BTC and sats
- paginated UTXOs for an address
- transaction inputs, outputs, totals, and fee details
- JSON output for scripting and automation

The MVP uses the Blockstream Esplora API and is designed as both a CLI and a reusable library package.

## Why This Project Exists

This project is a compact Bitcoin data inspection tool that demonstrates:

- a strict TypeScript CLI architecture
- typed provider normalization over a public blockchain API
- clean separation between command, formatting, provider, and utility layers
- publish-ready packaging with a reusable library surface
- strong test coverage with snapshots, mocked integration tests, and CLI smoke tests

It is intentionally scoped to a focused MVP instead of trying to become a full wallet, explorer, or analytics platform.

## Requirements

- Node.js `24.15.0` or newer
- npm

## Local Development Setup

Install dependencies:

```bash
npm install
```

Run the CLI from source during development:

```bash
npm run dev -- --help
```

Build the package:

```bash
npm run build
```

Run the built CLI:

```bash
npm run start -- --help
```

Run the local quality gate:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Local Installation

If you want to install the package locally without publishing it, build and pack it from the repo:

```bash
npm run build
npm pack
```

Then install the generated tarball into another local project:

```bash
npm install ../btc-utxo-inspector/btc-utxo-inspector-0.0.1.tgz
```

After that, run it with:

```bash
npx btc-utxo-inspector --help
```

## Commands

### `address`

Inspect a Bitcoin mainnet address and return balance plus paginated UTXOs.

```bash
btc-utxo-inspector address <address>
```

Example:

```bash
npm run dev -- address 1BoatSLRHtKNngkdXEeobR76b53LETtpyT
```

What it includes:

- network and parsed address type
- total received in BTC and sats
- total spent in BTC and sats
- current balance in BTC and sats
- paginated UTXOs with:
  - `txid:vout`
  - amount
  - confirmation status
  - block height when confirmed
  - script type

Address type detection is based on the address encoding. `3...` addresses are reported as `p2sh`; the CLI does not inspect the redeem script, so it cannot distinguish nested SegWit P2SH from other P2SH outputs.

### `tx`

Inspect a Bitcoin transaction by txid.

```bash
btc-utxo-inspector tx <txid>
```

Example:

```bash
npm run dev -- tx 2222222222222222222222222222222222222222222222222222222222222222
```

What it includes:

- confirmation status
- block metadata and timestamp when available
- version and locktime
- total input when the provider supplies enough data directly
- total output
- fee when the provider supplies it directly
- paginated inputs
- paginated outputs

## Flags

Both commands support:

- `--json`
  - Emit parseable JSON to stdout
- `--source <source>`
  - Provider selection
  - MVP supports only `blockstream`
- `--api-url <url>`
  - Override the provider base URL
  - Useful for mocks, tests, or alternate Esplora deployments
- `--limit <number>`
  - Page size for UTXOs, inputs, or outputs
  - Default: `25`
- `--page <number>`
  - 1-based page number
  - Default: `1`

Examples:

```bash
npm run dev -- address 1BoatSLRHtKNngkdXEeobR76b53LETtpyT --limit 10 --page 2
```

```bash
npm run dev -- tx 2222222222222222222222222222222222222222222222222222222222222222 --json
```

```bash
npm run dev -- address 1BoatSLRHtKNngkdXEeobR76b53LETtpyT --source blockstream --api-url https://blockstream.info/api
```

## Human-Readable Output Example

Example default output for an address:

```text
Address 1BoatSLRHtKNngkdXEeobR76b53LETtpyT
Network mainnet Type p2pkh
Received 55 BTC (5,500,000,000 sats)
Spent 12.5 BTC (1,250,000,000 sats)
Balance 42.5 BTC (4,250,000,000 sats)
Page 1/1 Items 1
UTXOs Page 1/1 Items 1
1. 1111111111111111111111111111111111111111111111111111111111111111:0 50 BTC (5,000,000,000 sats) confirmed block 100000 p2pkh
```

Example default output for a transaction:

```text
Transaction 2222222222222222222222222222222222222222222222222222222222222222
Status confirmed
Block 100001 Time 2023-11-14T22:30:00.000Z
Version 2 Locktime 0
Input Total 50 BTC (5,000,000,000 sats)
Output Total 49.999 BTC (4,999,900,000 sats)
Fee 0.001 BTC (100,000 sats)
Inputs 1
Inputs Page 1/1 Items 1
1. 1111111111111111111111111111111111111111111111111111111111111111:0 50 BTC (5,000,000,000 sats)
Outputs 1
1. 49.999 BTC (4,999,900,000 sats) p2wpkh bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080
Outputs Page 1/1 Items 1
```

## JSON Output Example

Address example:

```bash
npm run dev -- address 1BoatSLRHtKNngkdXEeobR76b53LETtpyT --json
```

Example shape:

```json
{
  "address": "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
  "network": "mainnet",
  "addressType": "p2pkh",
  "balance": {
    "btc": "42.5 BTC",
    "sats": "4,250,000,000 sats",
    "valueSats": "4250000000"
  },
  "utxos": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 0,
      "totalPages": 0,
      "hasPreviousPage": false,
      "hasNextPage": false,
      "startIndex": 0,
      "endIndex": 0
    }
  }
}
```

Transaction example:

```bash
npm run dev -- tx 2222222222222222222222222222222222222222222222222222222222222222 --json
```

## Errors and Exit Codes

Human-readable mode writes normal output to stdout and errors to stderr.

When `--json` is set, errors are written to stderr using this envelope:

```json
{
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Invalid Bitcoin mainnet address: bad",
    "details": {
      "address": "bad"
    }
  }
}
```

Exit codes:

- `0` success
- `1` unexpected error
- `2` invalid input, including invalid addresses or pagination
- `3` resource not found
- `4` provider failure
- `5` provider response validation failure

## API Usage Notes

The MVP uses Blockstream Esplora by default:

- default base URL: `https://blockstream.info/api`
- request timeout: `10,000ms`
- retry attempts: `3`
- initial backoff: `250ms`
- exponential backoff sequence: `250ms`, `500ms`, `1000ms`

Retries are intended for retryable network and provider failures. `404` responses are not retried.

Because this tool depends on a public API, real-world usage can still be affected by:

- provider downtime
- network instability
- external rate limiting
- alternate Esplora deployments with different operational limits

Treat `--api-url` as trusted input when embedding this package in another application. If user-supplied URLs are accepted in a server or automation service, validate or allowlist them before passing them into the client.

## Library Usage

The package also exports reusable functions and types for programmatic use.

Example:

```ts
import {
  createExplorerClient,
  inspectAddressCommand,
  parseBitcoinMainnetAddress,
} from "btc-utxo-inspector";

const parsedAddress = parseBitcoinMainnetAddress("1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
const client = createExplorerClient();

const result = await inspectAddressCommand(
  {
    address: parsedAddress.address,
  },
  {
    createClient: () => client,
  },
);
```

## Architecture Notes

The codebase is split into focused layers:

- `src/cli.ts`
  - CLI argument parsing and output/error routing
- `src/commands/*`
  - command-specific orchestration and normalization into display-ready results
- `src/api/*`
  - provider abstraction, HTTP behavior, and raw API schema validation
- `src/format/*`
  - human-readable and JSON rendering
- `src/utils/*`
  - address validation, pagination, sats formatting, and errors

## Not Included in the MVP

- testnet, signet, or regtest support
- transaction history inside the `address` command
- multiple providers beyond Blockstream
- wallet import, key management, or signing
- live integration tests against public APIs
- npm publish workflow automation

## Future Improvements

- add support for additional Esplora-compatible providers
- add testnet support
- improve script type detection for address UTXOs
- add richer README examples from real deterministic fixtures
- publish the package to npm
- add CI automation for quality gate and package verification
- add optional machine-readable schemas for command output

## Development Standards

This repo uses:

- strict TypeScript
- ESLint with TypeScript-aware rules
- Microsoft-aligned naming conventions
- snapshot tests for output stability
- mocked integration tests instead of live API coupling

When validating changes, test results are treated as the passing condition. Tests should only change when the intended contract changes or the existing assertion is wrong.
