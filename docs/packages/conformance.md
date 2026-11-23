# @kehto/conformance

Runtime conformance suite for NIP-5D and the NAP domains a Kehto runtime
advertises. It runs a deterministic reference probe napplet against the real
`@kehto/runtime` + `@kehto/shell` + reference-service composition in a browser
and reports per-check results with the wire transcript as evidence.

This is the inverse of `@napplet/conformance`, which runs an untrusted napplet
against a reference shell. Here the napplet is the fixture and the runtime is
under test.

> **Alpha status:** the catalog covers NIP-5D core, optional NAP-SHELL, every
> supported NAP domain against its pinned revision, and mutation self-tests,
> behind a headless CLI and a live web UI (kehto/web#187). A passing run is
> never a claim of full NAP conformance; the final report line states the
> tested scope.

## Install

```bash
pnpm add -D @kehto/cli @playwright/test
npx playwright install chromium
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/conformance/package.json`, `packages/conformance/src/index.ts` |
| Version | `0.1.1` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Subpaths | `./kehto-target`, `./mutations`, `./cli`, `./browser` (self-contained browser bundle) |
| Dependencies | `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.42.0 <0.46.0` |
| `@napplet/nap` | `>=0.37.0 <0.46.0` |
| `nostr-tools` | `>=2.23.3 <=2.x` |
| `@playwright/test` | `^1.54.0` (optional; only the headless runner needs it) |

## Running It

```bash
kehto conformance                                  # full profile, pretty output
kehto conformance --profile minimal
kehto conformance --reporter junit --out conformance.xml
kehto conformance --ui                             # live web UI
kehto conformance --ui --exec "pnpm build --watch" # re-run on every rebuild
```

`--domain <name>` (repeatable) restricts per-domain and catalog cases to those
domains; NIP-5D core and NAP-SHELL checks always run.

Exit codes: `0` every applicable check passed (spec gaps are printed and
counted), `1` an error-severity check failed, `2` usage, target boot or harness
error. `--ready-timeout <ms>` bounds each probe wait; `--settle <ms>` is the
quiet window used to prove nothing was sent.

Every run executes both shell variants of the selected profile:
`<profile>/shell-present` and `<profile>/shell-absent`. NAP-SHELL is optional,
so the shell-absent variant must pass while another granted domain keeps
working.

## Web UI

`kehto conformance --ui` serves the web UI on loopback (`--port <n>`, default
a free port), prints its URL and opens it unless `--no-open` is given. The page
runs the catalog in the browser against the first-party target and shows the
verdict and counts, the advertised-versus-tested domain matrix with operation
coverage and drift per variant, the checks grouped by scope (NIP-5D core, NAP
semantics, wire contract, Kehto policy, catalog) with each check's authority
links and diagnostics, the authority refs, and the captured wire transcript.
`?profile=minimal&domain=theme` deep-links a selection, and the JSON report can
be downloaded.

The server watches the served bundle. When it changes, for example because
`--exec "pnpm build --watch"` rebuilt a fixture, it waits for a 300 ms quiet
period and then sends one `rerun` server-sent event on `/events`; the page
reloads and runs its selection again. `Ctrl-C` stops the server and the
`--exec` command, and exits `0`.

A static build of the same UI (no live re-runs) is published at
[/web/conformance/](https://kehto.github.io/web/conformance/) from
`apps/conformance`.

## Profiles

| Profile | Exposed domains |
|---------|-----------------|
| `minimal` | The always-on built-in domains that work without a backend: `identity`, `storage`, `inc`, `theme` (plus `shell` in the shell-present variant). `relay`, `keys`, `media` and `notify` are disabled, and no service is registered. |
| `full` | Every supported domain, each with a deterministic in-memory backend from `packages/conformance/src/kehto/domains/` (no network, devices or prompts): `relay`, `outbox`, `identity`, `storage`, `inc`, `theme`, `keys`, `media`, `notify`, `config`, `resource`, `cvm`, `upload`, `intent`, `count`, `link`, `common`, `lists`, `serial`, `ble`, `webrtc`, `dm`, `fs`, `gamepad`, `llm`, plus `shell`. The fixture user's signer signs and really encrypts (NIP-44 v2 and NIP-04, from `nostr-tools`), so the `relay.publishEncrypted` success path proves ciphertext. |

All probe endpoints get explicit host grants. Manifest `R`/`O` declarations
are checked, never used as grants.

## Check Catalog

| Id | Scope | Proves |
|----|-------|--------|
| `nip5d/sandbox` | `nip5d-core` | `sandbox="allow-scripts"` only, opaque origin, no storage |
| `nip5d/artifact-provenance` | `nip5d-core` | verified bytes reach the frame through `srcdoc`; the host prelude sits outside them |
| `nip5d/injection-order` | `nip5d-core` | granted domain objects exist before the first authored classic and module scripts |
| `nip5d/injection-scope` | `nip5d-core` | injected objects equal live host grants; `O` declarations never widen them |
| `nip5d/no-window-nostr` | `nip5d-core` | no NIP-07 global or signing authority in the napplet realm |
| `nip5d/port-private` | `nip5d-core` | the retained NAP port is unreachable from napplet code |
| `nip5d/manifest-capabilities` | `nip5d-core` | missing `O` domains never block loading; a missing `R` domain is rejected or warned about |
| `kehto/requires-preflight` | `kehto-policy` | Kehto's stricter policy: an unsupported `R` domain is rejected before any document exists |
| `nip5d/source-binding` | `nip5d-core` | identity comes from verified bytes; payload claims are ignored; an unregistered frame is dropped |
| `nip5d/port-binding` | `nip5d-core` | a second hello, a window-level message and a navigation each revoke the binding and remove the frame |
| `nip5d/unknown-envelope` | `nip5d-core` | unknown `domain.action` types are silently ignored |
| `nip5d/plain-object-wire` | `nip5d-core` | NIP-01 arrays and malformed envelopes are not an active path |
| `nip5d/readiness-independent` | `nip5d-core` | a granted domain answers before `shell.ready`, while `shell.init` is withheld, and with shell absent |
| `shell/optional` | `nap-spec` | shell can be omitted while another granted domain works |
| `shell/receiver-order` | `nap-spec` | the receiver is installed before one bare `shell.ready` |
| `shell/once-per-lifecycle` | `nap-spec` | exactly one `shell.init` per endpoint lifecycle; duplicates change nothing |
| `shell/source-trust` | `nap-spec` | window-level `shell.init` from parent or sibling is ignored; unregistered sources get nothing |
| `shell/environment-scope` | `nap-spec` | each `shell.init` describes only its own endpoint's domains and services |
| `shell/retained-environment` | `nap-spec` | `ready()`, `services` and `onReady()` retain the first environment |
| `shell/local-supports` | `nap-spec` | `supports(domain)` is synchronous, local and follows injected presence only |

### Domain and catalog checks

For every advertised domain, one probe granted that domain runs the domain's
fixture (`packages/conformance/src/fixtures/<domain>.ts`) over the raw port:

| Id | Scope | Proves |
|----|-------|--------|
| `<domain>/correlation` | `wire-contract` | every request gets its canonical reply type with the same `id`; fire-and-forget operations get nothing |
| `<domain>/semantics` | `nap-spec` | each assertion argued from a sentence of the pinned NAP revision holds |
| `<domain>/push` | `wire-contract` | host-triggered or request-caused pushes arrive and stop after unsubscribe |
| `inc/endpoint-identity`, `inc/sender-exclusion`, `inc/topic-routing`, `inc/channel-lifecycle` | `nap-spec` | NAP-INC across publishers, root manifests, simultaneous instances and replacement |
| `catalog/advertised-domain-covered` | `catalog` | every advertised domain has a fixture, every inventoried operation a passing case or a semantic gap row |
| `catalog/package-drift` | `catalog` | the installed `@napplet/nap` types cover every operation the pinned NAPs specify |
| `catalog/package-field-drift` | `catalog` | every payload field a pinned wire table names, with its optionality, matches the installed `@napplet/nap` message; differences a pinned NAP sentence settles pass, table-versus-prose contradictions are `spec-gap` |
| `catalog/capability-truthfulness` | `nip5d-core` | an advertised (injected) domain services every request it is sent |
| `catalog/acl-denial` | `wire-contract` | a revoked ACL capability runs no backend and answers only with message types the NAP defines |
| `catalog/firewall-denial` | `wire-contract` | a legacy Firewall rejection fires, runs no backend and answers only with message types the NAP defines, in every domain including the ones ACL does not gate |
| `catalog/endpoint-isolation` | `nip5d-core` | destroying one endpoint stops its pushes without affecting another |
| `catalog/broadcast-to-loaded` | `nap-spec` | required broadcasts (theme, identity) reach loaded napplets before their first message |

`nip5d/unknown-envelope` sends an unknown action to every advertised domain.

`catalog/firewall-denial` needs `TargetSession.openLegacyFirewall()`: a scoped
session of the same variant whose runtime has no `permissions` coordinator and
denies through the legacy behavioral Firewall, with the `firewall.block` and
`firewall.rejections` controls. Canonical admission (`admitBrowserDocument`)
requires `permissions`, so a host on the legacy gate binds identity at
`napplet.hello` instead; the first-party target does the same for this scoped
session only. A target without the method skips the check.

### Adding a domain fixture

1. Add `fixtures/<domain>.ts` exporting a `DomainFixture`: one `OperationCase`
   per napplet -> runtime operation of the inventory, `PushCase`s for pushes,
   and `OperationGap` rows only for a genuine semantic gap (`spec-gap`) or an
   honest harness limit (`harness`, which keeps the operation uncovered).
2. Add `kehto/domains/<domain>.ts` exporting a `DomainBackendModule` with an
   in-memory backend and the host controls its pushes name.
3. Register both in `fixtures/index.ts` and `kehto/domains/index.ts`.

Only add `semantics` when the assertion is argued from a specific sentence of
the pinned NAP; otherwise the case is wire-contract coverage, and the summary
counts it as such.

### The drift guard

`src/catalog/inventory.generated.ts` pins every supported domain's operations
and per-message payload fields from both the installed
`@napplet/nap/<domain>/types.d.ts` and the wire table of the NAP document at
the ref in `src/authority.ts`. Packaged fields come from the TypeScript checker
over the domain's `<Domain>NapMessage` union (`src/catalog/nap-type-fields.ts`,
generator and tests only), so inherited `@napplet/core` fields and
result-or-error unions resolve; a field is required only when every branch of
its message requires it. Wire-table fields come from the payload column:
`` `name?` ``, `` `name`? `` and ``optional `name` `` are optional, `` `a` or `b` ``
makes both optional, parenthesised notes are type hints. A cell that spreads a
named type (`` `DmStatus` or `DmError` ``) is `open`: its named fields are still
compared, but packaged extras are not. A cell that is prose (`llm.delta`) is
not compared. The check lists both kinds, and
`src/catalog/field-drift.test.ts` pins that list.

`src/catalog/field-drift.ts` holds `FIELD_DRIFT_EXCEPTIONS`: each row quotes
the pinned NAP sentence that settles one difference, matched exactly on type,
field and both presences, so a row stops applying as soon as either side
moves, and a test fails on a row that no longer matches. A row without a
quotable sentence does not belong there; the difference stays a finding.

Regenerate the inventory with
`node packages/conformance/scripts/generate-inventory.ts` (needs network).
`src/catalog/inventory.test.ts` fails when:

- the installed package version changes, or a domain's packaged operations or
  message fields differ from the pinned inventory (a new or renamed
  discriminant or field);
- the package ships a domain directory that is neither supported nor listed
  as deliberately unrouted;
- the supported list drifts from the shell's advertisable domains;
- a supported domain has no fixture, or an inventoried operation has neither
  a case nor a `spec-gap` row.

## Mutation Self-Tests

`tests/e2e/conformance-mutations.spec.ts` proves the checks are not
decorative. Each named mutation in `packages/conformance/src/mutations.ts`
breaks one property of the real first-party target, and the run must then
fail exactly the mutation's declared check ids plus the target's known
findings (`tests/e2e/helpers/conformance-findings.ts`). Each mutation also
counts the places it took effect, so one that silently stops applying fails
the spec.

| Mutation | Must fail |
|----------|-----------|
| `inject-window-nostr` | `nip5d/no-window-nostr` |
| `accept-forged-source` | `nip5d/source-binding`, `shell/source-trust` |
| `omit-granted-shell` | `nip5d/injection-order`, `nip5d/injection-scope`, and downstream every check that needs the shell object |
| `duplicate-shell-init` | `shell/once-per-lifecycle` |
| `gate-on-shell-ready` | `nip5d/readiness-independent` |
| `advertise-uncovered-domain` | `catalog/advertised-domain-covered` |
| `drop-correlation-id` | `theme/correlation`, `theme/semantics`, and the catalog checks it leaves without a working theme case |
| `inc-dtag-identity` | `inc/endpoint-identity`, `inc/channel-lifecycle` |
| `retain-state-after-destroy` | `inc/topic-routing`, `inc/channel-lifecycle` |
| `supports-depends-on-init` | `shell/local-supports` |
| `init-invents-domain` | `shell/local-supports` |
| `advertise-disabled-backend` | `catalog/capability-truthfulness`, `relay/correlation`, `relay/semantics` |

In a page, `runKehtoMutation(name, options)` from the browser bundle runs one.

## Authority and Spec Gaps

Every run records the exact sources the catalog was written against in
`run.authority`: NIP-5D at the head of nostr-protocol/nips#2303, `napplet/naps`
master for merged NAPs, the exact head of each open NAP pull request for draft
domains, and the installed `@napplet/nap`/`@napplet/core` versions.

- `nip5d-core` checks argue from NIP-5D; `nap-spec` checks from a pinned NAP
  revision; `wire-contract` checks only from the packaged types;
  `kehto-policy` checks test a Kehto choice stricter than the protocol.
- An open or draft NAP pull request is working authority at its recorded head.
  Being unmerged is never a spec gap.
- `spec-gap` is reserved for a specific missing or contradictory semantic
  decision, with its authority link and the bounded policy applied. Missing
  coverage, missing package APIs and known implementation failures are
  failures.

## Primary APIs

| Area | Exports |
|------|---------|
| Engine | `runConformance`, `conformanceStatement`, `ConformanceHarnessError`, `SCENARIOS` |
| Result model | `ConformanceRun`, `CheckResult`, `RunSummary`, `TranscriptEntry`, `AuthorityRef` |
| Target contract | `ConformanceTarget`, `TargetSession`, `ProbeSpec`, `ProbeEndpoint` |
| Probe fixtures | `renderProbeArtifact`, `renderWireTap`, `ProbePlan`, `ProbeReport` |
| Reporters | `formatReport`, `REPORTERS` |
| Mutations | `MUTATIONS`, `createMutation`, `MutationSpec` (`@kehto/conformance/mutations`) |
| First-party target | `createKehtoTarget` (`@kehto/conformance/kehto-target`) |
| Headless runner and live UI | `runConformanceCli`, `startHarnessServer`, `startLiveUi`, `renderUiPage` (`@kehto/conformance/cli`) |
| Web UI | `mountKehtoConformanceUi`, `mountConformanceUi`, `renderRun` (`@kehto/conformance/browser`) |

## Scope Boundaries

- Owns the check catalog, the result model, reporters, the probe fixtures and
  the deterministic first-party Kehto target.
- Collection is asynchronous and side-effectful (it loads probes); checks are
  pure functions over captured facts.
- Fixtures are target-agnostic data; the first-party target supplies the
  backends and host controls (`acl.revoke`, `backend.calls`, `firewall.block`,
  `firewall.rejections`, `<domain>.<verb>`).
- Keeps browser automation out of the engine: only `@kehto/conformance/cli`
  touches Playwright, through the optional `@playwright/test` peer.
- Never reaches public relays, real hardware, user prompts or the network.
- Does not own the `kehto` binary; `@kehto/cli` routes `kehto conformance` here.

## API Reference

- Generated module: <a href="../api/modules/_kehto_conformance.html" target="_self"><code>docs/api/modules/_kehto_conformance.html</code></a>
- NIP-5D conformance policy: [NIP-5D Conformance](/policies/NIP-5D-CONFORMANCE)
