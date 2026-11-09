Make it possible for downstream developers to build experimental NAPs on kehto without changing any kehto package, and document how.

Background: NAP-LLM (PR #361, merged 2026-10-31) is now on main. It added the host-facing tri-state `getShellDomainState` (supported | unconfigured | disabled) and Paja's yellow ⚠ unconfigured interface state. It also showed how many layers a new domain has to touch today (see the wiring checklist in the NAP-LLM memory and docs/llm.md).

An audit the same day found the runtime layer already supports experimental domains. A host registers a ServiceHandler under a new domain name, lists the exact message types in `messageCapabilities`, and grants the domain through `isDomainAllowed`. This is documented in docs/how-tos/register-service.md under "Domains outside the built-in dispatcher". Browser hosts are still blocked:
- `createShellBridge` hardwires `isDomainAllowed` to the frozen per-frame environment.
- `resolveShellEnvironment` and `buildShellCapabilities` only know kehto's fixed domain lists (RUNTIME_NATIVE_DOMAINS and SERVICE_ONLY_DOMAINS), and `resolveEnvironment` is intersected with them.
- The only workaround is an `originRegistry.setEnvironment` call that appears in one test and no doc (shell-environment-lifetime.test.ts).
- The namespace prelude gives unknown domains `{}`, and there is no supported way to inject a binding.
- `messageCapabilities` must use an existing ACL capability or `null`, so an experiment can't have its own grant.
- `sendToEligibleNapplet` rejects custom domains, so experiments can't push events.
- Paja and the playground have no extension hook at all.

Deliverables, wired end to end across acl, runtime, shell, services (where relevant), paja and playground:
1. A shell-level extension declaration on `ShellAdapter`, e.g. `extensions: [{ domain, service, binding, capabilities?, state? }]`. `resolveShellEnvironment`, `buildShellCapabilities`, the `isDomainAllowed` path and `getShellDomainState` must all honor it, so the domain is advertised, injected and routed the same way a built-in one is. Extensions can report the same supported, unconfigured and disabled states NAP-LLM uses. Per-frame grant and deny must still work through `resolveEnvironment`.
2. Binding injection in `renderNappletNamespacePrelude` and `injectNappletNamespacePrelude`. A host supplies a serializable binding factory, or a vetted script source, that builds `window.napplet.<domain>` inside the prelude. Binding code stays outside the signed artifact bytes, and NIP-5D srcdoc provenance is preserved.
3. Extension capabilities in @kehto/acl: a reserved namespace (e.g. `x-<domain>:<action>`) that hosts can declare and that the ACL state, ACL panels, consent and firewall understand. Built-in capability strings cannot be redefined. The ACL must stay pure and WASM-ready, so you'll need a bit-allocation or registry strategy that doesn't break `acl-state.ts` (the built-in bits now run through `1 << 27`, and `llm:generate` is bit 27).
4. Extension push: let `sendToEligibleNapplet` (or a scoped successor) deliver host-initiated messages for declared extension outbound types. Apply the same source, ACL, block and firewall checks as built-in pushes.
5. Paja: an `extensions` option in its config and options (pick the mechanism that fits `loadPajaConfigFile` and `normalizePajaOptions`). Extension domains appear in the interface list with the same supported (green), unconfigured (yellow ⚠) and disabled states NAP-LLM introduced, plus toggles, parity/simulation lists and message-log entries.
6. Playground: the same, through demo hooks and the ACL panel.
7. A how-to, docs/how-tos/experimental-nap.md, that takes a toy NAP (e.g. `x-echo` with a request/response pair, one push event, and an unconfigured state until a setting is supplied) from zero to running in Paja and the playground. It must use only public @kehto/* exports. Link it from register-service.md, docs/llm.md (as the contrast: an in-tree NAP vs an out-of-tree experiment), the package docs and READMEs.

Hard constraints:
- An extension cannot shadow, alias or override a built-in or upstream NAP domain or capability (including `llm` and `llm:generate`). Reject names that collide with them, and reserve a prefix for experiments. Test both rejection and acceptance.
- Every existing security property of the extension router carries over unchanged: the source-bound live session, blocked identities, ACL, firewall, same-domain/same-source response pinning, and the response recheck before send.
- Extensions never receive credentials, signer secrets, Paja LLM vault contents or other domains' data. Prove this with a regression test.
- Built-in domains, NAP-LLM included, keep working with no config changes. The undocumented `originRegistry` workaround either keeps working or is retired under the AGENTS.md backwards-compatibility rules (warnity.md, test, retire).

Read packages/shell/src/index.ts (122 lines)                                                                                                     Skills restored (gsd-quick)

⏺ Compacted while idle, before the prompt cache expired · turn off with "idleCompaction": false in settings.json

❯ write a prompt for goal that helps make this happen.
                                                                                                                                                      Here's a prompt you can paste after /goal:

way to inject a binding.                                             - `messageCapabilities` must use an existing ACL capability or `null`, so an experiment can't have its own grant.
- `sendToEligibleNapplet` rejects custom domains, so experiments can't push events.
- Paja and the playground have no extension hook at all.                                                                                                                                                                                                                                                     Deliverables, wired end to end across acl, runtime, shell, services (where relevant), paja and playground:
1. A shell-level extension declaration on `ShellAdapter`, e.g. `extensions: [{ domain, service, binding, capabilities? }]`. `resolveShellEnvironment`,
`buildShellCapabilities`, the `isDomainAllowed` path and `getShellDomainState` must all honor it, so the domain is advertised, injected and routed the
same way a built-in one is. Per-frame grant and deny must still work through `resolveEnvironment`.                                                    2. Binding injection in `renderNappletNamespacePrelude` and `injectNappletNamespacePrelude`. A host supplies a serializable binding factory, or a vettscript source, that builds `window.napplet.<domain>` inside the prelude. Binding code stays outside the signed artifact bytes, and NIP-5D srcdoc
provenance is preserved.
3. Extension capabilities in @kehto/acl: a reserved namespace (e.g. `x-<domain>:<action>`) that hosts can declare and that the ACL state, ACL panels,
consent and firewall understand. Built-in capability strings cannot be redefined. The ACL must stay pure and WASM-ready, so you'll need a bit-allocation
or registry strategy that doesn't break `acl-state.ts`.
4. Extension push: let `sendToEligibleNapplet` (or a scoped successor) deliver host-initiated messages for declared extension outbound types. Apply same source, ACL, block and firewall checks as built-in pushes.
5. Paja: an `extensions` option in its config and options (pickloadPajaConfigFile` and `normalizePajaOptions`). Extension
domains appear in the interface list with supported, unconfigured and disabled states, plus toggles and message-log entries.                        6. Playground: the same, through demo hooks.
7. A how-to, docs/how-tos/experimental-nap.md, that takes a toy request/response pair and one push event) from zero to running
in Paja and the playground. It must use only public @kehto/* exports. Link it from register-service.md, the package docs and READMEs.

Hard constraints:
- An extension cannot shadow, alias or override a built-in or upstream NAP domain or capability. Reject names that collide with them, and reserve a prefix for experiments. Test both rejection and acceptance.
- Every existing security property of the extension router carrurce-bound live session, blocked identities, ACL, firewall,
                                                                     Acceptance:
- A fixture outside packages/ (e.g. tests/fixtures/experimental-nap/) implements `x-echo` using only package entry points. A unit test and a Chromium
Playwright spec prove it in both Paja and the playground: advertisement, the `supports()` query, request/response, the push event, ACL deny, a firewablock, a domain disabled via `resolveEnvironment`, and a collision rejection.                                                                           - Gates pass: `pnpm build`, `type-check`, `test:unit`, `docs:check`, the relevant `test:e2e` specs, and `npx -y aislop@0.12.0 ci` at or above baseline.
- Each changed package has a changeset (minor).
- Atomic commits on a branch off up-to-date main, run through `/gsd:plan-phase` and execute (or `/gsd:quick --full` if it plans small).
- An open PR whose body lists the spec refs checked and the spec-gap decisions.                                                                                                                                                                                                                             The prompt says to cut the branch from main, not feat/nap-llm. If PR #361 hasn't merged when you start, you may want the work stacked on that branch
instead, so it can reuse the getShellDomainState tri-state.

✻ Cooked for 29s · done 1:04 PM

❯ update the text, #361 was merged an hour ago.                                                                                                       
Here's the updated prompt. It now says #361 is merged, so getShto build on, and it points at NAP-LLM as the reference for
 host-initiated messages for declared extension outbound types. Applysame source, ACL, block and firewall checks as built-in pushes.
5. Paja: an `extensions` option in its config and options (pick the mechanism that fits `loadPajaConfigFile` and `normalizePajaOptions`). Extension
domains appear in the interface list with the same supported (green), unconfigured (yellow ⚠) and disabled states NAP-LLM introduced, plus toggles,  parity/simulation lists and message-log entries.                                                                                                        6. Playground: the same, through demo hooks and the ACL panel.
7. A how-to, docs/how-tos/experimental-nap.md, that takes a toy NAP (e.g. `x-echo` with a request/response pair, one push event, and an unconfigured
state until a setting is supplied) from zero to running in Paja and the playground. It must use only public @kehto/* exports. Link it from
register-service.md, docs/llm.md (as the contrast: an in-tree NAP vs an out-of-tree experiment), the package docs and READMEs.                                                                                                                                                                              Hard constraints:
- An extension cannot shadow, alias or override a built-in or upstream NAP domain or capability (including `llm` and `llm:generate`). Reject names that
collide with them, and reserve a prefix for experiments. Test both rejection and acceptance.
- Every existing security property of the extension router carries over unchanged: the source-bound live session, blocked identities, ACL, firewall,
same-domain/same-source response pinning, and the response recheck before send.
- Extensions never receive credentials, signer secrets, Paja LLM vault contents or other domains' data. Prove this with a regression test.          - Built-in domains, NAP-LLM included, keep working with no config changes. The undocumented `originRegistry` workaround either keeps working or is
retired under the AGENTS.md backwards-compatibility rules (warnity.md, test, retire).

Spec check first: re-read NIP-5D domain discovery and NAP-SHELL `capabilities.domains` in napplet/naps master, and record the refs. No upstream specdefines experimental-domain naming, extension capabilities or the unconfigured interface state, so treat each as a spec gap. Document the bounded kehto
policy next to the code, and draft (don't file) one upstream na an `x-` convention plus a `not-configured` interface state.

Acceptance:
- A fixture outside packages/ (e.g. tests/fixtures/experimental-nap/) implements `x-echo` using only package entry points. A unit test and a Chromium Playwright spec prove it in both Paja and the playground: advertisement, the `supports()` query, request/response, the push event, the unconfigured → supported transition, ACL deny, a firewall block, a domain disabled via `resolveEnvironment`, and a collision rejection.
- Gates pass: `pnpm build`, `type-check`, `test:unit`, `docs:check`, the relevant `test:e2e` specs, and `npx -y aislop@0.12.0 ci` at or above baseline.
- Each changed package has a changeset (minor).
- Atomic commits on a new branch cut from an up-to-date main (git checkout main && git pull --ff-only first), run through `/gsd:plan-phase` and execute
(or `/gsd:quick --full` if it plans small).
- An open PR whose body lists the spec refs checked and the spec-gap decisions.                                                                     
✻ Worked for 20s · done 1:05 PM
                                                                                                                                                        should also add a skill.                                                                                                                              
Here's the updated prompt with the skill added as deliverable 8, plus matching acceptance checks. I assumed you meant an agent skill that downstream
developers install, so their coding agent can scaffold an experimental NAP from the public API. If you meant one for agents working inside the kehto
repo, change the location line to .claude/skills/.

Make it possible for downstream developers to build experimental NAPs on kehto without changing any kehto package. Document how, and ship an agent sthat walks them through it.

Background: NAP-LLM (PR #361, merged 2026-10-31) is now on main. It added the host-facing tri-state `getShellDomainState` (supported | unconfigured |
disabled) and Paja's yellow ⚠ unconfigured interface state. It also showed how many layers a new domain has to touch today (see the wiring checklistthe NAP-LLM memory and docs/llm.md).

mains. A host registers a ServiceHandler under a new domain name, lisexact message types in `messageCapabilities`, and grants the domain through `isDomainAllowed`. This is documented in docs/how-tos/register-service.md
under "Domains outside the built-in dispatcher". Browser hosts are still blocked:
- `createShellBridge` hardwires `isDomainAllowed` to the frozen per-frame environment.                                                               - `resolveShellEnvironment` and `buildShellCapabilities` only know kehto's fixed domain lists (RUNTIME_NATIVE_DOMAINS and SERVICE_ONLY_DOMAINS), and    `resolveEnvironment` is intersected with them.
- The only workaround is an `originRegistry.setEnvironment` call that appears in one test and no doc (shell-environment-lifetime.test.ts).
- The namespace prelude gives unknown domains `{}`, and there is no supported way to inject a binding.
- `messageCapabilities` must use an existing ACL capability or `null`, so an experiment can't have its own grant.                                     - `sendToEligibleNapplet` rejects custom domains, so experiments can't push events.                                                                   - Paja and the playground have no extension hook at all.

Deliverables, wired end to end across acl, runtime, shell, services (where relevant), paja and playground:
1. A shell-level extension declaration on `ShellAdapter`, e.g. `extensions: [{ domain, service, binding, capabilities?, state? }]`.
`resolveShellEnvironment`, `buildShellCapabilities`, the `isDomainAllowed` path and `getShellDomainState` must all honor it, so the domain is advertised,
injected and routed the same way a built-in one is. Extensions can report the same supported, unconfigured and disabled states NAP-LLM uses. Per-fragrant and deny must still work through `resolveEnvironment`.
2. Binding injection in `renderNappletNamespacePrelude` and `ine`. A host supplies a serializable binding factory, or a vettedscript source, that builds `window.napplet.<domain>` inside the prelude. Binding code stays outside the signed artifact bytes, and NIP-5D srcdoc
provenance is preserved.
3. Extension capabilities in @kehto/acl: a reserved namespace (e.g. `x-<domain>:<action>`) that hosts can declare and that the ACL state, ACL panels,consent and firewall understand. Built-in capability strings cannot be redefined. The ACL must stay pure and WASM-ready, so you'll need a bit-allocationor registry strategy that doesn't break `acl-state.ts` (the built-in bits now run through `1 << 27`, and `llm:generate` is bit 27).
4. Extension push: let `sendToEligibleNapplet` (or a scoped successor) deliver host-initiated messages for declared extension outbound types. Apply the
same source, ACL, block and firewall checks as built-in pushes.
5. Paja: an `extensions` option in its config and options (pick the mechanism that fits `loadPajaConfigFile` and `normalizePajaOptions`). Extension   domains appear in the interface list with the same supported (green), unconfigured (yellow ⚠) and disabled states NAP-LLM introduced, plus toggles,   parity/simulation lists and message-log entries.
6. Playground: the same, through demo hooks and the ACL panel.
7. A how-to, docs/how-tos/experimental-nap.md, that takes a toy NAP (e.g. `x-echo` with a request/response pair, one push event, and an unconfigured
state until a setting is supplied) from zero to running in Paja and the playground. It must use only public @kehto/* exports. Link it from
register-service.md, docs/llm.md (as the contrast: an in-tree NAP vs an out-of-tree experiment), the package docs and READMEs.
8. An agent skill for downstream developers, e.g. `skills/kehto-experimental-nap/SKILL.md`, following the Agent Skills format (frontmatter with `namand a trigger-rich `description`, plus a concise body that links to reference files instead of inlining everything). It guides a coding agent working in
a *downstream* repo that depends on @kehto/* through these step   - choose an `x-` domain name and check it for collisions;
   - write the wire message types and `messageCapabilities`;
   - declare extension capabilities;
   - implement the ServiceHandler, the napplet binding, the push events and the unconfigured state;
   - register it through `ShellAdapter.extensions` and Paja `extensions`;                                                                              - write tests (a unit test and a Paja Playwright spec);
   - draft an upstream napplet/naps proposal once the experimen
   It must state the security invariants as rules the agent cannot skip: no credentials or secrets crossing into napplets, no shadowing built-in domains,
no borrowing unrelated capabilities, and no invented error envelopes on denial. It also needs a "when NOT to use this" section (the change belongs in
kehto itself when it is an upstream-specified NAP; follow the NAP-LLM wiring pattern then).                                                            Include a scaffold, either a templates/ folder with the `x-echo` fixture's files or a script, and keep it in sync with the fixture so the two can't
drift. Ship it where downstream users can get it: in the repo,  and the root README with install instructions, and in the
published package `files` if one package is the natural home. Document the choice.

Hard constraints:
- An extension cannot shadow, alias or override a built-in or upstream NAP domain or capability (including `llm` and `llm:generate`). Reject names tcollide with them, and reserve a prefix for experiments. Test both rejection and acceptance.
- Every existing security property of the extension router carrurce-bound live session, blocked identities, ACL, firewall,same-domain/same-source response pinning, and the response recheck before send.
- Extensions never receive credentials, signer secrets, Paja LLdomains' data. Prove this with a regression test.
- Built-in domains, NAP-LLM included, keep working with no config changes. The undocumented `originRegistry` workaround either keeps working or is
retired under the AGENTS.md backwards-compatibility rules (warn, track in docs/compatibility.md, test, retire).
                                                                                                                                                    Spec check first: re-read NIP-5D domain discovery and NAP-SHELL `capabilities.domains` in napplet/naps master, and record the refs. No upstream spec
defines experimental-domain naming, extension capabilities or tstate, so treat each as a spec gap. Document the bounded kehto
policy next to the code, and draft (don't file) one upstream na an `x-` convention plus a `not-configured` interface state.

Acceptance:                                                                                                                                         - A fixture outside packages/ (e.g. tests/fixtures/experimental-nap/) implements `x-echo` using only package entry points. A unit test and a Chromium
Playwright spec prove it in both Paja and the playground: adver query, request/response, the push event, the unconfigured →
supported transition, ACL deny, a firewall block, a domain disabled via `resolveEnvironment`, and a collision rejection.
- Skill checks:                                                                                                                                       - A unit test checks that the SKILL.md frontmatter is valid.
  - A unit test checks that every file path and @kehto/* export in the public API.
  - A unit test checks that the skill's templates match the `x-echo` fixture byte-for-byte, or that the fixture is generated from them.
  - A subagent dry run with only the skill and the published packages scaffolds a second toy NAP in a scratch directory and gets its tests passing. Report the result in the PR.
- Gates pass: `pnpm build`, `type-check`, `test:unit`, `docs:ch2e` specs, and `npx -y aislop@0.12.0 ci` at or above baseline.
- Each changed package has a changeset (minor).
- Atomic commits on a new branch cut from an up-to-date main (git checkout main && git pull --ff-only first), run through `/gsd:plan-phase` and execute (or `/gsd:quick --full` if it plans small).
- An open PR whose body lists the spec refs checked, the spec-gap decisions, and where the skill ships.
