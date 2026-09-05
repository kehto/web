---
slug: paja-signer-consent
status: resolved
trigger: "Paja requires GUI signer confirmation with remembered kind choices and a warned trust-napplet choice."
created: 2026-08-22
updated: 2026-08-22
---

# Debug: Paja remembered signer consent

## Requirement

Paja is the reference developer runtime and must remain careful with signer authority. It needs a custom GUI confirmation for signatures, a remembered per-kind choice, and an explicit trust-napplet choice with a visual warning. Kehto must expose neutral caller context without selecting consent policy.

## Current Focus

hypothesis: CONFIRMED. Paja already has an accessible custom confirmation queue, but signer requests lack the originating `windowId` and verified napplet identity. Persisting consent without that context would leak authority across napplets or tabs.
test: Forward the optional originating window through Kehto's auth adapter, bind Paja grants to signer pubkey + host-owned napplet identity + target boundary, and prove kind/trust isolation, fail-closed fallback, revocation, and browser UI behavior.
expecting: Kehto remains policy-free. Paja skips only exact remembered signing requests; unknown identity/kind and all denials remain one-shot. Trust never crosses signer accounts, napplet identities, verified artifact hashes, or direct target URLs.
next_action: ship the verified branch and monitor the pull request checks.

## Authority

- `napplet/naps` PR #2, branch `nub-relay`, exact head `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`, `naps/NAP-RELAY.md`.
- The draft requires the shell to sign `relay.publish` and `relay.publishEncrypted` templates, keeps keys inaccessible to napplets, and explicitly permits shell ACL/content-policy rejection.
- The draft does not define remembered consent storage or UI. Those are intentionally Paja runtime policy, not NAP wire behavior.

## Safety Decisions

- Remembered consent is keyed by signer pubkey, napplet d-tag, host-owned aggregate hash, and Paja target boundary. Runtime pointers use the verified artifact hash; direct targets use their exact URL so trust cannot cross local apps.
- Kind grants additionally require the exact numeric Nostr event kind.
- Trust applies to all kinds only for the exact identity tuple and is never the default selection.
- The trust option carries an explicit visual warning that arbitrary future events from that identity and target will be signed without another prompt, including after direct-target code reloads at the same URL.
- Missing source identity, missing signer pubkey, or invalid/unknown kind disables remembered choices and keeps one-shot confirmation.
- Denials and Escape are never persisted.
- A persistent Paja control revokes all remembered signer approvals.
- Storage failure while granting degrades to page-lifetime memory. Failed durable revocation retains the listed grant and logs failure rather than falsely claiming it was removed.
- A full host reload rotates Paja's ephemeral Dev signer, so its old grant cannot match; stable NIP-07/NIP-46 pubkeys can reuse persisted choices.

## Evidence

- `AuthAdapter.getSigner()` and `AuthHooks.getSigner()` previously accepted no caller context.
- `handleRelayPublish`, `handleRelayPublishEncrypted`, and the identity fallback already hold the originating `windowId`, so forwarding it is an additive toolkit mechanism.
- Paja's `getIdentity(windowId)` path already resolves `{ dTag, aggregateHash }` from the verified runtime tab/session identity.
- Paja's NIP-07/NIP-46 signer controller wrapped a global signer at connection time, so the confirmation could not be safely attributed per request.

## Resolution

root_cause: Signer confirmation existed, but the toolkit-to-runtime signer lookup discarded the originating napplet window before Paja could make a source-bound decision.
fix: Kehto now forwards optional `windowId` context without selecting policy. Paja keeps connected signers raw, re-reads the active signer pubkey per request, binds remembered decisions to signer + host-owned napplet identity + target boundary, offers kind or warned napplet trust, preserves independent publish confirmation, and provides explicit durable revocation.
verification: Green: `pnpm build` (32/32 tasks), `pnpm type-check` (17/17 tasks), `pnpm test:unit` (145 files, 1,694 tests), `pnpm docs:check`, `pnpm test:e2e` (82 tests), and `npx aislop scan` (100/100). Focused coverage additionally proves exact-kind/trust isolation, signer account changes, direct-target isolation, persistence with a stable NIP-07 account, ephemeral Dev signer isolation, failed durable revocation, Escape denial, and publish-prompt independence.

The authority was rechecked immediately before shipping: `napplet/naps` PR #2 remained open on branch `nub-relay` at exact head `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`.
