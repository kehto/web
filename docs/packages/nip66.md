# @kehto/nip66

Framework-agnostic NIP-66 kind-30166 relay-discovery aggregator.

## Install

```bash
pnpm add @kehto/nip66 nostr-tools
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/nip66/package.json`, `packages/nip66/src/index.ts` |
| Version | `0.1.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `nostr-tools` | `>=2.23.3 <3.0.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Factory | `createNip66Aggregator` |
| Pool contract | `Nip66RelayPool`, `Nip66Filter` |
| Options | `Nip66AggregatorOptions` |
| Handle | `Nip66Aggregator` with `start`, `resync`, `stop`, `getRelaySet`, `getRelaysSupportingNip`, and `relaySupportsNip` |

## Scope Boundaries

- Parses kind-30166 `d` tags into relay URLs and uppercase `N` tags into NIP support maps.
- Accepts a user-supplied relay-pool adapter.
- Does not bundle bootstrap relay policy, NIP-77 sync, OPFS cache priming, or Kehto runtime dependencies.

## API Reference

- Generated module: [`docs/api/modules/_kehto_nip66.html`](../api/modules/_kehto_nip66.html)
