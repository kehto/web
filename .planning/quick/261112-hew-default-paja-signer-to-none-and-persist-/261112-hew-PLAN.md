---
phase: quick-261112-hew
plan: "01"
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-261112-hew]
files_modified:
  - packages/paja/src/browser-signers.ts
  - packages/paja/src/browser-signers.test.ts
  - packages/paja/src/browser-host.ts
  - packages/paja/src/browser-devtools.ts
  - packages/paja/src/host-page.ts
  - tests/e2e/paja-identity.spec.ts
  - packages/paja/README.md
  - docs/packages/paja.md
  - .changeset/paja-explicit-signer-choice.md
estimate:
  tokens: 28000
  raw_tokens: 28000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Fresh Paja startup selects None and never invokes an injected extension's getPublicKey.
    - None, Dev, NIP-07 and Bunker selections survive a host reload; restoring a method does not invent credentials.
    - Selecting None clears the active signer and invalidates pending connections, including late successes and failures.
    - Explicit NIP-07 selection reconnects on reload, while explicit None never reconnects.
  artifacts:
    - path: packages/paja/src/browser-signers.ts
      provides: Safe signer selection, persistence, and asynchronous lifetime handling
    - path: tests/e2e/paja-identity.spec.ts
      provides: Real startup, selection, reload, and empty-identity proof
  key_links:
    - from: packages/paja/src/browser-devtools.ts
      to: packages/paja/src/browser-host.ts
      via: None selection callback
    - from: packages/paja/src/browser-host.ts
      to: packages/paja/src/browser-signers.ts
      via: Validated preference restoration instead of extension-presence auto-connect
---

<objective>
Make Paja's signer an explicit, durable user choice, with None as the safe first-run default. Preserve all existing signer methods and permission boundaries. This is quick task 261112-hew, not work on the separately shipped PR #433 relay-discovery branch.
</objective>

<execution_context>
@/home/robert/.config/opencode/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@packages/paja/src/browser-signers.ts
@packages/paja/src/browser-host.ts
@packages/paja/src/browser-host-signer.ts
@packages/paja/src/browser-devtools.ts
@packages/paja/src/browser-sidebar-sections.ts
@tests/e2e/paja-identity.spec.ts

Planning observation: clean fix/paja-default-no-signer at 1dfbf610, origin git@github.com:kehto/web.git. No .claude/skills or .agents/skills directories; query agent-skills gsd-planner returned no configured skills. No new libraries required (Level 0 internal patterns).

Specification checked through GitHub contents API before planning: napplet/naps naps/NAP-IDENTITY.md at master commit 43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab. No connected signer means empty pubkey; identity is read-only; disconnect must clear shell-user identity, never napplet identity. Existing paja-identity.spec.ts explicitly tracks the separate loaded-frame identity.changed/reinitialization gap with test.fixme. Preserve and disclose that gap; this task does not claim complete NAP-IDENTITY conformance or alter wire contracts. Keep existing fixed simulation identity behavior distinct from actual signing authority.

Current source already models method none, but offers no disconnect method or None control. browser-host.ts unconditionally connects if hasNip07Signer() at startup. NIP-07 and NIP-46 await operations lack generation ownership; a late completion can overwrite a subsequent choice. Existing host subscription cancels pending signer confirmations and publishes identity changes; use that path.
</context>

<assumption_delta_decision>
Primary noun: explicit signer-method preference, separate from connection/session state. Decision: promote. Extension presence is availability, not consent or a default. Persist method only, never signing keys, bunker secrets, connection URIs or consent decisions. Restored Bunker remains visibly selected/disconnected until the user supplies its URI; this preserves the selected method without claiming a persisted authenticated session. Dev and NIP-07 can restore through existing entry points. Connection failure must not silently select another backend.
</assumption_delta_decision>

<tasks>
<task type="tracer" tdd="true">
  <name>1. Deliver explicit None from control through runtime signer and identity</name>
  <files>packages/paja/src/browser-signers.ts, packages/paja/src/browser-host.ts, packages/paja/src/browser-devtools.ts, tests/e2e/paja-identity.spec.ts</files>
  <behavior>Fresh startup with window.nostr installed never calls getPublicKey; None is visibly active. Explicit NIP-07 connects. Clicking None removes signing authority, clears connected identity and remains disconnected despite pending connection completion.</behavior>
  <action>First add a failing real-browser startup/None regression with an injected extension call counter before navigation. Add a useNoSigner controller operation and thread it through PajaBrowserState and PajaDevtoolsState. Render an accessible button labeled None with id signer-none and the same active-state convention as existing controls. Remove presence-driven startup connection. On None, close owned NIP-46 resources, clear signer/pubkey/relay/error and publish the disconnected none state through existing listeners so pending confirmations are denied. Introduce connection-generation ownership on every selection: late NIP-07 and NIP-46 success or error cannot change state or reclaim the active signer; close obsolete bunker clients even while connection is pending. Do not change relay discovery or transplant PR #433. Update the existing reload browser scenario to click NIP-07 explicitly rather than assuming first-run auto-connect.</action>
  <verify><automated>pnpm build &amp;&amp; pnpm exec playwright test tests/e2e/paja-identity.spec.ts</automated></verify>
  <done>Fresh startup and clicking None are proven through the real Paja host and iframe; explicit connection still works and existing identity-gap skip remains honestly documented.</done>
</task>

<task type="auto" tdd="true">
  <name>2. Round-trip explicit signer preferences safely</name>
  <files>packages/paja/src/browser-signers.ts, packages/paja/src/browser-signers.test.ts, packages/paja/src/browser-host.ts, tests/e2e/paja-identity.spec.ts</files>
  <behavior>Absent, invalid and unreadable storage resolve to None without extension I/O. All four method choices round-trip. Writes failing do not prevent in-session selection. Explicit None survives reload with zero extension calls. Explicit NIP-07 reconnects after reload; Dev restores; Bunker restores selected/disconnected without secret persistence. Late completions cannot overwrite newer persisted choice.</behavior>
  <action>Add bounded origin-local persistence using key kehto:paja:signer-method:v1 and an allowlist of none/dev/nip07/nip46. Follow sidebar preference try/catch and validation patterns; make storage injectable for deterministic tests. Persist on explicit selection, not on asynchronous status callbacks. Add an explicit restore operation invoked once after host state/listeners are initialized, replacing the removed auto-connect. None does not invoke any provider. Dev and NIP-07 use their existing activation paths; Bunker restores its selected method with disconnected status and requires URI entry to connect. Never persist a bunker URI, secret, private key or signer approval. Test generation races for pending bunker and extension calls, including rejection after a newer choice and client close ownership. Browser tests must prove reload behavior and actual call counts, not only stored strings. Keep missing-extension errors on selected NIP-07 without an implicit fallback. Only if a live full-suite failure demonstrates another fixture depends on automatic connection, authorize its exact file after reading it and update setup to explicitly choose NIP-07; do not weaken assertions or globally seed a signer preference.</action>
  <verify><automated>pnpm exec vitest run packages/paja/src/browser-signers.test.ts &amp;&amp; pnpm build &amp;&amp; pnpm exec playwright test tests/e2e/paja-identity.spec.ts</automated></verify>
  <done>Every method preference round-trips independently of transient connection status; None is durable and stale work cannot reconnect it.</done>
</task>

<task type="auto">
  <name>3. Document, polish and verify the complete change for shipment</name>
  <files>packages/paja/src/host-page.ts, packages/paja/README.md, docs/packages/paja.md, .changeset/paja-explicit-signer-choice.md</files>
  <action>Adjust the signer-controls grid for the additional None button without shrinking the bunker input out of usability. Update both Paja docs to remove automatic first-run NIP-07 connection claims and explain origin-local preference persistence, safe None default, unavailable storage, explicit reconnect behavior and Bunker selection versus session credentials. Keep the existing identity.changed gap explicit. Add a patch changeset for @kehto/paja. Search active docs/tests for auto-connect assumptions and change additional files only on fresh evidence. Run all repository gates below, with a free KEHTO_HARNESS_PORT when needed; preserve unrelated servers. Run pinned AI-slop 0.12.0 with the existing config and restore score 100 without disabling rules. Record commands, counts, failures and skips in the quick summary. Specifically record the known paja-firewall-rules immediate popup.url empty failure if reproduced, not as a passing suite and not as permission to absorb unrelated work. Commit by explicit paths with agent credit; parent orchestrator owns push/PR closeout. High-or-critical unresolved threats block a ready-to-ship claim. No package installation or publishing task is authorized.</action>
  <verify><automated>pnpm build &amp;&amp; pnpm type-check &amp;&amp; pnpm test:unit &amp;&amp; pnpm docs:check &amp;&amp; pnpm test:e2e &amp;&amp; git diff --check</automated><human-check>Inspect None active styling and all controls at narrow and wide host widths; verify Bunker remains visibly selected after reload and requests credentials rather than silently selecting another signer.</human-check></verify>
  <done>Docs and patch changeset match behavior; full gates and pinned quality results are recorded without hiding failures; source is committed for parent shipment.</done>
</task>
</tasks>

<threat_model>
ASVS level 1; blocking threshold high.

| Boundary | Description |
|---|---|
| Storage to host | Origin-local preferences are untrusted and may be malformed or inaccessible. |
| Extension/bunker to controller | Asynchronous external responses can arrive after disconnect. |
| Host signer to napplet | Preference restoration must not grant new signing authority or bypass approvals. |

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-hew-01 | Tampering | Preference restoration | medium | mitigate | Allowlist methods; invalid reads default None; catch storage failures. |
| T-hew-02 | Elevation of privilege | Late connect completion | high | mitigate | Generation ownership for success and failure; close stale NIP-46 clients; test None during pending work. |
| T-hew-03 | Information disclosure | Persisted credentials | high | mitigate | Store method only; never URI/secret/key; test stored record contents. |
| T-hew-04 | Elevation of privilege | Restored signer | high | mitigate | Preserve shared Firewall and signer confirmation paths; cancel pending requests on selection changes. |
</threat_model>

## Source coverage audit

| Source | Item | Coverage |
|---|---|---|
| GOAL | User quick-task goal, no ROADMAP phase mutation | Tasks 1–3 |
| REQ | None option and fresh default | Task 1 |
| REQ | Persist every explicitly selected method including None | Task 2 |
| RESEARCH | Actual startup auto-connect, stale await risk, storage pattern, exact NAP authority | Tasks 1–2 |
| CONTEXT | User scope, tests/docs/changeset/full e2e, exclude PR #433 | Tasks 1–3 |

No separate CONTEXT or RESEARCH artifact supplied. No ORM/schema files or new external service integration are in scope. No package installs. Calibration factor 1, zero samples, low confidence.

<verification>
Focused unit and browser regressions, full build/types/unit/docs/e2e, pinned AI-slop and diff checks. NAP-IDENTITY no-signer query semantics are checked against the exact ref above; the pre-existing live-frame push gap is not claimed fixed. Any full-suite failure prevents a full-green claim and must be returned to the parent.
</verification>

<success_criteria>
None is visible and the first-run default; explicitly selected methods survive reload; no unchosen extension call occurs; disconnect is race-safe; tests/docs/release metadata move together; parent receives truthful verification and shipment evidence.
</success_criteria>

<output>
Create .planning/quick/261112-hew-default-paja-signer-to-none-and-persist-/261112-hew-SUMMARY.md with verification and scope notes. Do not change ROADMAP for this quick task.
</output>
