# BTC UTXO Inspector — Architecture

High-level data flow for the MVP CLI (`address`, `tx`), aligned with [PRD.md](./PRD.md) and [tasks.md](./tasks.md).

```mermaid
flowchart TB
  User["CLI User"] --> Terminal["Terminal / Shell"]

  Terminal --> CLI["src/cli.ts<br/>Commander CLI Entry"]

  CLI --> AddressCmd["src/commands/address.ts<br/>address &lt;address&gt;"]
  CLI --> TxCmd["src/commands/tx.ts<br/>tx &lt;txid&gt;"]

  CLI --> Flags["CLI Flags<br/>--json<br/>--source blockstream<br/>--api-url<br/>--limit<br/>--page"]

  AddressCmd --> AddressValidation["src/utils/address.ts<br/>Mainnet Address Validation"]
  AddressValidation --> Provider["src/api/provider.ts<br/>Explorer Provider Factory"]
  TxCmd --> Provider
  Flags --> Provider

  Provider --> BlockstreamClient["src/api/blockstream.ts<br/>Blockstream Esplora Client"]

  BlockstreamClient --> HttpClient["src/api/http.ts<br/>Timeout + Exponential Backoff"]
  HttpClient --> Fetch["Node.js 24.15.0+ Native fetch"]

  Fetch --> BlockstreamAPI["Blockstream Esplora API<br/>https://blockstream.info/api"]

  BlockstreamAPI --> RawResponses

  RawResponses --> ZodSchemas["src/api/schemas.ts<br/>Zod Validation"]
  ZodSchemas --> NormalizedTypes["src/api/types.ts<br/>Normalized Domain Types"]

  NormalizedTypes --> AddressCmd
  NormalizedTypes --> TxCmd

  AddressCmd --> SatsUtils["src/utils/sats.ts<br/>Sats/BTC Conversion"]
  TxCmd --> SatsUtils
  AddressCmd --> PaginationUtils["src/utils/pagination.ts<br/>Collection Pagination"]
  TxCmd --> PaginationUtils

  AddressCmd --> FormatterRouter["Output Formatter Selection"]
  TxCmd --> FormatterRouter
  Flags --> FormatterRouter

  FormatterRouter --> HumanFormat["src/format/human.ts<br/>Human-readable Output (chalk)"]
  FormatterRouter --> JsonFormat["src/format/json.ts<br/>Machine-readable JSON"]

  HumanFormat --> Stdout["stdout"]
  JsonFormat --> Stdout

  CLI --> Errors["src/utils/errors.ts<br/>Error Handling"]
  Errors --> Stderr["stderr"]

  subgraph Tests["Test Suite / Verification (Vitest)"]
    SatsTest["test/sats.test.ts"]
    AddressValidationTest["test/address-validation.test.ts"]
    PaginationTest["test/pagination.test.ts"]
    AddressTest["test/address.test.ts"]
    TxTest["test/tx.test.ts"]
    BlockstreamTest["test/blockstream.test.ts"]
    CliSmoke["test/cli-smoke.test.ts"]
    MockIntegration["test/integration-mock.test.ts"]
    Snapshots["test/snapshots/*"]
    Fixtures["test/fixtures/*.json"]
  end

  Fixtures --> AddressTest
  Fixtures --> TxTest
  Fixtures --> BlockstreamTest
  AddressValidation --> AddressValidationTest
  PaginationUtils --> PaginationTest

  subgraph Build["Build / Packaging (ESM)"]
    TS["TypeScript (strict)"]
    TSUP["tsup"]
    Package["package.json<br/>type: module<br/>bin: btc-utxo-inspector"]
    Dist["dist/"]
  end

  TS --> TSUP
  TSUP --> Dist
  Package --> CLI
  Package --> TSUP
```

## MVP surface

| Layer | Responsibility |
|---|---|
| `src/cli.ts` | Subcommands, global flags, routes to formatters |
| `src/commands/*` | Orchestrate fetch → normalize → return result |
| `src/api/provider.ts` | Select provider client from `--source`; only `blockstream` is implemented for MVP |
| `src/api/http.ts` | Native fetch wrapper with timeout and exponential backoff |
| `src/api/blockstream.ts` | HTTP + zod validate + map to domain types |
| `src/format/*` | Human-readable or JSON output to stdout |
| `src/utils/*` | Address validation, pagination, sats/BTC helpers, stderr errors, exit codes |
