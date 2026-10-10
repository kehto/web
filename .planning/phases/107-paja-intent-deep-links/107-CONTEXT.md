# Phase 107: Paja Intent Deep Links

Source: the user approved the preceding design with “implement it and open a PR”.

## Goal

Create, share, review, and invoke Paja intent links using verified advertised napplet contracts without adding parameter types to NAP-INTENT.

## Locked requirements

- LINK-01: Accept a complete percent-encoded napplet URI in `intent`; retain ordinary pointer-only links. Decode the outer URL and inner URI independently. Reject duplicate decoded keys, malformed encodings, oversized input, unsupported fragments, and conflicting target instructions. Preserve literal plus and text values.
- LINK-02: Support recipient-default resolution, `#naddr` recommendations (only named 35129), and explicit `pointer` targeting. Verify exact contract support. A failed explicit target never silently falls back or loses the intent.
- LINK-03: Provide an explicit JSON payload mode via outer `payload`; prohibit inner query plus explicit payload. Preserve JSON primitive/null/array/object values.
- LINK-04: Add Create intent link to a napplet's Share flow. Read verified z/i contracts, select a convention, generate text fields from advertised names in order, allow omitted versus explicitly empty values and extra named fields. No inferred types or required fields. An empty params list does not prohibit payload.
- LINK-05: Builder supports routing modes, readable preview, Copy link, and explicit Test intent. Editing and opening never invoke. No intents => ordinary app sharing.
- LINK-06: Incoming intent links show a review/edit/launch view. Choose compatible handlers, resolve recommendation/install through ordinary verification and policy; never change defaults implicitly. Expose useful errors, explicit retry, and choose-another flow.
- LINK-07: Accepted delivery survives source teardown, waits for authenticated current target readiness, uses intent.deliver with onDelivery buffering, and cannot replay on render/tab restore. Acceptance is not handler completion.
- LINK-08: Preserve advertised params through manifest/catalog/resolver. Use publisher/kind-safe catalog identities, never bare d tags. Update supported shell, runtime, services, Paja and playground consumers together when shared interfaces change.
- LINK-09: External URLs cannot supply or impersonate sender. Implement the verified launcher napplet path proposed for conformance today; a native host/external sender extension is deferred, not silently invented. Verify source manifest/artifact and bind authenticated endpoint. Launcher and delivery grant no extra capabilities.
- LINK-10: Document URL contract, encoding, size limit, launch behavior, spec refs, compatibility handling and source identity. Add changesets for every changed shipped package. Keep pure parsing separate from UI.
- LINK-11: Verify behavioral units and real browser flows for parser vectors, advertised builder, copied link roundtrip, cold/warm delivery, readiness, cancellation/retry/no replay, explicit mismatch, recommendation/default precedence, JSON and forged sender. Run build, type-check, unit suite, relevant/full Playwright, docs and AI-slop gates.
- LINK-12: Commit by concern, push feature branch, open PR with scope, verification and upstream authority/gaps. Do not merge or release.

## Decisions

- D-01: Existing design is accepted; no repeated design approval is necessary. Routine implementation choices are delegated to the agent.
- D-02: Use current main in the isolated worktree `/Users/sandwich/.worktrees/kehto/paja-intent-links`; primary checkout's package.json change belongs to other work.
- D-03: HTTPS wrapper is Paja policy. The inner convention URI follows NAP-INTENT draft PR #106 exactly. The native external-origin representation remains a documented spec gap; the verified launcher provides a deployable conformant path now.
- D-04: Follow current host styling, accessible native controls/dialog patterns, focus management and mobile layout; text helpers explain format ownership without exposing irrelevant implementation details.
- D-05: Retained compatibility paths need bounded warnings, docs/compatibility.md entries and runtime tests per current AGENTS.md. Do not add silent aliases or globally warn on canonical calls.

## Canonical references

- `AGENTS.md` — lifecycle, conformance, compatibility and shipping rules.
- `packages/paja/src/browser-host.ts`, `packages/paja/src/browser-runtime-tabs.ts` — startup, persistence, sharing.
- `packages/paja/src/installed-napplet-catalog.ts`, `packages/paja/src/browser-intent-host.ts`, `packages/paja/src/browser-intent-controller.ts` — installed facts and lifecycle.
- `packages/services/src/manifest-intent-catalog.ts`, `packages/services/src/catalog-intent-resolver.ts`, `packages/services/src/intent-service.ts` — shared contract and resolver.
- `packages/shell/src/napplet-namespace.ts` — injected domain binding.
- `docs/compatibility.md`, `docs/policies/NIP-5D-CONFORMANCE.md` — tracked compatibility and protocol exceptions.
- `https://github.com/napplet/naps/blob/e5308ac92cfd49e4fb026812c60886571515e219/naps/NAP-INTENT.md` — checked master; has fragment/schema contradictions.
- `https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md` — checked PR #106 working authority reconciling those contradictions.
- `https://github.com/napplet/naps/blob/e5308ac92cfd49e4fb026812c60886571515e219/projections/web.md` — URI transposition and handler recommendation projection.
- `https://github.com/dskvr/nips/blob/020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md` — current NIP-5D PR #2303 head; verify before manifest/launcher work.

## Deferred

Native host/external sender protocol extension; convention-specific rich form helpers; remote payload hosting/short links; publishing a release.
