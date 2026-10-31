---
name: kehto-experimental-nap
description: Use when building, prototyping or testing an experimental napplet NAP (a new x- domain such as x-echo) on top of published @kehto/* packages in a downstream repo, without changing kehto. Covers choosing and collision-checking an x- domain, wire messages and messageCapabilities, x-<domain>:<action> capabilities, the ServiceHandler, the window.napplet binding, push events, the unconfigured state, ShellAdapter.extensions and Paja extensions registration, unit and Paja Playwright tests, and drafting a napplet/naps proposal.
---

# Build an experimental NAP on kehto

Build an `x-` domain in a downstream repo using only public `@kehto/shell` and
`@kehto/paja` exports. Copy from `templates/`, which is byte-identical to the
kehto `x-echo` fixture, and rename it.

## When NOT to use this

- **Upstream-specified NAPs.** The domain is in the `napplet/naps` registry or an
  open draft (`llm`, `relay`, `fs`, …). It belongs in kehto itself: follow the
  NAP-LLM wiring pattern (<https://kehto.github.io/web/docs/llm.html>) with an
  ACL bit, runtime handler, shell prelude factory, Paja and playground lists.
  Never build it as an `x-` alias. `validateExtensionDomain` rejects only the
  registry and kehto's in-tree domains (`RESERVED_NAP_DOMAINS`). Check the open
  `napplet/naps` pull requests yourself before you choose a name.
- **Existing built-in domains.** You only need to configure one. Use its
  documented hooks instead.

## Rules you cannot skip

Read [reference/security-invariants.md](reference/security-invariants.md) before
writing code. In short:

1. No credentials, signer secrets, LLM vault contents or other domains' data
   cross into a napplet or into your service's responses.
2. Never shadow a built-in or registry domain: always `x-<name>`, and never
   `x-<reserved>` (`x-llm` is rejected).
3. Never borrow an unrelated capability. Use `null` or your own
   `x-<domain>:<action>`.
4. Never invent error envelopes on denial. ACL and firewall denials are silent;
   only your own contract's results carry errors.

## Steps

1. **Name.** Choose `x-<name>` and run `validateExtensionDomain(name)` from
   `@kehto/shell`. A non-null result means rename. See
   [reference/checklist.md](reference/checklist.md#name).
2. **Wire contract.** List each `x-<name>.<action>` request, its `.result`, and
   any push type. Map every inbound type in `messageCapabilities` and every push
   in `pushCapabilities` to `null` or an own capability.
3. **Capabilities.** Declare `capabilities: [{ capability: 'x-<name>:<action>', label, description }]`.
   Check each with `validateExtensionCapability(cap, domain)`.
4. **Implement** from `templates/x-echo.js`:
   - The `service` (`ServiceHandler`): its descriptor name equals the domain.
     It validates payloads and answers `<type>.result` with the request `id`.
   - **Pushes**: keep the context from `onRegistered` and call
     `context.sendToEligibleNapplet(windowId, message)` with declared types only.
   - The **binding** `(kit) => ({ … })`: it must be self-contained (it is
     serialized), and it uses only `kit.request`, `kit.send` and `kit.on`.
   - **`state()`**: return `unconfigured` until required settings exist, and
     answer `not-configured` results meanwhile.
5. **Register**:
   - Any host: `ShellAdapter.extensions: [ext]`, then
     `prepareNappletSrcdoc(html, { domains, extensions: getShellExtensionBindings(hooks.extensions, domains) })`.
   - Paja: add the module to `extensions` in `paja.config.json`
     (`templates/paja.config.json`). The module default-exports
     `(context) => ShellExtension` and may export `settings`.
     No secrets in config `settings`: Paja serves them unauthenticated in
     `/__kehto/config.json` and the host HTML, so users enter keys in the
     Extensions sidebar.
6. **Test**: adapt `templates/x-echo.test.ts` (vitest + `@kehto/shell`) and
   `templates/x-echo.paja.spec.ts` (Playwright + `@kehto/paja`). Cover
   advertisement, the `not-configured` result, success, the push, ACL denial and
   collision rejection. The templates expect to sit next to the module and
   config; adjust relative paths if you use folders. Add a `playwright.config.ts`
   with a chromium project, and `@types/node` if you type-check. Vitest's default
   include also collects the Playwright `*.spec.ts` file and fails on it, so add a
   `vitest.config.ts` with `test: { include: ['**/*.test.ts'] }` (or run
   `vitest run x-echo.test.ts`). In Paja, settings
   inputs are `#paja-extension-<domain>-<key>`, the save button is
   `#paja-extension-<domain>-save`, and the toggle is
   `#interface-toggles [data-interface-domain="<domain>"]` with `data-state`.
   A deliberate negative test of a non-`x-` capability needs `// @ts-expect-error`,
   because the capability type only admits `x-…:…`.
7. **Propose upstream** once the experiment is stable: fill
   [reference/upstream-proposal.md](reference/upstream-proposal.md) and open a
   `napplet/naps` PR under the registry name. Then move the NAP in-tree.

## Templates

| File | Purpose |
|---|---|
| `templates/x-echo.js` | Extension module (service, push, capabilities, binding, state, Paja default export) |
| `templates/paja.config.json` | Paja config listing the module |
| `templates/x-echo.test.ts` | Unit test template |
| `templates/x-echo.paja.spec.ts` | Paja Chromium Playwright spec template |

Full walkthrough: <https://kehto.github.io/web/docs/how-tos/experimental-nap.html>.
