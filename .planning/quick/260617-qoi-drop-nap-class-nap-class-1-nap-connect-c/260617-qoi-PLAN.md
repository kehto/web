---
phase: quick-260617-qoi
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QOI-CLASS, QOI-CONNECT]
files_modified:
  - packages/runtime/src/enforce.ts
  - packages/runtime/src/types.ts
  - packages/runtime/src/index.ts
  - packages/runtime/src/runtime.ts
  - packages/shell/src/types/internal-class.ts
  - packages/shell/src/types/internal-connect.ts
  - packages/shell/src/types/internal-resource.ts
  - packages/shell/src/connect-store.ts
  - packages/shell/src/shell-ready.ts
  - packages/shell/src/shell-init.ts
  - packages/shell/src/shell-bridge.ts
  - packages/shell/src/types.ts
  - packages/shell/src/index.ts
  - packages/services/src/resource-service.ts
  - apps/playground/src/shell-host.ts
  - apps/playground/src/demo-hooks.ts
  - apps/playground/src/main.ts
  - apps/playground/vite.config.ts
  - packages/shell/src/shell-init.test.ts
  - packages/shell/src/shell-supports-conformance.test.ts
  - packages/shell/src/shell-bridge.test.ts
  - packages/shell/tests/no-window-nostr.test.ts
  - tests/e2e/class-invariant.spec.ts
  - tests/e2e/connect-consent.spec.ts
  - tests/e2e/connect-csp-preview.spec.ts
  - tests/e2e/connect-revocation.spec.ts
  - tests/e2e/gateway-artifact-parity.spec.ts
  - docs/policies/SHELL-CLASS-POLICY.md
  - docs/policies/SHELL-CONNECT-POLICY.md
  - docs/policies/index.md
  - docs/policies/SHELL-RESOURCE-POLICY.md
  - docs/packages/shell.md
  - docs/.vitepress/config.ts
  - specs/NIP-5D.md
  - .changeset/

must_haves:
  truths:
    - "There is NO class concept anywhere in kehto first-party source — no NappletClass type, no class wire field, no per-class allowlist, no class enforcement branch."
    - "There is NO NAP-CONNECT concept in kehto shell — no connect-store, no connect-src CSP middleware, no /__connect-grants endpoint, no connect-revoked event, no connect/class capability tokens."
    - "The runtime consent handler (ConsentHandler / firewall-policy ConsentRequest variant) is untouched and still functions."
    - "The firewall package and its opClass machinery are untouched."
    - "pnpm build, pnpm type-check, pnpm test:unit, pnpm docs:check are all green; AI-slop gate is restored to 100."
    - "Changesets exist for @kehto/runtime and @kehto/shell (minor on 0.x) plus any other package whose shipped output changed."
  artifacts:
    - path: "packages/runtime/src/enforce.ts"
      provides: "EnforceResult without 'class-forbidden'; resolveIdentityByWindowId returns {dTag,aggregateHash} only; no CLASS_CAPABILITY_ALLOWLIST; no class pre-filter."
      contains: "createNubEnforceGate"
    - path: "packages/shell/src/shell-init.ts"
      provides: "Capability ontology arrays with no 'class'/'connect' tokens (both NAP_DOMAINS and LEGACY_NUB_DOMAINS)."
      contains: "NAP_DOMAINS"
    - path: ".changeset/"
      provides: "Minor-bump changesets for @kehto/runtime and @kehto/shell."
  key_links:
    - from: "packages/runtime/src/runtime.ts"
      to: "createNubEnforceGate"
      via: "resolveIdentityByWindowId object literal"
      pattern: "resolveIdentityByWindowId"
    - from: "apps/playground/src/demo-hooks.ts"
      to: "createResourceService"
      via: "getConnectGrants option (post-connect grant source)"
      pattern: "getConnectGrants"
---

<objective>
Clean-break removal of NAP-CLASS, NAP-CLASS-1, and NAP-CONNECT from the kehto monorepo.
No backwards compat, no deprecation shims, no aliases. Match the upstream @napplet v0.33.0
removal and go one step further per the user decision: strip the `shell.init.class` wire
field entirely so there is NO class concept anywhere in kehto.

Purpose: keep kehto's protocol surface aligned with @napplet, which removed these NAPs
upstream (napplet/web#48). Carrying dead class/connect machinery is drift and slop.

Output: @kehto/runtime + @kehto/shell with all class/connect machinery removed, playground
consumers updated to compile and run, class/connect-only tests deleted and mixed tests
trimmed, hand-authored docs/specs updated, generated docs regenerated, and minor-bump
changesets for every package whose shipped output changed.

NOT autonomous: Task 4 is a `checkpoint:decision` because the playground resource demo
previously sourced its per-napplet fetch-origin allowlist from the (now deleted)
connect-store, and the replacement grant source is a playground policy choice CONTEXT.md did
not resolve.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260617-qoi-drop-nap-class-nap-class-1-nap-connect-c/260617-qoi-CONTEXT.md
@CLAUDE.md

<critical_boundaries>
From CONTEXT.md "CRITICAL boundary — do NOT remove". NOT connect/class; MUST stay intact:

1. Runtime consent handler: `ConsentHandler`, `onConsentRequest`, POLICY-02
   destructive-signing-kind consent, the `firewall-policy` `ConsentRequest` variant
   (packages/runtime/src/types.ts). SIGNING / FIREWALL consent, NOT connect consent.
2. The firewall package + its rate-limiting / op-class machinery (firewall-state.ts
   `opClass` strings like `relay:write`). Unrelated to NAP-CLASS. Do not touch.
3. `resource-service.ts` `getConnectGrants` is a GENERIC host-supplied origin-grant option on
   `ResourceServiceOptions` — NOT the connect-store, NOT NAP-CONNECT machinery. The resource
   fetch proxy is a separate, still-legitimate concern. Keep `getConnectGrants`. (Verified:
   resource-service.ts uses a host-injected option; resource-service.test.ts mocks it with
   `vi.fn` — neither imports connect-store.)

RESOLVED by reading emit sites (CONTEXT instruction "decide by reading the emit sites — do
not guess"): the `'class-forbidden'` value in `internal-resource.ts` `ResourceErrorCode` is
ORPHAN. `resource-service.ts` only emits `denied | invalid-url | canceled | network-error`
(sendResourceError signature, line 180). Nothing emits `'class-forbidden'`. Per CONTEXT, an
unreachable code is removed with its (absent) emission -> remove it from the union.
</critical_boundaries>

<interfaces>
<!-- Contracts extracted from the codebase. Executor uses these directly — no re-explore. -->

packages/runtime/src/types.ts:
- `export type NappletClass = string | null;`  -> DELETE
- `AclCheckEvent.reason?: 'allowed' | 'capability-missing' | 'class-forbidden';` -> drop the
  `'class-forbidden'` member (keep the other two; field stays optional)
- `SessionEntry.class: NappletClass;` -> DELETE the field + its CLASS-02 doc comment

packages/runtime/src/enforce.ts:
- drop `NappletClass` from the `./types.js` import
- `const CLASS_CAPABILITY_ALLOWLIST = Object.freeze({...})` (+ JSDoc) -> DELETE entirely
- `EnforceResult.reason` -> drop `'class-forbidden'` (becomes `'allowed' | 'capability-missing'`)
- `NubEnforceConfig.resolveIdentityByWindowId` return type -> `{ dTag: string; aggregateHash: string } | undefined`
- in `enforceNub`: delete `const nappletClass = entry?.class ?? null;` and the whole
  `if (nappletClass !== null) { ... return { allowed:false, ... 'class-forbidden' } }` block

packages/runtime/src/index.ts: drop `NappletClass,` from the `export type { ... } from './types.js'` block.

packages/runtime/src/runtime.ts (~452-457): change the `resolveIdentityByWindowId` return
literal `{ dTag: entry.dTag, aggregateHash: entry.aggregateHash, class: entry.class }`
-> `{ dTag: entry.dTag, aggregateHash: entry.aggregateHash }`.

packages/shell/src/shell-init.ts: remove `'connect', 'class'` from BOTH `LEGACY_NUB_DOMAINS`
and `NAP_DOMAINS`; update every `@example` array in the `buildShellCapabilities` JSDoc to
drop `'connect'`/`'class'` (typedoc/docs:check reads these).

packages/shell/src/types.ts: delete the `internal-class.js` import; change
`onNip5dIframeCreate?` return type to `{ dTag: string; aggregateHash: string } | null` and
drop the CLASS-01 "INCLUDING the class posture" JSDoc; drop `'connect'`/`'class'` from the
`ShellCapabilities` JSDoc `@example` arrays.

packages/shell/src/index.ts: delete the `NappletClass` re-export (+ its v1.7 comment), the
`connectStore`/`connectGrantKey` value export, the `ConnectStore` type export, and the
`ConnectGrant`/`ConnectGrantKey`/`ConnectConsentRequest`/`ConsentResult` type export. KEEP the
`./types/internal-resource.js` re-export block.

packages/shell/src/shell-bridge.ts: delete the `connect-store.js` import (line 13), the
`readonly connectStore: ConnectStore;` interface member + JSDoc (~154), and the
`get connectStore()` getter (~277-279).

packages/shell/src/shell-ready.ts: delete the `internal-class.js` import; remove
`class: identity.class` from the SessionEntry literal; change `resolveNip5dIdentity` return
type to `{ dTag; aggregateHash } | null` and drop `class` from both returns; delete
`classToWireCode`; in `postShellInit` remove `resolvedClass`, the `class: number | null` field
on the init-msg type, and `class: classToWireCode(...)` from `initMsg`.

apps/playground/src/shell-host.ts: drop the `connectStore` import (line 11); remove
`CLASS_BY_DTAG` + `class:` in registerSessionEntry (~480); remove the `__setNappletClass__`
ref (~147); replace `connectStore.getOrigins(...)` feeding `injectCspMeta` (~511) per Task 4.

apps/playground/src/demo-hooks.ts: drop the `connectStore` import; replace the
`getConnectGrants: (dTag,hash) => connectStore.getOrigins(...)` arg (~171) per Task 4. Keep
`isOriginGranted`/`fetch`/`resolveIdentity`.

apps/playground/src/main.ts: drop `connectStore` + `NappletClass` from the `@kehto/shell`
import (line 22, keep `Capability`); delete `grantConnectOrigin`, `__grantConnectOrigin__`,
`__revokeConnect__`, and the POST `/__connect-grants` fetch (~208-237).

apps/playground/vite.config.ts: delete the `serve-napplet-csp` plugin + registration, the
POST `/__connect-grants` middleware (configureServer + configurePreviewServer), the
`connect-src`/`CSP_NO_GRANTS` header builder, and the `connectGrantKey` mirror (~366-567).
Keep unrelated plugins.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Strip class from @kehto/runtime (enforce + types + index + runtime)</name>
  <read_first>
    packages/runtime/src/enforce.ts
    packages/runtime/src/types.ts
    packages/runtime/src/index.ts
    packages/runtime/src/runtime.ts (lines 440-460)
    packages/runtime/src/enforce.test.ts (if present)
  </read_first>
  <behavior>
    - createNubEnforceGate: a windowId resolving to {dTag,aggregateHash} (no class) delegates
      to checkAcl and returns reason 'allowed' or 'capability-missing'. No path returns
      'class-forbidden' (the type no longer permits it).
    - EnforceResult.reason union is exactly 'allowed' | 'capability-missing'.
    - AclCheckEvent.reason union is exactly 'allowed' | 'capability-missing' (still optional).
    - NappletClass is not exported from @kehto/runtime.
  </behavior>
  <action>
    In types.ts: delete the `NappletClass` type + comment; remove `'class-forbidden'` from
    `AclCheckEvent.reason` (+ its JSDoc bullet); remove `SessionEntry.class` (+ CLASS-02 doc).

    In enforce.ts: drop `NappletClass` from the import; delete `CLASS_CAPABILITY_ALLOWLIST`
    (+ JSDoc); remove `'class-forbidden'` from `EnforceResult.reason`; change
    `NubEnforceConfig.resolveIdentityByWindowId` to return `{ dTag; aggregateHash } | undefined`;
    in `enforceNub` delete the `nappletClass` resolution and the entire class pre-filter `if`
    block; update the NubEnforceConfig JSDoc that references CLASS-03 / class pre-filter.

    In index.ts: remove `NappletClass,` from the export block.

    In runtime.ts: change the `resolveIdentityByWindowId` return literal to drop `class:`.

    Update/delete any runtime unit test that asserts class behavior or 'class-forbidden';
    keep existing capability-missing / allowed assertions, do not invent new vectors.
  </action>
  <verify>
    <automated>pnpm --filter @kehto/runtime type-check &amp;&amp; pnpm --filter @kehto/runtime test; test $(grep -rEn "NappletClass|CLASS_CAPABILITY_ALLOWLIST|class-forbidden" packages/runtime/src | grep -vc node_modules) -eq 0</automated>
  </verify>
  <acceptance_criteria>
    No NappletClass / CLASS_CAPABILITY_ALLOWLIST / class-forbidden token in packages/runtime/src.
    @kehto/runtime type-checks and unit tests pass. Consent handler + firewall untouched.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Remove class + connect from @kehto/shell source</name>
  <read_first>
    packages/shell/src/types/internal-class.ts
    packages/shell/src/types/internal-connect.ts
    packages/shell/src/types/internal-resource.ts
    packages/shell/src/connect-store.ts
    packages/shell/src/shell-init.ts
    packages/shell/src/shell-ready.ts
    packages/shell/src/shell-bridge.ts
    packages/shell/src/types.ts
    packages/shell/src/index.ts
  </read_first>
  <behavior>
    - buildShellCapabilities(hooks): returned `naps`, `nubs`, `domains` contain NO 'class' and
      NO 'connect'; all other domains unchanged and in existing order.
    - The shell.init message posted by postShellInit has NO `class` field.
    - @kehto/shell no longer exports NappletClass, connectStore, connectGrantKey, ConnectStore,
      ConnectGrant, ConnectGrantKey, ConnectConsentRequest, ConsentResult.
    - ResourceErrorCode union is exactly 'denied' | 'canceled' | 'network-error' | 'invalid-url'.
  </behavior>
  <action>
    Delete internal-class.ts, internal-connect.ts, connect-store.ts.

    internal-resource.ts: remove `'class-forbidden'` from `ResourceErrorCode`; update the
    file-header JSDoc "5 codes {...class-forbidden}" to the 4 remaining codes.

    shell-init.ts: remove `'connect', 'class',` from `LEGACY_NUB_DOMAINS` and `NAP_DOMAINS`;
    drop both tokens from every `@example` array in the buildShellCapabilities JSDoc.

    shell-ready.ts: drop the internal-class import; remove `class: identity.class` from the
    SessionEntry literal; change `resolveNip5dIdentity` return type + both returns to drop
    class; delete `classToWireCode`; in `postShellInit` remove `resolvedClass`, the
    `class: number | null` field, and `class: classToWireCode(...)`; fix SHELL-02 JSDoc.

    shell-bridge.ts: delete the connect-store import, the `connectStore` interface member +
    JSDoc, and the `get connectStore()` getter.

    types.ts: delete the internal-class import; change `onNip5dIframeCreate?` return type to
    `{ dTag; aggregateHash } | null` and rewrite its JSDoc to drop CLASS-01; drop
    'connect'/'class' from the ShellCapabilities JSDoc @example arrays.

    index.ts: delete the NappletClass re-export (+ comment), the connectStore/connectGrantKey
    value export, the ConnectStore type export, and the ConnectGrant/ConnectGrantKey/
    ConnectConsentRequest/ConsentResult type export. Keep the internal-resource re-export.
  </action>
  <verify>
    <automated>pnpm --filter @kehto/shell type-check; test ! -f packages/shell/src/connect-store.ts &amp;&amp; test ! -f packages/shell/src/types/internal-class.ts &amp;&amp; test ! -f packages/shell/src/types/internal-connect.ts; test $(grep -rEn "NappletClass|connectStore|classToWireCode|ConnectGrant|'class'|'connect'|class-forbidden" packages/shell/src | grep -vc node_modules) -eq 0</automated>
  </verify>
  <acceptance_criteria>
    The three files are deleted; @kehto/shell type-checks; capability arrays + shell.init carry
    no class/connect; no class/connect residue in packages/shell/src; resource error vocabulary
    is the 4 remaining codes.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Build runtime+shell+services together; fix services docstrings referencing deleted connectStore</name>
  <read_first>
    packages/services/src/resource-service.ts (lines 26-42, 300-315)
    packages/services/src/resource-service.test.ts
  </read_first>
  <action>
    `getConnectGrants` on `ResourceServiceOptions` STAYS (boundary #3). Do not change
    resource-service.ts behavior or the factory guard, and do NOT rename `getConnectGrants`.
    Its JSDoc @example blocks reference `connectStore.getOrigins(...)` (now deleted) — rewrite
    those snippets to a neutral host-supplied grant source so docs reference no deleted export.

    Confirm resource-service.test.ts still passes unchanged (mocks getConnectGrants with
    vi.fn, no connect-store dependency); trim any class/connect import if present.

    Build the refactored packages together to confirm the graph links.
  </action>
  <verify>
    <automated>pnpm --filter @kehto/runtime --filter @kehto/shell --filter @kehto/services build &amp;&amp; pnpm --filter @kehto/services test; test $(grep -rn "connectStore" packages/services/src | grep -vc node_modules) -eq 0</automated>
  </verify>
  <acceptance_criteria>
    runtime + shell + services build green; services tests pass; no connectStore reference in
    services source/docstrings; getConnectGrants option preserved.
  </acceptance_criteria>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>
    How should the playground resource demo source its per-napplet fetch-origin allowlist now
    that the connect-store (the prior grant source) is deleted?
  </decision>
  <context>
    The playground wired createResourceService({ getConnectGrants: (dTag,hash) =>
    connectStore.getOrigins(dTag,hash) }) in demo-hooks.ts; shell-host.ts built the srcdoc
    connect-src CSP meta from connectStore.getOrigins(...); main.ts exposed
    __grantConnectOrigin__/__revokeConnect__ test hooks. CONTEXT.md scoped the clean break to
    @kehto/runtime + @kehto/shell and did NOT resolve what the playground resource demo does
    for an origin allowlist after connect is gone. The resource fetch proxy itself is NOT
    connect machinery and stays. This is a playground policy choice — surfaced, not guessed.
  </context>
  <options>
    <option id="static-allowlist">
      <name>Static per-dTag origin allowlist constant in the playground</name>
      <pros>Keeps the resource demo functional end-to-end; smallest behavior change; CSP meta stays meaningful.</pros>
      <cons>Introduces a small new playground constant map to replace the deleted store.</cons>
    </option>
    <option id="open-then-csp-none">
      <name>Drop the per-napplet allowlist; grant no origins (CSP connect-src 'none')</name>
      <pros>Most aligned with clean break — no grant concept survives; least new code.</pros>
      <cons>Resource-demo fetch proxy returns 'denied' for all origins -> demo fetch feature disabled; may break a resource-demo e2e/UAT expectation.</cons>
    </option>
    <option id="env-config">
      <name>Source the allowlist from a playground build-time config/env value</name>
      <pros>No hardcoded map; configurable per deployment.</pros>
      <cons>More wiring than a reference playground needs.</cons>
    </option>
  </options>
  <resume-signal>Select: static-allowlist, open-then-csp-none, or env-config (and note any resource-demo e2e/UAT spec the choice affects).</resume-signal>
</task>

<task type="auto">
  <name>Task 5: Remove class/connect from playground consumers + vite CSP machinery (apply Task 4 decision)</name>
  <read_first>
    apps/playground/src/shell-host.ts (lines 1-30, 140-150, 460-515)
    apps/playground/src/demo-hooks.ts (lines 1-30, 155-185)
    apps/playground/src/main.ts (lines 1-30, 200-240)
    apps/playground/vite.config.ts (lines 180-210, 350-590)
  </read_first>
  <action>
    Apply the Task 4 decision as the resource grant source.

    main.ts: drop connectStore + NappletClass from the @kehto/shell import (keep Capability);
    delete grantConnectOrigin, __grantConnectOrigin__, __revokeConnect__, and the POST
    /__connect-grants fetch.

    demo-hooks.ts: drop the connectStore import; replace the getConnectGrants arg to
    createResourceService with the Task 4 source (static map / () => [] / env-config). Keep
    isOriginGranted, fetch, resolveIdentity.

    shell-host.ts: drop the connectStore import; remove CLASS_BY_DTAG + the class: field in
    registerSessionEntry; remove the __setNappletClass__ ref; replace
    connectStore.getOrigins(...) feeding injectCspMeta with the Task 4 source (or [] for
    open-then-csp-none). Any onNip5dIframeCreate hook must no longer return class.

    vite.config.ts: delete the serve-napplet-csp plugin + registration, the POST
    /__connect-grants middleware, the connect-src/CSP_NO_GRANTS header builder, and the
    connectGrantKey mirror. Keep unrelated plugins.
  </action>
  <verify>
    <automated>pnpm build; test $(grep -rEn "connectStore|NappletClass|__connect-grants|connect-src|connect-revoked|CLASS_BY_DTAG|__setNappletClass|__grantConnectOrigin|__revokeConnect" apps/playground/src apps/playground/vite.config.ts | grep -vc node_modules) -eq 0</automated>
  </verify>
  <acceptance_criteria>
    pnpm build green for the whole workspace incl. playground; resource demo uses the Task 4
    source; no connect/class residue in playground source or vite.config.ts.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 6: Tests sweep — delete class/connect-only specs, trim mixed specs, keep type-check + unit green</name>
  <read_first>
    packages/shell/src/shell-init.test.ts
    packages/shell/src/shell-supports-conformance.test.ts
    packages/shell/src/shell-bridge.test.ts
    packages/shell/tests/no-window-nostr.test.ts
    tests/unit/napplet-resolver.test.ts
    tests/e2e/gateway-artifact-parity.spec.ts
    tests/e2e/class-invariant.spec.ts
    tests/e2e/connect-consent.spec.ts
    tests/e2e/connect-csp-preview.spec.ts
    tests/e2e/connect-revocation.spec.ts
  </read_first>
  <action>
    Delete the four class/connect-only e2e specs: tests/e2e/class-invariant.spec.ts,
    connect-consent.spec.ts, connect-csp-preview.spec.ts, connect-revocation.spec.ts.

    Trim the mixed specs to the post-removal ontology, importing nothing removed:
    - shell-init.test.ts: drop 'class'/'connect' from expected capability arrays; fix counts.
    - shell-supports-conformance.test.ts: remove class:null fixtures + supports('class'/'connect').
    - shell-bridge.test.ts: remove connectStore + entry.class assertions (4 refs).
    - no-window-nostr.test.ts: drop 'class'/'connect' from the asserted ontology list.
    - gateway-artifact-parity.spec.ts: drop the single class/connect ref; keep the spec.
    - napplet-resolver.test.ts: confirm type-check (0 matches at plan time); trim removed-export imports.

    e2e is NOT executed by this gate, but every remaining spec MUST compile under pnpm
    type-check with no dangling imports of removed exports.
  </action>
  <verify>
    <automated>test ! -f tests/e2e/class-invariant.spec.ts &amp;&amp; test ! -f tests/e2e/connect-consent.spec.ts &amp;&amp; test ! -f tests/e2e/connect-csp-preview.spec.ts &amp;&amp; test ! -f tests/e2e/connect-revocation.spec.ts &amp;&amp; pnpm type-check &amp;&amp; pnpm test:unit</automated>
  </verify>
  <acceptance_criteria>
    The four specs are gone; pnpm type-check green workspace-wide with no dangling removed-export
    imports; pnpm test:unit passes; no remaining test asserts a 'class'/'connect' capability
    token, connectStore, or entry.class.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 7: Docs + specs sweep — delete policy docs, trim references, regenerate generated docs</name>
  <read_first>
    docs/policies/SHELL-CLASS-POLICY.md
    docs/policies/SHELL-CONNECT-POLICY.md
    docs/policies/index.md
    docs/policies/SHELL-RESOURCE-POLICY.md
    docs/packages/shell.md
    docs/.vitepress/config.ts (lines 90-105)
    specs/NIP-5D.md
  </read_first>
  <action>
    Delete docs/policies/SHELL-CLASS-POLICY.md and docs/policies/SHELL-CONNECT-POLICY.md.

    docs/.vitepress/config.ts: remove the "Shell Class Policy" and "Shell Connect Policy"
    sidebar entries (~97-98).

    docs/policies/index.md: remove the SHELL-CLASS-POLICY / SHELL-CONNECT-POLICY index entries.

    docs/packages/shell.md (line 44): drop `NappletClass, ConnectGrant, ConnectGrantKey,
    ConnectConsentRequest, ConsentResult,` from the "Shell-owned internal models" row — keep
    the resource request/result/error types. Remove any other class/connect rows or
    connectStore mentions.

    docs/policies/SHELL-RESOURCE-POLICY.md: update prose so the resource grant source is
    described as host-supplied (the getConnectGrants option name stays as a contract
    identifier); remove __grantConnectOrigin__ / connect-store / /__connect-grants references
    that no longer exist; reconcile with the Task 4 decision.

    specs/NIP-5D.md: remove NAP-CLASS / NAP-CONNECT / NUB-CLASS / NUB-CONNECT definitions, the
    class/connect domain rows, and the shell.init.class wire field description (protocol context
    only — leave unrelated "classify"-style uses).

    Do NOT hand-edit docs/api/** or docs/.vitepress/dist/** (generated; regenerate via
    docs:check). Leave docs/superpowers/specs/ historical records as-is. Keep every type still
    referenced by docs exported so typedoc --treatWarningsAsErrors stays green.

    Run pnpm docs:check; fix any typedoc warning from a now-missing export reference.
  </action>
  <verify>
    <automated>test ! -f docs/policies/SHELL-CLASS-POLICY.md &amp;&amp; test ! -f docs/policies/SHELL-CONNECT-POLICY.md &amp;&amp; pnpm docs:check; test $(grep -rlE "NappletClass|connectStore|ConnectGrant|SHELL-CLASS-POLICY|SHELL-CONNECT-POLICY" docs specs packages/runtime/README.md packages/shell/README.md 2>/dev/null | grep "\.md$" | grep -vE "docs/api/|vitepress/dist|superpowers/specs" | wc -l) -eq 0</automated>
  </verify>
  <acceptance_criteria>
    Both class/connect policy docs deleted + unlinked from sidebar/index; docs/packages/shell.md,
    SHELL-RESOURCE-POLICY.md, specs/NIP-5D.md carry no NappletClass/connect-store/NAP-CLASS/
    NAP-CONNECT references; pnpm docs:check green; no first-party hand-authored doc/spec
    references the removed surface.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 8: Residue gate, full green sweep, AI-slop to 100, changesets</name>
  <read_first>
    .changeset/config.json
    CLAUDE.md (AGENTS.md SDLC — changesets section)
    .aislop/config.yml
  </read_first>
  <action>
    Run the residue stop-condition grep (CONTEXT.md): zero first-party (non-generated, non-dist,
    non-node_modules, non-historical-spec, non-worktree, non-.planning) matches for
    NappletClass, CLASS_CAPABILITY_ALLOWLIST, classToWireCode, connectStore, ConnectGrant,
    connect-src, __connect-grants, connect-revoked, class-forbidden, and the 'class'/'connect'
    capability tokens. packages/*/dist/ .d.ts regenerate on build and are excluded.

    Add changesets per AGENTS.md (0.x breaking removal -> minor):
    - @kehto/runtime (minor) — removed NappletClass, class enforcement, class-forbidden reason.
    - @kehto/shell (minor) — removed connect-store, class wire field, connect/class capabilities.
    - @kehto/services ONLY if shipped output changed. The class-forbidden removal lives in
      @kehto/shell, not services; Task 3's services edit is docstring-only. If the services
      build output is byte-identical (comment-only), do NOT add a services changeset.
    Add a changeset for any other package whose shipped output changed.

    Run the full DoD chain: pnpm build, pnpm type-check, pnpm test:unit, pnpm docs:check, and
    restore the AI-slop gate to 100/100 (no new .aislop disables without documented justification).
  </action>
  <verify>
    <automated>pnpm build &amp;&amp; pnpm type-check &amp;&amp; pnpm test:unit &amp;&amp; pnpm docs:check; ls .changeset/*.md | grep -qv README; test $(grep -rlE "NappletClass|CLASS_CAPABILITY_ALLOWLIST|classToWireCode|connectStore|ConnectGrant|connect-src|__connect-grants|connect-revoked|class-forbidden" . 2>/dev/null | grep -vE "node_modules|/dist/|.claude/worktrees/|superpowers/specs|docs/api/|vitepress/dist|.planning/" | wc -l) -eq 0</automated>
  </verify>
  <acceptance_criteria>
    Residue grep returns zero first-party matches for every token; pnpm build, type-check,
    test:unit, docs:check all green; AI-slop at 100/100; changesets present for @kehto/runtime
    + @kehto/shell (minor) and any other package whose shipped output changed; no services
    changeset if its change was docstring-only.
  </acceptance_criteria>
</task>

</tasks>

<verification>
Phase-level checks (CONTEXT.md stop-condition):

1. Residue grep — zero first-party (non-generated, non-dist, non-node_modules, non-worktree,
   non-historical-spec, non-.planning) matches for: NappletClass, CLASS_CAPABILITY_ALLOWLIST,
   classToWireCode, connectStore, ConnectGrant, connect-src, __connect-grants, connect-revoked,
   class-forbidden, and the 'class'/'connect' capability tokens.
2. pnpm build green (entire workspace incl. playground).
3. pnpm type-check green (incl. trimmed e2e specs — no dangling removed-export imports).
4. pnpm test:unit green.
5. pnpm docs:check green (typedoc --treatWarningsAsErrors + vitepress build + audit).
6. AI-slop gate restored to 100/100.
7. Changesets present for @kehto/runtime + @kehto/shell (minor on 0.x) plus any other package
   whose shipped output changed.

Boundary preservation (must remain intact, NOT touched):
- Runtime consent handler (ConsentHandler / firewall-policy ConsentRequest variant).
- The firewall package + opClass machinery.
- resource-service.ts getConnectGrants option (generic host-supplied origin source).
</verification>

<success_criteria>
- NAP-CLASS, NAP-CLASS-1, NAP-CONNECT removed entirely from @kehto/runtime and @kehto/shell
  with no backwards-compat shim, alias, or wire field (including shell.init.class).
- The playground compiles, builds, and the resource demo sources its origin allowlist from the
  Task 4 decision (not the deleted connect-store).
- All class/connect-only specs deleted; mixed specs trimmed; unit + type-check green.
- Hand-authored docs/specs carry no removed-surface references; generated docs regenerated.
- The four critical boundaries preserved (consent handler, firewall opClass, resource
  getConnectGrants option, resource error vocabulary minus the orphan class-forbidden).
- Changesets staged; AI-slop at 100; full DoD chain green.
</success_criteria>

<output>
Create `.planning/quick/260617-qoi-drop-nap-class-nap-class-1-nap-connect-c/260617-qoi-SUMMARY.md` when done.
</output>

---

## ORCHESTRATOR ADDENDUM — post-planning directives (authoritative, override conflicting plan text)

**A. Task 4 decision = `static-allowlist`.** The playground resource demo sources its
per-napplet fetch-origin allowlist from a small static constant map in the playground
(replacing the deleted connect-store). Keep resource-service's generic `getConnectGrants`
hook (it is NOT connect machinery) and feed it from this static map. Note any resource-demo
e2e spec the change affects (e2e is not run by this gate, but type-check must stay green).
Do NOT stop at the Task 4 checkpoint — proceed using this decision.

**B. Local spec mirrors → reference stubs (user directive: "Remove ALL LOCAL MIRRORS,
REPLACE WITH REFERENCES TO LIVING DOCS. Failure to complete this correctly contributes to
spec drift").** This REPLACES the plan's "edit specs to strip class" approach. For ALL THREE
files in `specs/`, delete the duplicated mirror body and replace each with a short reference
stub (keep the file at its path so internal links / VitePress / RUNTIME-SPEC refs don't 404):
  - `specs/NAP-SHELL.md`  → reference → https://github.com/napplet/naps (living NAP-SHELL)
  - `specs/NAP-INTENT.md` → reference → https://github.com/napplet/naps (living NAP-INTENT)
  - `specs/NIP-5D.md`     → reference → https://github.com/nostr-protocol/nips/pull/2303/
  Each stub: a one-line title + a sentence stating kehto does not mirror the spec locally and
  the living document is authoritative, with the link. No body content that can drift.

**C. Redirect references to living docs.** Update JSDoc / comment pointers that cite
`specs/NIP-5D.md lines NN` (e.g. `packages/shell/src/shell-init.ts`,
`packages/shell/src/types.ts`) to reference the living doc instead of mirror line numbers —
remove brittle line-number citations. `RUNTIME-SPEC.md` stays as kehto's OWN runtime spec
but must (a) drop all class/connect content and (b) reference living docs rather than restate
NAP/NIP protocol surface where it currently mirrors them.

**D. Connect/class residue in the conformance guard.** `tests/unit/nip5d-conformance-guard.test.ts`
line ~25 fixture `'resource-demo': ['resource', 'connect', 'theme']` — remove `'connect'`
(and any `class` capability) from these fixtures; update any derived expected-count assertions.
This guard reads SOURCE files + `docs/policies/NIP-5D-CONFORMANCE.md`, not the specs/ stubs,
so the stub conversion is safe — but ensure the policy doc it reads no longer asserts
class/connect.

**E. NAP-SHELL must have ZERO class mentions** (user directive). After the stub conversion
this is automatic for the spec; also ensure the shell.init handshake code/comments and
RUNTIME-SPEC carry no class mention.

**F. Leave historical artifacts untouched:** everything under `.planning/`, dated design
records under `docs/superpowers/specs/`, and `docs/migrations/v1.2-NIP-5D-AUDIT.md` are
point-in-time history — do not rewrite them.
