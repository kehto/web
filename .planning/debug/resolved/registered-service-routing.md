---
status: resolved
trigger: "resolve https://github.com/kehto/web/issues/303 within bounds of NIP-5D and NAP specifications."
created: 2026-10-14
updated: 2026-10-14
---

# Symptoms

Issue #303 supplies a disposable runtime reproduction: services attach and resolve identity, but only fixed dispatcher domains receive messages. The example service routes through the low-level helper but not Runtime.handleMessage. No exception occurs. Reported on @kehto/runtime 0.23.0; source inspection at main 9edcdca3 confirms fixed dispatch and mutable registration are disconnected.

# Current Focus

hypothesis: Fixed dispatcher domains have no explicit extension recognition/authorization path.
next_action: Ship verified commit 7e9596bb on fix/registered-service-routing as a PR closing #303.

# Specification check

Checked NIP-5D PR #2303 at dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7: exact domain.action wire messages, unknown types silently ignored, trusted source identity, namespace presence defines availability, declarations never grant capabilities. Checked napplet/naps master@3fdba1accd508ab54939b277d426127c5af8faf8 naps/NAP-SHELL.md and projections/web.md: service discovery is descriptive and does not grant domains or operations. No owning NAP exists for the example domain; private extension contracts remain host-owned, not a standardized NAP invented by this fix.

# Plan

1. Prove the registration gap and add exact-message extension policies to ServiceHandler. Require explicit isDomainAllowed approval, a live session, unblocked identity, declared existing ACL capability (or explicit null), and firewall admission. Unknown messages stay silent before firewall evaluation. Built-in domains retain their dispatch/ACL ownership, including shell and the retired signer boundary.
2. Bind extension replies to the same service registration, source lifecycle, namespace grant, and current ACL policy. Cover initial/dynamic registration, replacement/removal, runtime/window destruction, denial, malformed and unknown traffic, fixed-domain precedence and isolation. Document low-level routeServiceMessage as a policy-free primitive, never a host authorization fallback.
3. Update runtime docs, examples, conformance policy, and changeset. Run build/type/unit/docs/slop and appropriate browser gates; commit, push, open a PR closing #303. Record evidence and mark this debug session resolved.

GSD debug runs inline under the skill's Codex spawn restriction. The issue provides symptoms and reproduction; no additional user questionnaire is needed. Work is isolated at ~/.worktrees/kehto/registered-service-routing; primary branding work and package.json edit are unrelated and preserved.

# Evidence

- Graph discovery returned no matches for the named runtime functions; read the issue-linked files directly.
- createNapEnvelopeDispatcher registers a fixed set; registerService only changes the service registry and lifecycle hooks.
- ACL mapping returns null/null for unknown domains, so a generic fallback without explicit recognition and authorization would be insufficient.
- Built-in namespace injection enumerates known operations. Registration will not fabricate a browser binding or advertise availability; extension hosts must implement their domain's binding and source-bound policy.

- Regression-first suite: 17 failures confirmed missing delivery, inherited/malformed-type noise under firewall denial, and lifecycle gaps; six pre-existing negative cases passed.
- Added exact host-only messageCapabilities, explicit domain grants, canonical ACL validation (null remains explicit), silent extension firewall denials with host audit/consent, and lifecycle-bound callbacks. The source register callback invalidates pending replies even if the host reuses the same SessionEntry object.
- No dependency update or invented NAP wire field is needed: installed @napplet/core 0.32.0 NappletMessage has a generic string type and createDispatch owns only registered domains.

# Resolution

root_cause: Registration updated metadata and attachment lifecycle but had no policy-aware path beyond the fixed dispatcher. A bare generic fallback would skip explicit unknown-type recognition and inherit null ACL mappings.
fix: Added ServiceHandler.messageCapabilities as an opt-in host contract; isolated routing enforces exact message recognition, explicit domain grants, live/unblocked source identity, declared existing ACL requirements, and the existing firewall. Unknown messages and extension denials have no invented wire response. Reply closures recheck current domain/ACL policy and registration/source lifetime; removal invalidates before cleanup hooks. Fixed NAP and shell/signing boundaries remain intact.
commit: 7e9596bb

## Verification

- pnpm build: all 32 tasks pass.
- pnpm type-check: all 17 tasks pass.
- pnpm test:unit --maxWorkers=4: 169 files, 2,156 tests pass.
- pnpm test:e2e: all 123 browser tests pass.
- pnpm docs:check: strict TypeDoc, VitePress and nine-package docs audit pass.
- pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json: 100/100, no diagnostics.
- git diff --check: pass.
- Issue reproduction adapted only for the built package path, explicit example.ping declaration, and success assertion: both common and example attach, resolve source identity, receive messages and send replies through Runtime.handleMessage; direct helper observation and detach lifecycle still pass.
- Published declaration artifact contains messageCapabilities. The current core 0.32.0 generic string envelope supports the host API without a dependency update.
- Upstream NIP-5D and napplet/naps refs rechecked unchanged after implementation.

## Completion scope

The optional host API adds no NAP wire fields and grants no domain. Browser bindings remain host-owned; stock Paja/playground do not inject arbitrary domains. The example has no owning NAP in the checked registry and is not asserted to implement a standard. The direct selection helper remains intentionally policy-free and documented as unsuitable for untrusted ingress. Historical archived migration docs are not rewritten; active API examples and service how-tos now state the supported contract. No retained legacy compatibility fallback is added.
