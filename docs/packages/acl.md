# @kehto/acl

Pure capability state and enforcement primitives for the napplet protocol.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Capability names and NUB contracts are not final.

## Install

```bash
pnpm add @kehto/acl @napplet/core @napplet/nub
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/acl/package.json`, `packages/acl/src/index.ts` |
| Version | `0.10.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Exported subpaths | `.`, `./capabilities` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `^0.5.0` |
| `@napplet/nub` | `^0.5.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| State types | `AclState`, `AclEntry`, `Identity` |
| Bit flags | `CAP_RELAY_READ`, `CAP_RELAY_WRITE`, `CAP_CACHE_READ`, `CAP_CACHE_WRITE`, `CAP_HOTKEY_FORWARD`, `CAP_SIGN_EVENT`, `CAP_SIGN_NIP04`, `CAP_SIGN_NIP44`, `CAP_STATE_READ`, `CAP_STATE_WRITE`, `CAP_ALL`, `CAP_NONE`, `DEFAULT_QUOTA` |
| Mutations | `createState`, `grant`, `revoke`, `block`, `unblock`, `setQuota`, `getQuota`, `serialize`, `deserialize` |
| Checks | `check`, `toKey` |
| Migration | `migrateAclState` |
| Capability strings | `ALL_CAPABILITIES`, `CAP_IDENTITY_READ`, `CAP_IDENTITY_DECRYPT`, `CAP_KEYS_BIND`, `CAP_KEYS_FORWARD`, `CAP_MEDIA_CONTROL`, `CAP_NOTIFY_SEND`, `CAP_NOTIFY_CHANNEL`, `CAP_THEME_READ`, `Capability` |
| NUB mapping | `resolveCapabilitiesNub`, `CapabilityResolution`, `NubMessage` |

## Scope Boundaries

- Owns pure capability state and capability resolution.
- Performs no I/O and has no runtime service registry.
- Does not host iframes, dispatch NUB messages, or interact with browser APIs.

## API Reference

- Generated module: <a href="../api/modules/_kehto_acl.html" target="_self"><code>docs/api/modules/_kehto_acl.html</code></a>
- Capabilities subpath: <a href="../api/modules/_kehto_acl.capabilities.html" target="_self"><code>docs/api/modules/_kehto_acl.capabilities.html</code></a>
