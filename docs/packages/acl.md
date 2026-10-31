# @kehto/acl

Pure capability state and enforcement primitives for the napplet protocol.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Capability names and NAP contracts are not final.

## Install

```bash
pnpm add @kehto/acl @napplet/core @napplet/nap
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/acl/package.json`, `packages/acl/src/index.ts` |
| Version | `0.20.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Exported subpaths | `.`, `./capabilities` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.33.0` |
| `@napplet/nap` | `>=0.32.0 <0.33.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| State types | `AclState`, `AclEntry`, `Identity` |
| Bit flags | `CAP_RELAY_READ`, `CAP_RELAY_WRITE`, `CAP_CACHE_READ`, `CAP_CACHE_WRITE`, `CAP_HOTKEY_FORWARD`, `CAP_SIGN_EVENT`, `CAP_SIGN_NIP04`, `CAP_SIGN_NIP44`, `CAP_STATE_READ`, `CAP_STATE_WRITE`, `CAP_ALL`, `CAP_NONE`, `DEFAULT_QUOTA` |
| Mutations | `createState`, `grant`, `revoke`, `block`, `unblock`, `setQuota`, `getQuota`, `serialize`, `deserialize` |
| Checks | `check`, `toKey` |
| Migration | `migrateAclState` |
| Capability strings | `ALL_CAPABILITIES`, `CAP_IDENTITY_READ`, `CAP_KEYS_BIND`, `CAP_KEYS_FORWARD`, `CAP_MEDIA_CONTROL`, `CAP_NOTIFY_SEND`, `CAP_NOTIFY_CHANNEL`, `CAP_THEME_READ`, `CAP_DM_READ`, `CAP_DM_WRITE`, `CAP_FS_READ`, `CAP_FS_WRITE`, `Capability` |
| NAP mapping | `resolveCapabilitiesNap`, `CapabilityResolution`, `NapMessage` |
| Experimental `x-` extensions | `EXTENSION_DOMAIN_PREFIX`, `RESERVED_NAP_DOMAINS`, `ExtensionCapability`, `validateExtensionDomain`, `isExtensionDomain`, `validateExtensionCapability`, `isExtensionCapability`, `checkExtension`, `grantExtension`, `revokeExtension`, `sanitizeExtensionDecisions`, `mergeExtensionDecisions` |

## Experimental extension capabilities

Experimental NAP capabilities are `x-<domain>:<action>` strings. They are
stored as explicit per-identity decisions in `AclEntry.ext`; the built-in
bitfield, which runs through `1 << 27` (`llm:generate`), is never touched. A
missing decision falls back to the default policy, and `block` overrides it.
Built-in capability strings and reserved domains (including `llm`) and their
`x-` aliases are rejected. This is a Kehto spec-gap policy; see
[Build an experimental NAP](https://kehto.github.io/web/docs/how-tos/experimental-nap.html).

## Scope Boundaries

- Owns pure capability state and capability resolution.
- Maps `dm.status`, `dm.conversations`, `dm.messages`, `dm.subscribe`, and `dm.unsubscribe` to `dm:read`; maps `dm.send` to `dm:write`; maps `dm.message` and DM result/error envelopes back to recipient `dm:read`.
- Maps filesystem discovery, picker, metadata, read, and watch envelopes to `fs:read`; maps save destinations and filesystem mutations to `fs:write`; maps `fs.changed` and result envelopes back to recipient `fs:read`.
- Performs no I/O and has no runtime service registry.
- Does not host iframes, dispatch NAP messages, or interact with browser APIs.

## API Reference

- Generated module: <a href="../api/modules/_kehto_acl.html" target="_self"><code>docs/api/modules/_kehto_acl.html</code></a>
- Capabilities subpath: <a href="../api/modules/_kehto_acl.capabilities.html" target="_self"><code>docs/api/modules/_kehto_acl.capabilities.html</code></a>
