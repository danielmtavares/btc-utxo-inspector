# btc-utxo-inspector
A CLI for inspecting Bitcoin addresses, summarizing UTXOs and balances, and analyzing transaction details using public blockchain APIs.

## Development

Run the local quality checks before opening changes:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Linting uses ESLint with TypeScript-aware rules and Microsoft-aligned naming conventions: PascalCase for type-like names, camelCase for functions and values, no `I` prefix for interfaces, and no leading underscore for private members.
