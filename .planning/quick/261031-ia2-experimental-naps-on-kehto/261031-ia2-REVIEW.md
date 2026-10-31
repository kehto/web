---
phase: 261031-ia2-experimental-naps-on-kehto
reviewed: 2026-10-31T14:05:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - packages/acl/src/extensions.ts
  - packages/acl/src/migrate.ts
  - packages/acl/src/mutations.ts
  - packages/acl/src/types.ts
  - packages/runtime/src/service-extensions.ts
  - packages/runtime/src/runtime.ts
  - packages/runtime/src/acl-state.ts
  - packages/runtime/src/enforce.ts
  - packages/runtime/src/service-types.ts
  - packages/shell/src/shell-extensions.ts
  - packages/shell/src/shell-init.ts
  - packages/shell/src/shell-ready.ts
  - packages/shell/src/napplet-namespace.ts
  - packages/shell/src/hooks-adapter.ts
  - packages/paja/src/extensions.ts
  - packages/paja/src/browser-extensions.ts
  - packages/paja/src/browser-host.ts
  - packages/paja/src/server.ts
  - packages/paja/src/config-file.ts
  - apps/playground/src/playground-extensions.ts
  - apps/playground/src/acl-panel.ts
  - apps/playground/src/main.ts
findings:
  critical: 3
  warning: 7
  info: 9
  total: 19
status: issues_found
---

# Quick Task 261031-ia2: Code Review Report

**Reviewed:** 2026-10-31T14:05:00Z
**Depth:** deep (cross-package call chains: ACL -> runtime router/context -> shell adapter/prelude -> Paja/playground hosts)
**Files Reviewed:** 22
**Status:** issues_found

## Summary

I reviewed `git diff main...feat/experimental-naps` against this security model:

- An `x-` extension never shadows a built-in domain, capability or service.
- It never receives credentials, secrets or other domains' data.
- It pushes only its own declared `x-` types.
- Every request and push needs a live source-bound session, an unblocked identity, the ACL capability, a domain grant and firewall admission.
- Denials never invent envelopes.

The inbound request gate is mostly sound. Session, block, domain grant, ACL and firewall are all checked, and denials stay silent. Three verified defects break the model:

1. The per-request `send` callback lets a handler push without limits. It accepts any type in the domain, never checks the push capabilities, never re-runs the firewall, and can fire any number of times.
2. The rule that keeps `x-` services off the built-in push path checks whether the name is valid, not whether it starts with `x-`. A service named `x-llm` (an alias of a reserved domain) can still send `theme.changed` and `gamepad.state`.
3. If a binding is written as a method shorthand (or is a bound or native function), the whole injected prelude fails with a SyntaxError. Every built-in `window.napplet` domain then disappears from the frame.

Every BLOCKER, and warnings WR-01, WR-02, WR-03, WR-04 and WR-05, was confirmed with a throwaway vitest probe run against the source. The probe lives outside the repo at `/private/tmp/claude-501/-Users-sandwich-Develop-kehto/93aa7a20-a5bc-46bf-b056-42efe2bbf04d/scratchpad/probe/runtime.probe.ts`, and its output is in `out.txt` next to it. I modified no repo files.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The per-request `send` callback is an unlimited push channel that skips `pushCapabilities` and the firewall

**File:** `packages/runtime/src/service-extensions.ts:80-87`
**Issue:** The `send` callback passed to `handler.handleMessage` only checks three things before it delivers a message:
- the registration, handler, window lifetime and session are unchanged;
- `response.type` starts with `${domain}.`;
- `allowed()` passes. That means the domain grant, the block flag, and the *request's* capability (often `null`).

It never checks:
- that the type is the request's `.result` or carries the request `id`;
- that the type is declared in `pushCapabilities`;
- the push capability the recipient must hold;
- the firewall, again;
- how many times it has been called.

A handler can keep `send` from one `x-echo.say` request and later deliver any number of undeclared `x-echo.*` messages. This still works after the recipient's push capability is revoked and after the firewall policy changes to `deny`.

The probe confirmed it: after `revoke(x-echo:listen)` and `setPolicy(dTag,'deny')`, the retained callback still delivered `x-echo.heard`, `x-echo.undeclared-push` and `x-echo.after-firewall-deny`. This breaks "may push only its own declared types" and "every push needs firewall admission". It also contradicts `docs/how-tos/experimental-nap.md:178-184` and `skills/kehto-experimental-nap/reference/security-invariants.md` ("ACL … checked again before every response and push"; "Firewall … drop the message").

**Fix:** Pin the callback to one response for this request, and send anything else through `push()`:
```ts
const requestId = (message as { id?: unknown }).id;
let answered = false;
handler.handleMessage(windowId, message, (response) => {
  if (answered) return;
  if (registrations.get(domain) !== registration || services[domain] !== handler
    || windowLifetimes.get(windowId) !== lifetime
    || sessions.getEntryByWindowId(windowId) !== session) return;
  if (!response || response.type !== `${message.type}.result`
    || (response as { id?: unknown }).id !== requestId) return;
  if (!allowed()) return;
  answered = true;
  hooks.sendToNapplet(windowId, response);
});
```
If the extension contract needs streamed responses (several frames per request), declare them in `pushCapabilities` and route them through `push()`, which applies the full gate. Add regressions for: a second response being dropped, a non-`.result` type being dropped, an `id` mismatch being dropped, and a response after a firewall `deny` being dropped.

### CR-02: The `x-` push guard checks name validity, not the `x-` prefix, so invalid `x-` services reach the built-in push path

**File:** `packages/runtime/src/runtime.ts:473` (also `runtime.ts:536-546` `registerService`, and `packages/shell/src/hooks-adapter.ts:343-347`)
**Issue:** `if (isExtensionDomain(name) || isExtensionDomain(domain)) return extensions.push(...)` only diverts a handler whose name is a *valid* extension domain. The following names all fail `isExtensionDomain`, so they fall through to the built-in push path:
- `x-llm`, an alias of a reserved domain that `validateExtensionDomain` rejects;
- `x-shell`, `x-Echo`, `x-a_b`;
- any `x-` name longer than 64 characters.

The probe registered `services: { 'x-llm': h }` and called `sendToEligibleNapplet` with `gamepad.state` and `theme.changed`. Both returned `true` and were delivered. Docs (`experimental-nap.md:181-184`) promise "An `x-` handler's context never reaches the built-in push path".

Neither `RuntimeAdapter.services`, `ShellAdapter.services` nor `runtime.registerService` validates `x-` names, so the alias can be registered there. Only `ShellAdapter.extensions` is checked. Inbound `x-llm.*` messages are also routed by the extension router (only `RESERVED`/`builtInDomains` are filtered there), so the alias that `RESERVED_NAP_DOMAINS` is meant to forbid exists at runtime.

**Fix:** Key on the prefix and fail closed:
```ts
if (name.startsWith(EXTENSION_DOMAIN_PREFIX) || domain.startsWith(EXTENSION_DOMAIN_PREFIX)) {
  return extensions.push(name, handler, windowId, message); // push() already rejects invalid domains
}
```
Also refuse to attach or route any service whose key starts with `x-` but fails `validateExtensionDomain`, in both `createRuntime` (`hooks.services`) and `registerService`. Do the same in the extension router's `handleMessage` (`domain.startsWith('x-') && !isExtensionDomain(domain)` → return). Add a regression for `x-llm`/`x-shell` service keys.

### CR-03: Binding serialization accepts method-shorthand, bound and native functions, and one bad binding kills the whole prelude

**File:** `packages/shell/src/shell-extensions.ts:240-249`, `packages/shell/src/napplet-namespace.ts:40-50`, `packages/shell/src/napplet-namespace.ts:86-87`
**Issue:** `bindingSource` takes `Function.prototype.toString()` and only rejects script or comment markup. These forms all pass `defineShellExtension` but are not valid expressions:
- a method shorthand, e.g. `{ domain, service, binding(kit) { … } }`, which is the natural way to write an object literal;
- a class method;
- a `.bind()`-ed function or a native function, whose source is `function () { [native code] }`.

They are spliced as `"x-echo": (<source>)` into the *single* `<script data-kehto-nip5d-injection>`, so the whole prelude fails to parse. The probe confirmed `SyntaxError: Unexpected token '{'` for the shorthand form and `SyntaxError: Unexpected identifier 'code'` for a bound function.

Once that happens, no `window.napplet` is installed for any frame granted that extension: no `relay`, `identity`, `storage`, `shell` receiver or protected domains. The napplet's own scripts then run with no host-owned guarded namespace. `{ source }` bindings have the same problem for any text that is not a single expression, for example `0), sideEffect(), (0`.

**Fix:** Validate that the source is a single function expression when the extension is defined. Also keep each factory from taking down the main prelude, either by giving it its own `<script>` that registers into a host-owned queue or by `try`/`eval` isolation where CSP allows. At minimum:
```ts
const FUNCTION_EXPR = /^\s*(async\s+)?(function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/;
if (!FUNCTION_EXPR.test(source) || /\[native code\]/.test(source)) {
  throw new ShellExtensionError(`${domain} binding must be an arrow or function expression (no method shorthand, bound or native functions)`);
}
```
Add a unit test that renders the prelude with a method-shorthand binding and asserts that defining the extension throws. Add an e2e test showing built-in domains survive a broken `{ source }` binding.

## Warnings

### WR-01: The runtime lets `x-` routes and pushes borrow built-in capabilities, and validated services stay mutable

**File:** `packages/runtime/src/service-extensions.ts:45`, `packages/runtime/src/service-types.ts:91-102`, `packages/shell/src/shell-extensions.ts:163`, `packages/shell/src/hooks-adapter.ts:347`
**Issue:** `declaredPolicy` accepts any `ALL_CAPABILITIES` string for an `x-` domain. The probe ran `pushCapabilities: { 'x-echo.leak': 'relay:read' }`, and the push was delivered on the strength of the user's `relay:read` grant. Three places say the opposite:
- the function's own comment ("an extension cannot borrow another domain's grant");
- `checkPolicies` in the shell, which allows only declared own-domain capabilities;
- skill obligation #3 ("never `relay:read` … as a stand-in").

`service-types.ts` even documents "built-in or own-domain extension capability" as allowed. `defineShellExtension` also freezes only a shallow copy. `mergeExtensionServices` registers the original mutable `extension.service`, so a host can add borrowed or undeclared entries to `messageCapabilities`/`pushCapabilities` after validation and the runtime will honor them.
**Fix:** In `declaredPolicy`, when `isExtensionDomain(domain)`, accept only `null` or `validateExtensionCapability(capability, domain) === null`, and drop the built-in branch for `x-` domains. Snapshot and freeze both policy maps when the service is attached (`Object.freeze({ ...handler.pushCapabilities })`) and route against the snapshot. Update the `service-types.ts` JSDoc to match.

### WR-02: `ServiceRuntimeContext` leaks other domains' ACL state and every napplet's identity to `x-` handlers

**File:** `packages/runtime/src/runtime.ts:452-464`
**Issue:** An `x-` handler's context can do three things beyond its own domain:
- `hasCapability(windowId, cap)` answers for *any* capability. The probe got `hasCapability(w,'relay:write') === true`. That covers `identity:read`, `relay:write`, and other extensions' `x-other:*` capabilities.
- `listWindowIds()` returns every live window, including frames that were never granted the `x-` domain, frames that are denied by `deniedDTags`, and blocked frames.
- `resolveDTag()` returns any window's `d` tag.

That is other domains' data (grant topology, and which napplets are running) reaching the extension. It contradicts "It never receives … other domains' data".
**Fix:** Build a domain-scoped context for `x-` handlers:
- `hasCapability` accepts only `validateExtensionCapability(cap, name) === null`;
- `listWindowIds` filters to sessions with `hooks.isDomainAllowed(windowId, name) === true` that are not blocked;
- `resolveDTag` returns `undefined` for windows that are not eligible.

### WR-03: Revocations from every domain are broadcast to `x-` services

**File:** `packages/runtime/src/runtime.ts:596-598`
**Issue:** The ACL mutation observer calls `service.onCapabilityRevoked(windowId, capability)` on every registered service, `x-` extensions included, for every capability. The probe saw `['relay:write','identity:read']` arrive at `x-echo`. This leaks other domains' policy events and the user's grant decisions.
**Fix:** For handlers registered under an `x-` name, forward only `null` (block) and capabilities that pass `validateExtensionCapability(capability, name) === null`.

### WR-04: Host pushes spend the napplet's firewall budget and trigger a consent prompt on every push

**File:** `packages/runtime/src/service-extensions.ts:110`, `packages/runtime/src/runtime.ts:240-268`, `packages/runtime/src/runtime.ts:300-307`
**Issue:** `push()` runs `firewallGate`. That builds an observation with the napplet's `dTag`, `initKey` and `opClass = capability`, and `firewallState.evaluate` updates token-bucket and init-burst counters. Host-initiated pushes therefore use up the napplet's own budget.

In the probe, a capacity-2 bucket on `x-echo:send` with push and request sharing that capability went like this:
- two pushes drained the bucket;
- the third push was dropped;
- the napplet's own `x-echo.say` request was then rejected (`handleMessage` calls: 0).

On a `prompt` decision with `respond=false`, `fireConsent` runs for *every* push. A push loop can flood the user with consent prompts about something the napplet never did. This bypasses the bound on repeat prompts that T-81-04 relies on.
**Fix:** Give pushes their own observation class, e.g. `opClass: 'push:' + type` or a `direction: 'push'` flag that `evaluate` uses without touching the napplet's request buckets. Never call `fireConsent` from a push: treat `prompt` as `drop` with no prompt. Add regressions for both.

### WR-05: `readShellExtensionState` fails open

**File:** `packages/shell/src/shell-extensions.ts:219-226`
**Issue:** Any `state()` return value other than exactly `'unconfigured'` or `'disabled'` becomes `'supported'`. The probe confirmed `'Disabled'` → `supported` and `undefined` → `supported`. The same happens for a returned Promise or a string such as `'off'`. A buggy hook therefore advertises a domain whose backend says it is unavailable. Only a thrown error falls back to `disabled`.
**Fix:** Fail closed: `return state === 'supported' || state === 'unconfigured' ? state : 'disabled';`. Keep `'supported'` only when `state` is omitted entirely.

### WR-06: A disabled extension keeps serving already-loaded frames

**File:** `packages/shell/src/shell-ready.ts:35-37`, `packages/runtime/src/service-extensions.ts:70-73`, `apps/playground/src/playground-extensions.ts:171-176`
**Issue:** `isDomainAllowed` reads the per-window environment, which is frozen when the frame loads. The router never consults `readShellExtensionState` or `disabledDomains`. So when an extension's `state()` turns `disabled` (for example, its credentials were removed or its backend went away), or the user switches it off in the playground, every live frame can still send requests and receive pushes until it reloads. Paja reloads the target on toggle, but the playground and downstream hosts do not. `ShellExtension.state` is documented as "Live host-facing state".
**Fix:** In `mergeExtensionServices`, wrap each extension service so `handleMessage` and context pushes return early when `readShellExtensionState(extension) === 'disabled'` or the domain is currently in `capabilities.disabledDomains`. Alternatively, have the shell's `isDomainAllowed` check the live disabled state for `x-` domains.

### WR-07: Paja keys stored extension settings by module basename, so different extensions share and overwrite secrets

**File:** `packages/paja/src/browser-extensions.ts:45-58`, `packages/paja/src/browser-extensions.ts:101`, `packages/paja/src/extensions.ts:148`
**Issue:** `entry.name` is `modulePath.split(/[\\/]/).pop()`. Two configured modules with the same file name (`a/index.js` and `b/index.js`, or two `x-echo.js` copies) read and write the same `kehto.paja.extension.<name>` localStorage key. One extension's factory receives the other's settings, which are often API keys or endpoint tokens, through `context.settings.get`. Saving from either row overwrites both. That is cross-extension secret delivery through the official context, contradicting "never receives credentials".
**Fix:** After validation, key storage by the validated `extension.domain`, which is unique: `kehto.paja.extension.${extension.domain}`. Read stored values only after `defineShellExtension` succeeds, or key by a hash of the absolute module path. Also make the diagnostic `name` unique, e.g. `${index}:${basename}`.

## Info

### IN-01: `sanitizeExtensionDecisions` says it returns a frozen record but does not freeze it
**File:** `packages/acl/src/extensions.ts:231,244`. **Fix:** `return Object.keys(result).length > 0 ? Object.freeze(result) : undefined;`, or correct the JSDoc.

### IN-02: Invalid `x-` capability strings fall through to the bitfield check and allow unknown identities under permissive policy
**File:** `packages/runtime/src/acl-state.ts:196-199`, `packages/acl/src/check.ts:60-62`. `check('x-llm:generate')` → `capToBit` = 0 → for an identity with no entry, `defaultPolicy === 'permissive'` → `true`. So `ServiceRuntimeContext.hasCapability(w, 'anything')` returns `true`. **Fix:** Return `false` when the string is neither a built-in nor a valid extension capability.

### IN-03: Playground extension state from localStorage is not sanitized
**File:** `apps/playground/src/playground-extensions.ts:45-67`. `values['x-echo']` can be a string or number, which gets spread character by character; `deniedFor` arrays can hold non-strings. **Fix:** Keep only string values and string `dTag`s, as Paja's `readStoredSettings` does.

### IN-04: The playground ACL panel hard-codes a permissive default for `x-` capabilities
**File:** `apps/playground/src/acl-panel.ts:246`. `aclSnapshot.extensions[cap] ?? true` ignores the real default policy. **Fix:** Fall back to `adapter.check(windowId, cap)` when there is no explicit decision.

### IN-05: A test/debug global exposes firewall-policy control in production builds
**File:** `apps/playground/src/main.ts:471-485`. `__kehtoPlaygroundExtensions__.setFirewallPolicy` ships unconditionally. Sandboxed napplets cannot reach it, but it widens what any host-page script can do. **Fix:** Gate it behind `import.meta.env.DEV` or a test flag.

### IN-06: Paja's extension route leaks absolute paths on error and ignores query strings
**File:** `packages/paja/src/server.ts:93-99`. If the file is missing, `readFileSync` throws, and the error message (with the absolute path) becomes the 502 body. `/__kehto/extensions/0.js?v=1` returns 404. **Fix:** Catch the error and return a generic 404/500; match on `new URL(requestUrl, 'http://x').pathname`.

### IN-07: Paja serves config-file `settings` values unauthenticated in `/__kehto/config.json` and the host HTML
**File:** `packages/paja/src/extensions.ts:146-152`, `packages/paja/src/options.ts:192`. The default bind address is `127.0.0.1`, but users who bind elsewhere expose any secret placed in `settings`. **Fix:** Document "no secrets in config `settings`", or leave values out of the served config and enter them only in the sidebar.

### IN-08: Merging decisions during migration revives explicit `x-` revocations
**File:** `packages/acl/src/extensions.ts:259-267`. If the legacy key holds a stale `true` and the new key holds an explicit user `false`, the merge produces `true`. This matches the bitfield union, but an explicit `ext` `false` records user intent. **Fix:** Consider "deny wins" for explicit decisions, or document the choice.

### IN-09: Kit action names accept dots and uppercase, and payload `id` overrides the request id
**File:** `packages/shell/src/napplet-namespace.ts:1832-1842`. `/^[a-z][a-zA-Z0-9.-]*$/` lets a binding target `say.result` and similar types. `{ ...payload, type }` keeps a caller-supplied `id`, which lets the request correlate with another request's result. **Fix:** Use the same `ACTION_PATTERN` as `@kehto/acl`, and always generate the `id`: `request({ ...payload, type, id: undefined }, …)`.

---

_Reviewed: 2026-10-31T14:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

## Resolution (2026-10-31)

| Finding | Resolution | Regression |
|---|---|---|
| CR-01 reply callback as push channel | x- replies are exactly one `<type>.result`; later or other sends are dropped | `x-extension-hardening.test.ts` |
| CR-02 invalid `x-` names on built-in path | any `x-`-prefixed handler or type takes the extension path, which requires a valid extension domain; inbound invalid `x-` domains dropped | `x-extension-hardening.test.ts` (`x-llm`, `x-shell`, `x-Echo`) |
| CR-03 unparseable binding kills prelude | method shorthand normalized, bound/native rejected, and each binding renders in its own script so a syntax error costs only that domain | `shell-extensions.test.ts` |
| WR-01 built-in gates / mutable maps | x- domains accept only own x- capabilities; validated maps frozen on the routed service | both test files |
| WR-02 context scope | x- context limited to windows granted the domain and to own capabilities | `x-extension-hardening.test.ts` |
| WR-03 revocation broadcast | x- services hear only blocks and own revocations | `x-extension-hardening.test.ts` |
| WR-04 push firewall budget / consent | pushes honor deny/ask policy without consuming the request budget or prompting | `x-extension-hardening.test.ts` |
| WR-05 state fails open | unknown `state()` values disable the domain | `shell-extensions.test.ts` |
| WR-06 loaded frames keep environment | by design (frozen per-frame NAP-SHELL snapshot); documented; Paja reloads on toggle | docs |
| WR-07 settings keyed by file name | keyed by validated domain | `experimental-nap.test.ts` |

Gates after resolution: build 32/32, type-check 17/17, unit 2535 passed, docs:check OK, aislop 95 (5 rows,
equal to main), Chromium experimental-nap, nip5d-contract-conformance, paja-llm, shell-csp 18/18.
