# Phase 48: Demo Function-Export Migration - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; migration surface is mechanically discoverable from imports and published helper signatures

<domain>
## Phase Boundary

Finish the demo/fixture call-site migration by replacing remaining old `@napplet/sdk` namespace imports for relay, identity, keys, notify, and config. Media is already on the pure `@napplet/nub/media/sdk` helper surface; resource remains a documented exception because Kehto's current resource wire shape intentionally differs from upstream `@napplet/nub/resource@0.3.0`.
</domain>

<decisions>
## Implementation Decisions

### Import direct helper functions from NUB `/sdk` subpaths

Continue the Phase 47 import pattern:

- Relay: `relayPublish`, `relayPublishEncrypted`, `relaySubscribe`
- Identity: `identityGetPublicKey`, `identityGetProfile`
- Keys: `keysRegisterAction`, `keysOnAction`
- Notify: `notifySend`, `notifyDismiss`
- Config: `get as configGet`, `subscribe as configSubscribe`

The direct helper imports are explicit package dependencies through the Phase 47 `@napplet/nub: 0.3.0` manifest addition.

### Core type imports

Where demo code needs Nostr event/template/subscription types, import them as type-only imports from `@napplet/core` and add exact `@napplet/core: 0.3.0` to those package manifests. This avoids keeping `@napplet/sdk` imports only for types.

### Resource exception

Do not swap `resource-demo` to `resourceBytes` in this phase. Verified gap:

- Upstream helper sends `resource.bytes` with `id` and resolves `resource.bytes.result` with `blob`.
- Kehto's service currently expects `requestId` and replies with `bodyBase64`, `status`, and `headers`.
- This divergence is the same internal-vs-upstream resource model split recorded during v1.8.

The demo should instead carry a grepable `RESOURCE-SDK-GAP` comment until the shell resource protocol is deliberately migrated.

### Toaster exception

`notifySend` covers the fixture's `notify.send` behavior and `notifyDismiss` covers toaster dismiss calls, but toaster create/list behavior must stay on raw `notify.create` / `notify.list` envelopes because existing demo service and E2E assertions cover that lifecycle.
</decisions>

<code_context>
## Existing Code Insights

- Remaining `@napplet/sdk` imports live in chat, composer, config-demo, feed, hotkey-chord, profile-viewer, theme-switcher, toaster, and the identity/notify/relay fixtures.
- `media-controller` already imports from `@napplet/nub/media/sdk`; comments still mention `@napplet/sdk`.
- `resource-demo` has no `@napplet/sdk` import today, but its comments still describe old unpublished-resource assumptions.
- Fixture README still teaches namespace-style SDK imports and must be cleaned in Phase 49 or here if touched.
</code_context>

<specifics>
## Specific Ideas

- Preserve DOM sentinel text and log strings where E2E specs assert them; changing import shape should not change user-visible behavior beyond stale namespace prose.
- Run targeted builds for the Phase 48 migrated package set before closing the phase.
</specifics>

<deferred>
## Deferred Ideas

- Add the static import guard and run full build/typecheck/unit/E2E in Phase 49.
- Migrate Kehto's resource wire protocol to upstream `id`/`Blob` semantics only in a future runtime/service milestone.
</deferred>
